import { describe, it, expect } from 'vitest';

import { calculateMonthlySummary } from './monthly-summary.service';

const expense = (amountCents: number, categoryId: string | null, categoryName: string | null) => ({
  type: 'expense' as const,
  amountCents,
  categoryId,
  categoryName,
});

const income = (amountCents: number) => ({
  type: 'income' as const,
  amountCents,
  categoryId: null,
  categoryName: null,
});

describe('calculateMonthlySummary (servicio de dominio puro)', () => {
  it('devuelve un resumen vacío sin movimientos', () => {
    const result = calculateMonthlySummary({ current: [], previous: [] });

    expect(result.income).toBe(0);
    expect(result.expense).toBe(0);
    expect(result.topCategory).toBeNull();
    expect(result.previousExpense).toBe(0);
    expect(result.expenseDeltaPercent).toBeNull();
    expect(result.tips.length).toBeGreaterThan(0);
  });

  // Scenario Gherkin HU-06.1:
  //   Given un usuario tiene gastos en supermercado, cafés y transporte
  //   When abre el resumen mensual
  //   Then debe ver la categoría con mayor gasto
  //   And debe ver cuánto gastó respecto al mes anterior
  //   And debe ver un consejo simple basado en sus datos
  it('identifica la categoría con mayor gasto y compara con el mes anterior', () => {
    const result = calculateMonthlySummary({
      current: [
        expense(12000, 'cat-super', 'Supermercado'),
        expense(4500, 'cat-cafe', 'Cafés'),
        expense(3000, 'cat-transporte', 'Transporte'),
        income(150000),
      ],
      previous: [expense(15000, 'cat-super', 'Supermercado')],
    });

    expect(result.income).toBe(1500);
    expect(result.expense).toBe(195);
    expect(result.topCategory).toEqual({
      categoryId: 'cat-super',
      name: 'Supermercado',
      amount: 120,
    });
    expect(result.previousExpense).toBe(150);
    expect(result.expenseDeltaPercent).toBe(30);
    expect(result.tips.length).toBeGreaterThan(0);
  });

  it('agrupa el gasto sin categoría bajo una etiqueta genérica', () => {
    const result = calculateMonthlySummary({
      current: [expense(5000, null, null), expense(1000, 'cat-cafe', 'Cafés')],
      previous: [],
    });

    expect(result.topCategory).toEqual({
      categoryId: null,
      name: 'Sin categoría',
      amount: 50,
    });
  });

  it('avisa cuando el gasto sube más del 20% respecto al mes anterior', () => {
    const result = calculateMonthlySummary({
      current: [expense(13000, 'cat-super', 'Supermercado')],
      previous: [expense(10000, 'cat-super', 'Supermercado')],
    });

    expect(result.expenseDeltaPercent).toBe(30);
    expect(result.tips.some(tip => tip.id === 'expense-up')).toBe(true);
  });

  it('felicita cuando el gasto baja respecto al mes anterior', () => {
    const result = calculateMonthlySummary({
      current: [expense(8000, 'cat-super', 'Supermercado')],
      previous: [expense(10000, 'cat-super', 'Supermercado')],
    });

    expect(result.expenseDeltaPercent).toBe(-20);
    expect(result.tips.some(tip => tip.id === 'expense-down')).toBe(true);
  });

  it('no calcula delta si el mes anterior no tiene gastos', () => {
    const result = calculateMonthlySummary({
      current: [expense(5000, 'cat-super', 'Supermercado')],
      previous: [],
    });

    expect(result.expenseDeltaPercent).toBeNull();
  });
});
