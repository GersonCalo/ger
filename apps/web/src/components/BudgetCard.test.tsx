// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { BudgetCard } from './BudgetCard';
import type { Budget } from '@/types';

const makeBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'b1',
  userId: 'u1',
  categoryId: 'c1',
  amount: 1000,
  period: 'monthly',
  month: 5,
  year: 2026,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  spent: 0,
  available: 1000,
  consumedPercent: 0,
  isOverBudget: false,
  ...overrides,
});

const renderCard = (budget: Budget) =>
  render(
    <BudgetCard
      budget={budget}
      categoryName="Alimentación"
      currency="USD"
    />
  );

describe('BudgetCard', () => {
  it('shows green bar and "Dentro del presupuesto" when consumed < 80%', () => {
    const budget = makeBudget({ spent: 500, available: 500, consumedPercent: 50 });
    const { container } = renderCard(budget);

    expect(container.querySelector('.budget-bar--ok')).toBeTruthy();
    expect(container.querySelector('.budget-bar--warning')).toBeNull();
    expect(container.querySelector('.budget-bar--over')).toBeNull();
    expect(container.querySelector('.budget-status__text')?.textContent).toBe('Dentro del presupuesto');
  });

  it('shows yellow bar and "Cerca del límite" when consumed >= 80% and < 100%', () => {
    const budget = makeBudget({ spent: 850, available: 150, consumedPercent: 85 });
    const { container } = renderCard(budget);

    expect(container.querySelector('.budget-bar--ok')).toBeNull();
    expect(container.querySelector('.budget-bar--warning')).toBeTruthy();
    expect(container.querySelector('.budget-bar--over')).toBeNull();
    expect(container.querySelector('.budget-status__text')?.textContent).toBe('Cerca del límite');
  });

  it('shows red bar and "Presupuesto excedido" when consumed >= 100%', () => {
    const budget = makeBudget({ spent: 1000, available: 0, consumedPercent: 100 });
    const { container } = renderCard(budget);

    expect(container.querySelector('.budget-bar--ok')).toBeNull();
    expect(container.querySelector('.budget-bar--warning')).toBeNull();
    expect(container.querySelector('.budget-bar--over')).toBeTruthy();
    expect(container.querySelector('.budget-status__text')?.textContent).toBe('Presupuesto excedido');
  });

  it('shows red bar when isOverBudget is true even if consumedPercent < 100', () => {
    const budget = makeBudget({ spent: 900, available: -50, consumedPercent: 90, isOverBudget: true });
    const { container } = renderCard(budget);

    expect(container.querySelector('.budget-bar--over')).toBeTruthy();
    expect(container.querySelector('.budget-status__text')?.textContent).toBe('Presupuesto excedido');
  });

  it('caps bar width at 100% even when consumedPercent > 100', () => {
    const budget = makeBudget({ spent: 1500, available: -500, consumedPercent: 150, isOverBudget: true });
    const { container } = renderCard(budget);

    const bar = container.querySelector('.budget-bar') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('sets aria-valuenow to capped percent (max 100)', () => {
    const budget = makeBudget({ consumedPercent: 135, isOverBudget: true });
    const { container } = renderCard(budget);

    const track = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(track.getAttribute('aria-valuenow')).toBe('100');
  });

  it('sets aria-valuetext with status label and real percent', () => {
    const budget = makeBudget({ consumedPercent: 135, isOverBudget: true });
    const { container } = renderCard(budget);

    const track = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(track.getAttribute('aria-valuetext')).toBe('Presupuesto excedido: 135% consumido');
  });

  it('displays category name', () => {
    const budget = makeBudget();
    const { container } = renderCard(budget);

    expect(container.querySelector('.category-tag')?.textContent).toBe('Alimentación');
  });

  it('displays budget amount in header', () => {
    const budget = makeBudget({ amount: 500 });
    const { container } = renderCard(budget);

    expect(container.querySelector('.budget-card__amount')?.textContent).toContain('500');
  });
});
