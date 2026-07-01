import { describe, it, expect } from 'vitest';

import { buildAiSummaryInput, buildAiSummaryPrompt, generateLocalAiSummary } from './ai-summary.service';
import type { MonthlySummary } from './monthly-summary.service';

const summary: MonthlySummary = {
  income: 1500,
  expense: 420,
  balance: 1080,
  topCategory: { categoryId: 'cat-super', name: 'Supermercado', amount: 180 },
  previousExpense: 300,
  expenseDeltaPercent: 40,
  tips: [{ id: 'expense-up', message: 'Tu gasto ha subido un 40% respecto al mes pasado.' }],
};

const budgets = [
  { categoryName: 'Supermercado', amount: 250, spent: 180 },
  { categoryName: 'Ocio', amount: 100, spent: 120 },
];

describe('buildAiSummaryInput (seguridad de datos)', () => {
  it('solo incluye agregados: nada de emails, nombres de usuario ni notas', () => {
    const input = buildAiSummaryInput({
      summary,
      budgets,
      month: 7,
      year: 2026,
      user: {
        id: 'user-1',
        email: 'gerson@example.com',
        name: 'Gerson',
        currency: 'EUR',
      } as any,
    });

    const serialized = JSON.stringify(input);

    expect(serialized).not.toContain('gerson@example.com');
    expect(serialized).not.toContain('Gerson');
    expect(serialized).not.toContain('user-1');
    expect(input.currency).toBe('EUR');
    expect(input.expense).toBe(420);
    expect(input.topCategory?.name).toBe('Supermercado');
    expect(input.budgets).toHaveLength(2);
  });
});

describe('buildAiSummaryPrompt', () => {
  it('genera un prompt con los datos del mes y la instrucción de no inventar', () => {
    const input = buildAiSummaryInput({ summary, budgets, month: 7, year: 2026 });
    const prompt = buildAiSummaryPrompt(input);

    expect(prompt).toContain('Supermercado');
    expect(prompt).toContain('420');
    expect(prompt.toLowerCase()).toContain('no inventes');
  });
});

describe('generateLocalAiSummary (implementación local determinista)', () => {
  // Scenario Gherkin HU-07.1:
  //   Then el sistema debe generar un resumen en lenguaje natural
  //   And debe mencionar las categorías más relevantes
  //   And no debe inventar gastos que no existan
  it('menciona la categoría top, la variación mensual y el presupuesto excedido', () => {
    const input = buildAiSummaryInput({ summary, budgets, month: 7, year: 2026 });
    const content = generateLocalAiSummary(input);

    expect(content).toContain('Supermercado');
    expect(content).toContain('40');
    expect(content).toContain('Ocio');
    expect(content.length).toBeGreaterThan(80);
  });

  it('es determinista: mismos datos, mismo análisis', () => {
    const input = buildAiSummaryInput({ summary, budgets, month: 7, year: 2026 });

    expect(generateLocalAiSummary(input)).toBe(generateLocalAiSummary(input));
  });

  it('funciona sin categoría top ni presupuestos', () => {
    const input = buildAiSummaryInput({
      summary: { ...summary, topCategory: null, expenseDeltaPercent: null },
      budgets: [],
      month: 7,
      year: 2026,
    });

    const content = generateLocalAiSummary(input);

    expect(content.length).toBeGreaterThan(40);
  });
});
