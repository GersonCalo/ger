import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendError, zodIssuesDetails } from '../lib/apiError.js';
import { getAiInsightProvider } from '../lib/aiInsightProvider.js';
import { resolvePlan } from '../domain/billing/services/plan-policy.js';
import { MonthPeriod } from '../domain/insights/value-objects/month-period.js';
import { buildAiSummaryInput } from '../domain/insights/services/ai-summary.service.js';
import {
  calculateMonthlySummary,
  type MonthlyTransactionInput,
} from '../domain/insights/services/monthly-summary.service.js';

export const insightsRouter = Router();

const monthlySummaryQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2099).optional(),
});

const fetchPeriodTransactions = async (
  userId: string,
  period: MonthPeriod
): Promise<MonthlyTransactionInput[]> => {
  const rows = await prisma.personalTransaction.findMany({
    where: {
      userId,
      occurredAt: {
        gte: period.start,
        lt: period.end,
      },
    },
    select: {
      type: true,
      amount: true,
      categoryId: true,
      category: {
        select: { name: true },
      },
    },
  });

  return rows.map(row => ({
    type: row.type === 'income' ? 'income' : 'expense',
    amountCents: Math.round(Number(row.amount.toString()) * 100),
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
  }));
};

insightsRouter.get('/insights/monthly-summary', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const parsed = monthlySummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Parámetros de consulta inválidos', zodIssuesDetails(parsed.error));
  }

  const fallback = MonthPeriod.fromDate(new Date());
  const period = MonthPeriod.of(parsed.data.year ?? fallback.year, parsed.data.month ?? fallback.month);

  const [current, previous] = await Promise.all([
    fetchPeriodTransactions(userId, period),
    fetchPeriodTransactions(userId, period.previous()),
  ]);

  const summary = calculateMonthlySummary({ current, previous });

  return res.json({
    summary: {
      month: period.month,
      year: period.year,
      ...summary,
    },
  });
});

const aiSummaryBodySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2099).optional(),
});

insightsRouter.post('/insights/ai-summary', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const parsed = aiSummaryBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });

  const plan = resolvePlan(subscription, new Date());
  if (plan !== 'premium') {
    return sendError(
      res,
      403,
      'PLAN_LIMIT_REACHED',
      'El análisis inteligente del mes es una función premium.',
      { feature: 'insights.ai-summary', plan, limit: 0, current: 0 }
    );
  }

  const fallback = MonthPeriod.fromDate(new Date());
  const period = MonthPeriod.of(parsed.data.year ?? fallback.year, parsed.data.month ?? fallback.month);

  const [user, current, previous, budgets] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { currency: true } }),
    fetchPeriodTransactions(userId, period),
    fetchPeriodTransactions(userId, period.previous()),
    prisma.budget.findMany({
      where: { userId, month: period.month, year: period.year },
      select: {
        categoryId: true,
        amount: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const summary = calculateMonthlySummary({ current, previous });

  const spentByCategory = new Map<string | null, number>();
  for (const transaction of current) {
    if (transaction.type !== 'expense') continue;
    spentByCategory.set(
      transaction.categoryId,
      (spentByCategory.get(transaction.categoryId) ?? 0) + transaction.amountCents
    );
  }

  const input = buildAiSummaryInput({
    summary,
    month: period.month,
    year: period.year,
    currency: user?.currency ?? 'EUR',
    budgets: budgets.map(budget => ({
      categoryName: budget.category?.name ?? 'Sin categoría',
      amount: Number(budget.amount.toString()),
      spent: (spentByCategory.get(budget.categoryId) ?? 0) / 100,
    })),
  });

  const provider = getAiInsightProvider();
  const content = await provider.generateSummary(input);

  const insight = await prisma.aiInsight.create({
    data: {
      userId,
      month: period.month,
      year: period.year,
      provider: provider.name,
      content,
    },
  });

  return res.status(201).json({
    insight: {
      id: insight.id,
      month: insight.month,
      year: insight.year,
      provider: insight.provider,
      content: insight.content,
      createdAt: insight.createdAt,
    },
  });
});
