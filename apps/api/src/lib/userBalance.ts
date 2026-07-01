import { calculateGroupBalances, toCents } from './groupBalances.js';
import { calculateUserBalanceSummary } from '../domain/personal-finance/services/calculate-user-balance.service.js';
import { prisma } from '../db/prisma.js';

type UserGroupMembership = {
  id: string;
  group: {
    id: string;
    name: string;
    currency: string;
    members: Array<{
      id: string;
      displayName: string;
      weight: { toString(): string } | null;
    }>;
    expenses: Array<{
      id: string;
      payerMemberId: string;
      amount: { toString(): string };
      splitMethod: string;
      splits: Array<{
        memberId: string;
        shareAmount: { toString(): string } | null;
        shareWeight: { toString(): string } | null;
      }>;
    }>;
    settlements: Array<{
      fromMemberId: string;
      toMemberId: string;
      amount: { toString(): string };
      status: string;
    }>;
  };
};

const toNumber = (value: { toString(): string } | null) => {
  if (!value) return null;
  const amount = Number(value.toString());
  return Number.isFinite(amount) ? amount : null;
};

const calculateGroupNetForMembership = (membership: UserGroupMembership) => {
  const balances = calculateGroupBalances({
    members: membership.group.members.map(member => ({
      id: member.id,
      displayName: member.displayName,
      weight: toNumber(member.weight),
    })),
    expenses: membership.group.expenses.map(expense => ({
      id: expense.id,
      payerMemberId: expense.payerMemberId,
      amount: Number(expense.amount.toString()),
      splitMethod: expense.splitMethod as 'equal' | 'manual' | 'weights',
      splits: expense.splits.map(split => ({
        memberId: split.memberId,
        shareAmount: toNumber(split.shareAmount),
        shareWeight: toNumber(split.shareWeight),
      })),
    })),
    settlements: membership.group.settlements.map(settlement => ({
      fromMemberId: settlement.fromMemberId,
      toMemberId: settlement.toMemberId,
      amount: Number(settlement.amount.toString()),
      status: settlement.status,
    })),
  });

  const currentMemberBalance = balances.find(balance => balance.memberId === membership.id);

  return {
    groupId: membership.group.id,
    groupName: membership.group.name,
    currency: membership.group.currency,
    memberId: membership.id,
    netCents: currentMemberBalance?.netCents || 0,
  };
};

export const calculateUserBalance = async (userId: string) => {
  const [transactions, memberships] = await Promise.all([
    prisma.personalTransaction.findMany({
      where: { userId },
      select: {
        type: true,
        amount: true,
      },
    }),
    prisma.groupMember.findMany({
      where: { userId },
      select: {
        id: true,
        group: {
          select: {
            id: true,
            name: true,
            currency: true,
            members: {
              orderBy: { id: 'asc' },
              select: {
                id: true,
                displayName: true,
                weight: true,
              },
            },
            expenses: {
              select: {
                id: true,
                payerMemberId: true,
                amount: true,
                splitMethod: true,
                splits: {
                  select: {
                    memberId: true,
                    shareAmount: true,
                    shareWeight: true,
                  },
                },
              },
            },
            settlements: {
              select: {
                fromMemberId: true,
                toMemberId: true,
                amount: true,
                status: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return calculateUserBalanceSummary({
    transactions: transactions.map(transaction => ({
      type: transaction.type === 'income' ? 'income' : 'expense',
      amountCents: toCents(Number(transaction.amount.toString())),
    })),
    groupNets: memberships.map(calculateGroupNetForMembership),
  });
};
