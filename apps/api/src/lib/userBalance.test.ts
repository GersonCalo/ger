import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    personalTransaction: {
      findMany: vi.fn(),
    },
    groupMember: {
      findMany: vi.fn(),
    },
  },
}));

import { calculateUserBalance } from './userBalance';
import { prisma } from '../db/prisma.js';

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('calculateUserBalance', () => {
  it('returns zeros for user with no transactions and no groups', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([]);

    const result = await calculateUserBalance('user-1');

    expect(result.personalIncome).toBe(0);
    expect(result.personalExpense).toBe(0);
    expect(result.personalBalance).toBe(0);
    expect(result.groupNet).toBe(0);
    expect(result.totalBalance).toBe(0);
    expect(result.groupsBreakdown).toEqual([]);
  });

  it('calculates personalBalance from income and expense', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([
      { type: 'income', amount: { toString: () => '1000' } },
      { type: 'expense', amount: { toString: () => '300' } },
    ]);
    mockPrisma.groupMember.findMany.mockResolvedValue([]);

    const result = await calculateUserBalance('user-1');

    expect(result.personalIncome).toBe(1000);
    expect(result.personalExpense).toBe(300);
    expect(result.personalBalance).toBe(700);
    expect(result.groupNet).toBe(0);
    expect(result.totalBalance).toBe(700);
  });

  it('adds positive groupNet to totalBalance', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([
      { type: 'income', amount: { toString: () => '1000' } },
      { type: 'expense', amount: { toString: () => '300' } },
    ]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        group: {
          id: 'group-1',
          name: 'Trip',
          currency: 'EUR',
          members: [
            { id: 'membership-1', displayName: 'Alice', weight: { toString: () => '1' } },
            { id: 'membership-2', displayName: 'Bob', weight: { toString: () => '1' } },
          ],
          expenses: [
            {
              id: 'exp-1',
              payerMemberId: 'membership-1',
              amount: { toString: () => '100' },
              splitMethod: 'equal',
              splits: [
                { memberId: 'membership-1', shareAmount: { toString: () => '50' }, shareWeight: null },
                { memberId: 'membership-2', shareAmount: { toString: () => '50' }, shareWeight: null },
              ],
            },
          ],
          settlements: [],
        },
      },
    ]);

    const result = await calculateUserBalance('user-1');

    expect(result.personalBalance).toBe(700);
    expect(result.groupNet).toBe(50);
    expect(result.totalBalance).toBe(750);
    expect(result.groupsBreakdown).toHaveLength(1);
    expect(result.groupsBreakdown[0].net).toBe(50);
  });

  it('does not subtract negative groupNet from totalBalance', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([
      { type: 'income', amount: { toString: () => '1000' } },
    ]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        group: {
          id: 'group-1',
          name: 'Dinner',
          currency: 'EUR',
          members: [
            { id: 'membership-1', displayName: 'Alice', weight: { toString: () => '1' } },
            { id: 'membership-2', displayName: 'Bob', weight: { toString: () => '1' } },
          ],
          expenses: [
            {
              id: 'exp-1',
              payerMemberId: 'membership-2',
              amount: { toString: () => '200' },
              splitMethod: 'equal',
              splits: [
                { memberId: 'membership-1', shareAmount: { toString: () => '100' }, shareWeight: null },
                { memberId: 'membership-2', shareAmount: { toString: () => '100' }, shareWeight: null },
              ],
            },
          ],
          settlements: [],
        },
      },
    ]);

    const result = await calculateUserBalance('user-1');

    expect(result.personalBalance).toBe(1000);
    expect(result.groupNet).toBe(-100);
    expect(result.totalBalance).toBe(1000);
  });

  it('includes locked transactions in personal balance calculation', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([
      { type: 'income', amount: { toString: () => '500' } },
      { type: 'expense', amount: { toString: () => '200' } },
    ]);
    mockPrisma.groupMember.findMany.mockResolvedValue([]);

    const result = await calculateUserBalance('user-1');

    expect(result.personalIncome).toBe(500);
    expect(result.personalExpense).toBe(200);
    expect(result.personalBalance).toBe(300);
  });

  it('handles multiple groups with mixed net values', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([
      { type: 'income', amount: { toString: () => '2000' } },
      { type: 'expense', amount: { toString: () => '500' } },
    ]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      {
        id: 'mem-1',
        group: {
          id: 'g1',
          name: 'Positive Group',
          currency: 'EUR',
          members: [
            { id: 'mem-1', displayName: 'Alice', weight: { toString: () => '1' } },
            { id: 'mem-2', displayName: 'Bob', weight: { toString: () => '1' } },
          ],
          expenses: [
            {
              id: 'e1',
              payerMemberId: 'mem-1',
              amount: { toString: () => '100' },
              splitMethod: 'equal',
              splits: [
                { memberId: 'mem-1', shareAmount: { toString: () => '50' }, shareWeight: null },
                { memberId: 'mem-2', shareAmount: { toString: () => '50' }, shareWeight: null },
              ],
            },
          ],
          settlements: [],
        },
      },
      {
        id: 'mem-3',
        group: {
          id: 'g2',
          name: 'Negative Group',
          currency: 'EUR',
          members: [
            { id: 'mem-3', displayName: 'Alice', weight: { toString: () => '1' } },
            { id: 'mem-4', displayName: 'Dave', weight: { toString: () => '1' } },
          ],
          expenses: [
            {
              id: 'e2',
              payerMemberId: 'mem-4',
              amount: { toString: () => '80' },
              splitMethod: 'equal',
              splits: [
                { memberId: 'mem-3', shareAmount: { toString: () => '40' }, shareWeight: null },
                { memberId: 'mem-4', shareAmount: { toString: () => '40' }, shareWeight: null },
              ],
            },
          ],
          settlements: [],
        },
      },
    ]);

    const result = await calculateUserBalance('user-1');

    expect(result.personalBalance).toBe(1500);
    expect(result.groupNet).toBe(10);
    expect(result.totalBalance).toBe(1510);
    expect(result.groupsBreakdown).toHaveLength(2);
  });

  it('handles confirmed settlements reducing group net correctly', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      {
        id: 'mem-1',
        group: {
          id: 'g1',
          name: 'Settled Group',
          currency: 'EUR',
          members: [
            { id: 'mem-1', displayName: 'Alice', weight: { toString: () => '1' } },
            { id: 'mem-2', displayName: 'Bob', weight: { toString: () => '1' } },
          ],
          expenses: [
            {
              id: 'e1',
              payerMemberId: 'mem-1',
              amount: { toString: () => '100' },
              splitMethod: 'equal',
              splits: [
                { memberId: 'mem-1', shareAmount: { toString: () => '50' }, shareWeight: null },
                { memberId: 'mem-2', shareAmount: { toString: () => '50' }, shareWeight: null },
              ],
            },
          ],
          settlements: [
            {
              fromMemberId: 'mem-2',
              toMemberId: 'mem-1',
              amount: { toString: () => '20' },
              status: 'confirmed',
            },
          ],
        },
      },
    ]);

    const result = await calculateUserBalance('user-1');

    expect(result.groupNet).toBe(30);
    expect(result.totalBalance).toBe(30);
  });

  it('handles group with null weights and null shareAmounts', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      {
        id: 'mem-1',
        group: {
          id: 'g1',
          name: 'Null Weights Group',
          currency: 'EUR',
          members: [
            { id: 'mem-1', displayName: 'Alice', weight: null },
            { id: 'mem-2', displayName: 'Bob', weight: null },
          ],
          expenses: [
            {
              id: 'e1',
              payerMemberId: 'mem-2',
              amount: { toString: () => '60' },
              splitMethod: 'equal',
              splits: [
                { memberId: 'mem-1', shareAmount: null, shareWeight: null },
                { memberId: 'mem-2', shareAmount: null, shareWeight: null },
              ],
            },
          ],
          settlements: [],
        },
      },
    ]);

    const result = await calculateUserBalance('user-1');

    expect(result.groupNet).toBe(-30);
    expect(result.totalBalance).toBe(0);
  });
});
