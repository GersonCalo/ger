import type { Prisma } from '@prisma/client';
import { roundMoney } from './groupBalances.js';
import { sendPushToUser } from './push.js';

type AlertTriggered = {
  categoryId: string;
  categoryName: string;
  month: number;
  year: number;
  threshold: 80 | 100;
  consumedPercent: number;
  spent: number;
  budgetAmount: number;
};

type CheckThresholdsParams = {
  tx: Prisma.TransactionClient;
  userId: string;
  categoryIds: string[];
  months: Array<{ month: number; year: number }>;
};

const THRESHOLDS = [80, 100] as const;

const thresholdToEnum = (t: 80 | 100): 'eighty' | 'oneHundred' =>
  t === 80 ? 'eighty' : 'oneHundred';

const thresholdLabel = (t: 80 | 100): string =>
  t === 80 ? 'Alcanzaste el 80% de tu presupuesto' : 'Superaste tu presupuesto';

const getMonthBounds = (month: number, year: number) => ({
  start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
  end: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
});

const computeSpentByCategory = async (
  tx: Prisma.TransactionClient,
  userId: string,
  categoryIds: string[],
  month: number,
  year: number
): Promise<Map<string, number>> => {
  const { start, end } = getMonthBounds(month, year);

  const rows = await tx.personalTransaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: 'expense',
      categoryId: { in: categoryIds },
      occurredAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.categoryId && row._sum?.amount) {
      map.set(row.categoryId, roundMoney(Number(row._sum.amount.toString())));
    }
  }
  return map;
};

export const checkBudgetThresholds = async (
  params: CheckThresholdsParams
): Promise<AlertTriggered[]> => {
  const { tx, userId, categoryIds, months } = params;
  if (categoryIds.length === 0 || months.length === 0) return [];

  const uniqueCategoryIds = [...new Set(categoryIds)];
  const uniqueMonths = [...new Set(months.map(m => `${m.month}-${m.year}`))].map(key => {
    const [month, year] = key.split('-').map(Number);
    return { month, year };
  });

  const alertsTriggered: AlertTriggered[] = [];

  for (const { month, year } of uniqueMonths) {
    const { start, end } = getMonthBounds(month, year);

    const budgets = await tx.budget.findMany({
      where: {
        userId,
        categoryId: { in: uniqueCategoryIds },
        month,
        year,
      },
      select: {
        id: true,
        categoryId: true,
        amount: true,
      },
    });

    if (budgets.length === 0) continue;

    const spentMap = await computeSpentByCategory(tx, userId, uniqueCategoryIds, month, year);

    for (const budget of budgets) {
      const spent = spentMap.get(budget.categoryId) ?? 0;
      const consumedPercent = budget.amount > 0 ? roundMoney((spent / budget.amount) * 100) : 0;

      for (const t of THRESHOLDS) {
        if (consumedPercent < t) continue;

        try {
          await tx.budgetAlert.create({
            data: {
              userId,
              budgetId: budget.id,
              categoryId: budget.categoryId,
              month,
              year,
              threshold: thresholdToEnum(t),
              consumedPercent,
              spentSnapshot: spent,
              budgetAmountSnapshot: budget.amount,
              channel: 'push',
            },
          });

          const category = await tx.category.findUnique({
            where: { id: budget.categoryId },
            select: { name: true },
          });

          const categoryName = category?.name ?? 'Sin categoría';

          await sendPushToUser(userId, {
            title: `Presupuesto ${categoryName}`,
            body: thresholdLabel(t),
            data: {
              type: 'budget_alert',
              url: '/budgets',
              categoryId: budget.categoryId,
              threshold: String(t),
              month: String(month),
              year: String(year),
            },
          }).catch(() => {});

          alertsTriggered.push({
            categoryId: budget.categoryId,
            categoryName,
            month,
            year,
            threshold: t,
            consumedPercent,
            spent,
            budgetAmount: budget.amount,
          });
        } catch {
          // Unique constraint violation = alert already sent for this threshold/month/category
          // Silently skip — no duplicate needed
        }
      }
    }
  }

  return alertsTriggered;
};

export type { AlertTriggered };
