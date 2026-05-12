import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendError, zodIssuesDetails } from '../lib/apiError.js';
import { syncUserGroupLedgerBackfill } from '../lib/personalLedgerSync.js';
import { fromCents, roundMoney, toCents } from '../lib/groupBalances.js';

export const budgetsRouter = Router();

const BUDGET_SELECT = {
  id: true,
  userId: true,
  categoryId: true,
  amount: true,
  period: true,
  month: true,
  year: true,
  createdAt: true,
  updatedAt: true,
} as const;

const createBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  period: z.enum(['monthly']),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2099),
  recurring: z.boolean().optional().default(false),
  monthsCount: z.number().int().min(1).max(12).optional().default(3),
});

const updateBudgetSchema = z.object({
  categoryId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  period: z.enum(['monthly']).optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2099).optional(),
});

const listQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2099).optional(),
  period: z.enum(['monthly']).optional(),
  categoryId: z.string().uuid().optional(),
});

const assertCategoryOwnedByUser = async (categoryId: string, userId: string) => {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      groupId: null,
      OR: [
        { userId },
        { userId: null },
      ],
    },
  });
  return category;
};

budgetsRouter.get('/budgets', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;

  const parsed = listQuerySchema.safeParse(_req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Parámetros de consulta inválidos', zodIssuesDetails(parsed.error));
  }

  const { month, year, period, categoryId } = parsed.data;

  const where: Record<string, unknown> = { userId };

  if (month !== undefined) {
    where.month = month;
  }
  if (year !== undefined) {
    where.year = year;
  }
  if (period !== undefined) {
    where.period = period;
  }
  if (categoryId !== undefined) {
    const category = await assertCategoryOwnedByUser(categoryId, userId);
    if (!category) {
      return sendError(res, 400, 'BUDGET_INVALID_CATEGORY', 'Categoría no encontrada o no tienes acceso a ella');
    }
    where.categoryId = categoryId;
  }

  const budgets = await prisma.budget.findMany({
    where,
    select: BUDGET_SELECT,
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
  });

  if (month !== undefined && year !== undefined) {
    await prisma.$transaction((tx) => syncUserGroupLedgerBackfill(tx, userId));

    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const categoryIds = [...new Set(budgets.map((b) => b.categoryId))];

    const spentByCategory = categoryIds.length > 0
      ? await prisma.personalTransaction.groupBy({
          by: ['categoryId'],
          where: {
            userId,
            type: 'expense' as const,
            categoryId: { in: categoryIds },
            occurredAt: { gte: monthStart, lt: monthEnd },
          },
          _sum: { amount: true },
        })
      : [];

    const spentMap = new Map<string, number>();
    for (const row of spentByCategory) {
      if (row.categoryId && row._sum?.amount) {
        spentMap.set(row.categoryId, roundMoney(Number(row._sum.amount.toString())));
      }
    }

    const budgetsWithUsage = budgets.map((budget) => {
      const spent = spentMap.get(budget.categoryId) ?? 0;
      const available = roundMoney(budget.amount - spent);
      const consumedPercent = budget.amount > 0 ? roundMoney((spent / budget.amount) * 100) : 0;
      return {
        ...budget,
        spent,
        available,
        consumedPercent,
        isOverBudget: available < 0,
      };
    });

    return res.json({ budgets: budgetsWithUsage });
  }

  const budgetsWithDefaults = budgets.map((budget) => ({
    ...budget,
    spent: 0,
    available: budget.amount,
    consumedPercent: 0,
    isOverBudget: false,
  }));

  return res.json({ budgets: budgetsWithDefaults });
});

