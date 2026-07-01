// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { MonthlySummaryCard } from './MonthlySummaryCard';
import type { MonthlySummary } from '@/types';

afterEach(cleanup);

const makeSummary = (overrides: Partial<MonthlySummary> = {}): MonthlySummary => ({
  month: 7,
  year: 2026,
  income: 1500,
  expense: 195,
  balance: 1305,
  topCategory: { categoryId: 'cat-super', name: 'Supermercado', amount: 120 },
  previousExpense: 150,
  expenseDeltaPercent: 30,
  tips: [{ id: 'expense-up', message: 'Tu gasto ha subido un 30% respecto al mes pasado.' }],
  ...overrides,
});

describe('MonthlySummaryCard', () => {
  it('muestra la categoría con mayor gasto', () => {
    render(<MonthlySummaryCard summary={makeSummary()} currency="EUR" />);

    expect(screen.getByText('Supermercado')).toBeTruthy();
  });

  it('muestra la comparación con el mes anterior cuando sube el gasto', () => {
    render(<MonthlySummaryCard summary={makeSummary()} currency="EUR" />);

    expect(screen.getByText(/\+30\s?% vs mes anterior/)).toBeTruthy();
  });

  it('muestra la comparación cuando baja el gasto', () => {
    render(
      <MonthlySummaryCard
        summary={makeSummary({ expenseDeltaPercent: -20 })}
        currency="EUR"
      />
    );

    expect(screen.getByText(/-20\s?% vs mes anterior/)).toBeTruthy();
  });

  it('muestra el consejo basado en los datos', () => {
    render(<MonthlySummaryCard summary={makeSummary()} currency="EUR" />);

    expect(screen.getByText('Tu gasto ha subido un 30% respecto al mes pasado.')).toBeTruthy();
  });

  it('no se renderiza sin datos', () => {
    const { container } = render(<MonthlySummaryCard summary={null} currency="EUR" />);

    expect(container.firstChild).toBeNull();
  });

  it('ofrece el análisis inteligente premium y lanza la petición', () => {
    const onGenerateAiSummary = vi.fn();
    render(
      <MonthlySummaryCard
        summary={makeSummary()}
        currency="EUR"
        onGenerateAiSummary={onGenerateAiSummary}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /análisis inteligente/i }));

    expect(onGenerateAiSummary).toHaveBeenCalledTimes(1);
  });

  it('muestra el análisis generado en lugar del botón', () => {
    render(
      <MonthlySummaryCard
        summary={makeSummary()}
        currency="EUR"
        onGenerateAiSummary={vi.fn()}
        aiSummary="Tu mayor gasto está en Supermercado; empieza por ahí."
      />
    );

    expect(screen.getByText('Tu mayor gasto está en Supermercado; empieza por ahí.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /análisis inteligente/i })).toBeNull();
  });
});
