import { Money } from '../../personal-finance/value-objects/money.js';

export type MonthlyTransactionInput = {
  type: 'income' | 'expense';
  amountCents: number;
  categoryId: string | null;
  categoryName: string | null;
};

export type InsightTip = {
  id: 'no-movements' | 'expense-up' | 'expense-down' | 'top-category' | 'keep-going';
  message: string;
};

export type MonthlySummary = {
  income: number;
  expense: number;
  balance: number;
  topCategory: { categoryId: string | null; name: string; amount: number } | null;
  previousExpense: number;
  expenseDeltaPercent: number | null;
  tips: InsightTip[];
};

const UNCATEGORIZED_LABEL = 'Sin categoría';
const EXPENSE_UP_THRESHOLD_PERCENT = 20;

const sumByType = (transactions: MonthlyTransactionInput[], type: 'income' | 'expense') =>
  transactions
    .filter(transaction => transaction.type === type)
    .reduce((sum, transaction) => sum.add(Money.fromCents(transaction.amountCents)), Money.zero());

const findTopCategory = (transactions: MonthlyTransactionInput[]) => {
  const totals = new Map<string | null, { categoryId: string | null; name: string; cents: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const entry = totals.get(transaction.categoryId) ?? {
      categoryId: transaction.categoryId,
      name: transaction.categoryName ?? UNCATEGORIZED_LABEL,
      cents: 0,
    };
    entry.cents += transaction.amountCents;
    totals.set(transaction.categoryId, entry);
  }

  let top: { categoryId: string | null; name: string; cents: number } | null = null;
  for (const entry of totals.values()) {
    if (!top || entry.cents > top.cents) {
      top = entry;
    }
  }

  return top;
};

const buildTips = ({
  expense,
  deltaPercent,
  topCategory,
}: {
  expense: Money;
  deltaPercent: number | null;
  topCategory: { name: string; cents: number } | null;
}): InsightTip[] => {
  const tips: InsightTip[] = [];

  if (expense.cents === 0) {
    tips.push({
      id: 'no-movements',
      message: 'Todavía no hay gastos este mes. Registra tus movimientos para ver en qué se te va el dinero.',
    });
    return tips;
  }

  if (deltaPercent !== null && deltaPercent > EXPENSE_UP_THRESHOLD_PERCENT) {
    tips.push({
      id: 'expense-up',
      message: `Tu gasto ha subido un ${Math.round(deltaPercent)}% respecto al mes pasado. Revisa si hay algo puntual o un hábito nuevo.`,
    });
  } else if (deltaPercent !== null && deltaPercent < 0) {
    tips.push({
      id: 'expense-down',
      message: `Vas mejor que el mes pasado: has gastado un ${Math.abs(Math.round(deltaPercent))}% menos. Sigue así.`,
    });
  }

  if (topCategory) {
    tips.push({
      id: 'top-category',
      message: `"${topCategory.name}" es tu mayor gasto del mes (${Money.fromCents(topCategory.cents).toEuros().toFixed(2)} €). Si quieres ahorrar, empieza por ahí.`,
    });
  }

  if (tips.length === 0) {
    tips.push({
      id: 'keep-going',
      message: 'Tu gasto se mantiene estable. Un presupuesto por categoría te ayudaría a afinar más.',
    });
  }

  return tips;
};

/**
 * Servicio de dominio puro: resume el mes a partir de los movimientos del mes
 * actual y del anterior. No conoce HTTP ni persistencia.
 */
export const calculateMonthlySummary = ({
  current,
  previous,
}: {
  current: MonthlyTransactionInput[];
  previous: MonthlyTransactionInput[];
}): MonthlySummary => {
  const income = sumByType(current, 'income');
  const expense = sumByType(current, 'expense');
  const previousExpense = sumByType(previous, 'expense');

  const expenseDeltaPercent =
    previousExpense.cents > 0
      ? Number((((expense.cents - previousExpense.cents) / previousExpense.cents) * 100).toFixed(1))
      : null;

  const topCategory = findTopCategory(current);

  return {
    income: income.toEuros(),
    expense: expense.toEuros(),
    balance: income.subtract(expense).toEuros(),
    topCategory: topCategory
      ? {
          categoryId: topCategory.categoryId,
          name: topCategory.name,
          amount: Money.fromCents(topCategory.cents).toEuros(),
        }
      : null,
    previousExpense: previousExpense.toEuros(),
    expenseDeltaPercent,
    tips: buildTips({ expense, deltaPercent: expenseDeltaPercent, topCategory }),
  };
};
