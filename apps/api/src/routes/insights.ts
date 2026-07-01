import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendError, zodIssuesDetails } from '../lib/apiError.js';
import { MonthPeriod } from '../domain/insights/value-objects/month-period.js';
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
