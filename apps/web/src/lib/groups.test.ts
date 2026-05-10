import { describe, it, expect } from 'vitest';
import { summarizeTransactions } from './groups';
import type { GroupSummary, GroupExpense } from '@/types';

const makeExpense = (overrides: Partial<GroupExpense> = {}): GroupExpense => ({
  id: 'exp-1',
  description: 'Test expense',
  amount: 100,
  payerMemberId: 'member-a',
  category: null,
  categoryId: null,
  splitMethod: 'equal',
  occurredAt: '2024-01-01T00:00:00Z',
  splits: [],
  ...overrides,
});

const makeGroup = (expenses: GroupExpense[]): GroupSummary => ({
  id: 'group-1',
  name: 'Test Group',
  currency: 'EUR',
  createdAt: '2024-01-01T00:00:00Z',
  membersCount: 2,
  expensesCount: expenses.length,
  members: [],
  expenses,
});

describe('summarizeTransactions', () => {
  it('returns zero totals for a group with no expenses', () => {
    const group = makeGroup([]);
    const result = summarizeTransactions(group);
    expect(result).toEqual({ total: 0, count: 0 });
  });

  it('sums total and count correctly for 3 expenses', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 50 }),
      makeExpense({ id: 'e2', amount: 30 }),
      makeExpense({ id: 'e3', amount: 20 }),
    ];
    const group = makeGroup(expenses);
    const result = summarizeTransactions(group);
    expect(result.total).toBe(100);
    expect(result.count).toBe(3);
  });

  it('handles decimal amounts without losing precision', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 10.1 }),
      makeExpense({ id: 'e2', amount: 20.2 }),
      makeExpense({ id: 'e3', amount: 5.55 }),
    ];
    const group = makeGroup(expenses);
    const result = summarizeTransactions(group);
    expect(result.count).toBe(3);
    expect(result.total).toBeCloseTo(35.85, 10);
  });

  it('handles a single expense correctly', () => {
    const expenses = [makeExpense({ id: 'e1', amount: 99.99 })];
    const group = makeGroup(expenses);
    const result = summarizeTransactions(group);
    expect(result.total).toBe(99.99);
    expect(result.count).toBe(1);
  });

  it('handles large expense amounts', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 10000 }),
      makeExpense({ id: 'e2', amount: 5000.5 }),
    ];
    const group = makeGroup(expenses);
    const result = summarizeTransactions(group);
    expect(result.total).toBe(15000.5);
    expect(result.count).toBe(2);
  });
});
