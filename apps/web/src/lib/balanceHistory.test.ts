import { describe, it, expect } from 'vitest';
import { calculateBalanceHistory, filterByPeriod, PERIOD_DAYS, PERIOD_LABELS, formatPeriodLabel, generateSmoothPath } from './balanceHistory';
import type { Transaction } from '@/types';

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  type: 'income',
  amount: '100',
  categoryId: null,
  category: null,
  note: null,
  occurredAt: '2024-01-15T00:00:00Z',
  sourceType: 'manual',
  sourceRefId: null,
  locked: false,
  groupId: null,
  groupName: null,
  ...overrides,
});

describe('calculateBalanceHistory', () => {
  it('returns empty history for no transactions', () => {
    const history = calculateBalanceHistory([]);
    expect(history).toEqual([]);
  });

  it('calculates cumulative balance from a single income', () => {
    const txs = [makeTx({ id: 't1', amount: '500', type: 'income' })];
    const history = calculateBalanceHistory(txs);
    expect(history).toHaveLength(1);
    expect(history[0].balance).toBe(500);
  });

  it('calculates cumulative balance from income and expense', () => {
    const txs = [
      makeTx({ id: 't1', amount: '1000', type: 'income', occurredAt: '2024-01-01T00:00:00Z' }),
      makeTx({ id: 't2', amount: '300', type: 'expense', occurredAt: '2024-01-02T00:00:00Z' }),
    ];
    const history = calculateBalanceHistory(txs);
    expect(history).toHaveLength(2);
    expect(history[0].balance).toBe(1000);
    expect(history[1].balance).toBe(700);
  });

  it('groups multiple transactions on the same day into one point', () => {
    const txs = [
      makeTx({ id: 't1', amount: '100', type: 'income', occurredAt: '2024-01-01T10:00:00Z' }),
      makeTx({ id: 't2', amount: '50', type: 'expense', occurredAt: '2024-01-01T15:00:00Z' }),
    ];
    const history = calculateBalanceHistory(txs);
    expect(history).toHaveLength(1);
    expect(history[0].balance).toBe(50);
  });

  it('sorts history by date ascending', () => {
    const txs = [
      makeTx({ id: 't1', amount: '200', type: 'income', occurredAt: '2024-03-01T00:00:00Z' }),
      makeTx({ id: 't2', amount: '100', type: 'income', occurredAt: '2024-01-01T00:00:00Z' }),
    ];
    const history = calculateBalanceHistory(txs);
    expect(history[0].balance).toBe(100);
    expect(history[1].balance).toBe(300);
  });

  it('handles negative final balance', () => {
    const txs = [
      makeTx({ id: 't1', amount: '100', type: 'expense', occurredAt: '2024-01-01T00:00:00Z' }),
    ];
    const history = calculateBalanceHistory(txs);
    expect(history[0].balance).toBe(-100);
  });
});

describe('filterByPeriod', () => {
  const history = [
    { date: '2024-01-15', balance: 100 },
    { date: '2024-06-01', balance: 300 },
    { date: '2024-12-20', balance: 250 },
  ];

  it('returns all history for ALL period', () => {
    const filtered = filterByPeriod(history, 'ALL');
    expect(filtered).toHaveLength(3);
  });

  it('returns all history when empty', () => {
    const filtered = filterByPeriod([], '1M');
    expect(filtered).toHaveLength(0);
  });

  it('returns all history when all dates are before cutoff', () => {
    const oldHistory = [
      { date: '2020-01-01', balance: 100 },
      { date: '2020-06-01', balance: 200 },
    ];
    const filtered = filterByPeriod(oldHistory, '1W');
    expect(filtered).toHaveLength(2);
  });

  it('returns subset when period cutoff is within range', () => {
    const recentHistory = [
      { date: '2026-03-01', balance: 100 },
      { date: '2026-04-15', balance: 200 },
      { date: '2026-05-01', balance: 300 },
      { date: '2026-05-09', balance: 350 },
    ];
    const filtered = filterByPeriod(recentHistory, '1M');
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.length).toBeLessThanOrEqual(recentHistory.length);
  });
});

describe('PERIOD constants', () => {
  it('PERIOD_DAYS has correct values', () => {
    expect(PERIOD_DAYS['1W']).toBe(7);
    expect(PERIOD_DAYS['1M']).toBe(30);
    expect(PERIOD_DAYS['3M']).toBe(90);
    expect(PERIOD_DAYS['1Y']).toBe(365);
    expect(PERIOD_DAYS['ALL']).toBe(Infinity);
  });

  it('PERIOD_LABELS has short codes', () => {
    expect(PERIOD_LABELS['1W']).toBe('1S');
    expect(PERIOD_LABELS['1M']).toBe('1M');
    expect(PERIOD_LABELS['3M']).toBe('3M');
    expect(PERIOD_LABELS['1Y']).toBe('1A');
    expect(PERIOD_LABELS['ALL']).toBe('MAX');
  });
});

describe('formatPeriodLabel', () => {
  it('returns Hoy for same day', () => {
    expect(formatPeriodLabel('2024-01-15', '2024-01-15')).toBe('Hoy');
  });

  it('returns days for less than a week', () => {
    expect(formatPeriodLabel('2024-01-10', '2024-01-15')).toBe('5d');
  });

  it('returns sem for less than a month', () => {
    expect(formatPeriodLabel('2024-01-01', '2024-01-15')).toBe('2 sem');
  });

  it('returns mes for less than a year', () => {
    expect(formatPeriodLabel('2024-01-01', '2024-03-01')).toBe('2 meses');
  });

  it('returns año for more than a year', () => {
    const label = formatPeriodLabel('2022-01-01', '2024-01-01');
    expect(label).toContain('2');
  });
});

describe('generateSmoothPath', () => {
  it('returns empty string for less than 2 points', () => {
    expect(generateSmoothPath([])).toBe('');
    expect(generateSmoothPath([{ x: 0, y: 0 }])).toBe('');
  });

  it('generates a path starting with M command', () => {
    const points = [
      { x: 0, y: 100 },
      { x: 50, y: 50 },
      { x: 100, y: 80 },
    ];
    const path = generateSmoothPath(points);
    expect(path.startsWith('M 0 100')).toBe(true);
    expect(path).toContain('C ');
  });
});
