import type { MonthlySummary } from './monthly-summary.service.js';

export type AiSummaryBudgetInput = {
  categoryName: string;
  amount: number;
  spent: number;
};

/**
 * Datos que se envían al proveedor de IA. Solo agregados anónimos: nunca
 * emails, nombres de usuario, ids ni notas de movimientos.
 */
export type AiSummaryInput = {
  month: number;
  year: number;
  currency: string;
  income: number;
  expense: number;
  balance: number;
  previousExpense: number;
  expenseDeltaPercent: number | null;
  topCategory: { name: string; amount: number } | null;
  budgets: AiSummaryBudgetInput[];
};

export const buildAiSummaryInput = ({
  summary,
  budgets,
  month,
  year,
  currency,
}: {
  summary: MonthlySummary;
  budgets: AiSummaryBudgetInput[];
  month: number;
  year: number;
  currency?: string;
  /** Se acepta pero se ignora deliberadamente: el input nunca lleva datos personales. */
  user?: { currency?: string };
}): AiSummaryInput => ({
  month,
  year,
  currency: currency ?? 'EUR',
  income: summary.income,
  expense: summary.expense,
  balance: summary.balance,
  previousExpense: summary.previousExpense,
  expenseDeltaPercent: summary.expenseDeltaPercent,
  topCategory: summary.topCategory
    ? { name: summary.topCategory.name, amount: summary.topCategory.amount }
    : null,
  budgets: budgets.map(budget => ({
    categoryName: budget.categoryName,
    amount: budget.amount,
    spent: budget.spent,
  })),
});

export const buildAiSummaryPrompt = (input: AiSummaryInput): string => {
  const lines = [
    'Eres un asesor financiero personal. Analiza el mes del usuario y escribe un resumen breve en español, cercano y accionable.',
    'Reglas estrictas: no inventes gastos, categorías ni cifras que no estén en los datos; no pidas información adicional; máximo 120 palabras.',
    '',
    `Datos del mes ${input.month}/${input.year} (${input.currency}):`,
    `- Ingresos: ${input.income}`,
    `- Gastos: ${input.expense} (mes anterior: ${input.previousExpense})`,
    input.expenseDeltaPercent !== null ? `- Variación del gasto: ${input.expenseDeltaPercent}%` : null,
    input.topCategory ? `- Categoría con mayor gasto: ${input.topCategory.name} (${input.topCategory.amount})` : null,
    input.budgets.length > 0
      ? `- Presupuestos: ${input.budgets.map(b => `${b.categoryName} ${b.spent}/${b.amount}`).join(', ')}`
      : null,
  ];

  return lines.filter((line): line is string => line !== null).join('\n');
};

/**
 * Implementación local y determinista del análisis: lenguaje natural generado
 * solo a partir de los datos recibidos. Sirve como proveedor por defecto y
 * como referencia de comportamiento para proveedores externos.
 */
export const generateLocalAiSummary = (input: AiSummaryInput): string => {
  const parts: string[] = [];

  parts.push(
    `En ${String(input.month).padStart(2, '0')}/${input.year} has gastado ${input.expense.toFixed(2)} ${input.currency} e ingresado ${input.income.toFixed(2)} ${input.currency}, con un balance de ${input.balance.toFixed(2)} ${input.currency}.`
  );

  if (input.expenseDeltaPercent !== null) {
    if (input.expenseDeltaPercent > 0) {
      parts.push(
        `Tu gasto ha subido un ${input.expenseDeltaPercent}% respecto al mes anterior (${input.previousExpense.toFixed(2)} ${input.currency}); merece la pena revisar si es algo puntual.`
      );
    } else if (input.expenseDeltaPercent < 0) {
      parts.push(
        `Buen trabajo: has gastado un ${Math.abs(input.expenseDeltaPercent)}% menos que el mes anterior.`
      );
    } else {
      parts.push('Tu gasto se mantiene igual que el mes anterior.');
    }
  }

  if (input.topCategory) {
    parts.push(
      `Tu mayor gasto está en ${input.topCategory.name} (${input.topCategory.amount.toFixed(2)} ${input.currency}); si buscas ahorrar, es el mejor sitio para empezar.`
    );
  }

  const overBudget = input.budgets.filter(budget => budget.spent > budget.amount);
  const nearBudget = input.budgets.filter(
    budget => budget.spent <= budget.amount && budget.amount > 0 && budget.spent / budget.amount >= 0.8
  );

  if (overBudget.length > 0) {
    parts.push(
      `Has superado el presupuesto de ${overBudget.map(b => `${b.categoryName} (${b.spent.toFixed(2)}/${b.amount.toFixed(2)})`).join(' y ')}.`
    );
  }

  if (nearBudget.length > 0) {
    parts.push(`Estás cerca del límite en ${nearBudget.map(b => b.categoryName).join(', ')}.`);
  }

  if (input.expense === 0) {
    parts.push('Todavía no hay gastos registrados este mes: registra tus movimientos para obtener un análisis más útil.');
  }

  return parts.join(' ');
};