budgetsRouter.post('/budgets', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const parsed = createBudgetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const category = await assertCategoryOwnedByUser(parsed.data.categoryId, userId);
  if (!category) {
    return sendError(res, 400, 'BUDGET_INVALID_CATEGORY', 'Categoría no encontrada o no tienes acceso a ella');
  }

  const budgets: Array<Record<string, unknown>> = [];
  const duplicates: Array<{ month: number; year: number }> = [];

  const monthsToCreate = parsed.data.recurring ? parsed.data.monthsCount : 1;

  for (let i = 0; i < monthsToCreate; i++) {
    const targetMonth = parsed.data.month + i;
    const adjustedMonth = ((targetMonth - 1) % 12) + 1;
    const adjustedYear = parsed.data.year + Math.floor((targetMonth - 1) / 12);

    if (adjustedYear > 2099) break;

    try {
      const budget = await prisma.budget.create({
        data: {
          userId,
          categoryId: parsed.data.categoryId,
          amount: parsed.data.amount,
          period: parsed.data.period,
          month: adjustedMonth,
          year: adjustedYear,
        },
        select: BUDGET_SELECT,
      });
      budgets.push(budget);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        duplicates.push({ month: adjustedMonth, year: adjustedYear });
      } else {
        return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
      }
    }
  }

  if (budgets.length === 0) {
    if (duplicates.length > 0) {
      return sendError(res, 409, 'BUDGET_ALREADY_EXISTS', 'Ya existe un presupuesto para esta categoría en el periodo indicado');
    }
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }

  const response: { budgets: Array<Record<string, unknown>>; duplicates?: Array<{ month: number; year: number }> } = { budgets };
  if (duplicates.length > 0) {
    response.duplicates = duplicates;
  }

  return res.status(201).json(response);
});

budgetsRouter.patch('/budgets/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const budgetId = req.params.id;

  const parsed = updateBudgetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const hasAnyField = Object.values(parsed.data).some(v => v !== undefined);
  if (!hasAnyField) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos');
  }

  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
    select: { id: true, categoryId: true, month: true, year: true, period: true },
  });

  if (!existing) {
    return sendError(res, 404, 'BUDGET_NOT_FOUND', 'Presupuesto no encontrado');
  }

  const finalCategoryId = parsed.data.categoryId ?? existing.categoryId;
  const finalMonth = parsed.data.month ?? existing.month;
  const finalYear = parsed.data.year ?? existing.year;
  const finalPeriod = parsed.data.period ?? existing.period;

  if (parsed.data.categoryId) {
    const category = await assertCategoryOwnedByUser(parsed.data.categoryId, userId);
    if (!category) {
      return sendError(res, 400, 'BUDGET_INVALID_CATEGORY', 'Categoría no encontrada o no tienes acceso a ella');
    }
  }

  const willChangeUniqueness =
    parsed.data.categoryId !== undefined ||
    parsed.data.month !== undefined ||
    parsed.data.year !== undefined ||
    parsed.data.period !== undefined;

  if (willChangeUniqueness) {
    const conflict = await prisma.budget.findFirst({
      where: {
        userId,
        categoryId: finalCategoryId,
        month: finalMonth,
        year: finalYear,
        period: finalPeriod,
        id: { not: budgetId },
      },
    });

    if (conflict) {
      return sendError(res, 409, 'BUDGET_ALREADY_EXISTS', 'Ya existe un presupuesto para esta categoría en el periodo indicado');
    }
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.amount !== undefined) {
    updates.amount = parsed.data.amount;
  }
  if (parsed.data.categoryId !== undefined) {
    updates.categoryId = parsed.data.categoryId;
  }
  if (parsed.data.month !== undefined) {
    updates.month = parsed.data.month;
  }
  if (parsed.data.year !== undefined) {
    updates.year = parsed.data.year;
  }
  if (parsed.data.period !== undefined) {
    updates.period = parsed.data.period;
  }

  try {
    const budget = await prisma.budget.update({
      where: { id: existing.id },
      data: updates,
      select: BUDGET_SELECT,
    });

    return res.json({ budget });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return sendError(res, 409, 'BUDGET_ALREADY_EXISTS', 'Ya existe un presupuesto para esta categoría en el periodo indicado');
    }
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }
});

budgetsRouter.delete('/budgets/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const budgetId = req.params.id;

  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
    select: { id: true },
  });

  if (!existing) {
    return sendError(res, 404, 'BUDGET_NOT_FOUND', 'Presupuesto no encontrado');
  }

  await prisma.budget.delete({
    where: { id: existing.id },
  });

  return res.status(204).send();
});
