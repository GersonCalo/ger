import type { GroupBalance, GroupExpense, GroupMember, LocalGroup } from '@/types';

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createStarterGroup = (userName: string | null, currency: string): LocalGroup => ({
  id: createId(),
  name: 'Piso compartido',
  currency,
  createdAt: new Date().toISOString(),
  members: [
    { id: createId(), name: userName || 'Tú', kind: 'me', weight: 1 },
    { id: createId(), name: 'Lucía', kind: 'guest', weight: 1 },
    { id: createId(), name: 'Álex', kind: 'guest', weight: 1 },
  ],
  expenses: [],
});

const shareByWeights = (amount: number, members: GroupMember[]) => {
  const totalWeight = members.reduce((sum, member) => sum + member.weight, 0) || members.length || 1;
  return members.map(member => ({
    memberId: member.id,
    share: roundCurrency((amount * member.weight) / totalWeight),
  }));
};

const shareEqually = (amount: number, members: GroupMember[]) => {
  const count = members.length || 1;
  const share = roundCurrency(amount / count);

  return members.map(member => ({
    memberId: member.id,
    share,
  }));
};

const splitExpense = (expense: GroupExpense, members: GroupMember[]) =>
  expense.splitMethod === 'weights' ? shareByWeights(expense.amount, members) : shareEqually(expense.amount, members);

export const calculateGroupBalances = (group: LocalGroup): GroupBalance[] => {
  const paidMap = new Map<string, number>();
  const owesMap = new Map<string, number>();

  for (const member of group.members) {
    paidMap.set(member.id, 0);
    owesMap.set(member.id, 0);
  }

  for (const expense of group.expenses) {
    paidMap.set(expense.payerMemberId, roundCurrency((paidMap.get(expense.payerMemberId) || 0) + expense.amount));

    const shares = splitExpense(expense, group.members);

    for (const share of shares) {
      owesMap.set(share.memberId, roundCurrency((owesMap.get(share.memberId) || 0) + share.share));
    }
  }

  return group.members.map(member => {
    const paid = paidMap.get(member.id) || 0;
    const owes = owesMap.get(member.id) || 0;

    return {
      memberId: member.id,
      memberName: member.name,
      paid,
      owes,
      net: roundCurrency(paid - owes),
    };
  });
};

export const summarizeTransactions = (group: LocalGroup) =>
  group.expenses.reduce(
    (summary, expense) => {
      summary.total += expense.amount;
      summary.count += 1;
      return summary;
    },
    { total: 0, count: 0 }
  );

export const createSettlementSuggestions = (balances: GroupBalance[]) => {
  const creditors = balances
    .filter(balance => balance.net > 0)
    .map(balance => ({ ...balance, remaining: balance.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = balances
    .filter(balance => balance.net < 0)
    .map(balance => ({ ...balance, remaining: Math.abs(balance.net) }))
    .sort((a, b) => b.remaining - a.remaining);

  const suggestions: Array<{ from: string; to: string; amount: number }> = [];

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundCurrency(Math.min(creditor.remaining, debtor.remaining));

    if (amount > 0) {
      suggestions.push({
        from: debtor.memberName,
        to: creditor.memberName,
        amount,
      });
    }

    creditor.remaining = roundCurrency(creditor.remaining - amount);
    debtor.remaining = roundCurrency(debtor.remaining - amount);

    if (creditor.remaining <= 0.01) creditorIndex += 1;
    if (debtor.remaining <= 0.01) debtorIndex += 1;
  }

  return suggestions;
};
