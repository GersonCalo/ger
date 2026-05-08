import { calculateGroupBalances, fromCents, toCents } from './groupBalances.js';
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

type UserGroupNet = ReturnType<typeof calculateGroupNetForMembership>;

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

  let personalIncomeCents = 0;
  let personalExpenseCents = 0;

  for (const transaction of transactions) {
    const amountCents = toCents(Number(transaction.amount.toString()));

    if (transaction.type === 'income') {
      personalIncomeCents += amountCents;
    } else {
      personalExpenseCents += amountCents;
    }
  }

  const groupsBreakdown = memberships.map(calculateGroupNetForMembership);
  const groupNetCents = groupsBreakdown.reduce((sum: number, group: UserGroupNet) => sum + group.netCents, 0);
  const personalBalanceCents = personalIncomeCents - personalExpenseCents;
  const totalBalanceCents = personalBalanceCents + Math.max(groupNetCents, 0);

  return {
    personalIncome: fromCents(personalIncomeCents),
    personalExpense: fromCents(personalExpenseCents),
    personalBalance: fromCents(personalBalanceCents),
    groupNet: fromCents(groupNetCents),
    totalBalance: fromCents(totalBalanceCents),
    groupsBreakdown: groupsBreakdown.map((group: UserGroupNet) => ({
      groupId: group.groupId,
      groupName: group.groupName,
      currency: group.currency,
      memberId: group.memberId,
      net: fromCents(group.netCents),
    })),
  };
};
