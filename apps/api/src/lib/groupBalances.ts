type BalanceMember = {
  id: string;
  displayName: string;
  weight: number | null;
};

type BalanceExpense = {
  id: string;
  payerMemberId: string;
  amount: number;
  splitMethod: 'equal' | 'weights';
  splits: Array<{
    memberId: string;
    shareAmount: number | null;
    shareWeight: number | null;
  }>;
};

type BalanceSettlement = {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  status: string;
};

type GroupBalancesInput = {
  members: BalanceMember[];
  expenses: BalanceExpense[];
  settlements: BalanceSettlement[];
};

export const toCents = (amount: number) => Math.round(amount * 100);
export const fromCents = (amount: number) => Number((amount / 100).toFixed(2));
export const roundMoney = (amount: number) => fromCents(toCents(amount));

const computeSharesFromWeights = (amountCents: number, members: BalanceMember[]) => {
  const orderedMembers = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const weights = orderedMembers.map(member => {
    const value = member.weight ?? 1;
    return value > 0 ? value : 1;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || orderedMembers.length || 1;

  let assigned = 0;

  return orderedMembers.map((member, index) => {
    if (index === orderedMembers.length - 1) {
      return {
        memberId: member.id,
        shareCents: amountCents - assigned,
      };
    }

    const shareCents = Math.floor((amountCents * weights[index]) / totalWeight);
    assigned += shareCents;

    return {
      memberId: member.id,
      shareCents,
    };
  });
};

const computeSharesFromExpense = (expense: BalanceExpense, members: BalanceMember[]) => {
  if (expense.splits.length > 0 && expense.splits.every(split => typeof split.shareAmount === 'number')) {
    return expense.splits.map(split => ({
      memberId: split.memberId,
      shareCents: toCents(split.shareAmount || 0),
    }));
  }

  const amountCents = toCents(expense.amount);

  if (expense.splitMethod === 'weights') {
    return computeSharesFromWeights(amountCents, members);
  }

  const orderedMembers = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const baseShare = Math.floor(amountCents / (orderedMembers.length || 1));
  let remainder = amountCents - baseShare * orderedMembers.length;

  return orderedMembers.map(member => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);

    return {
      memberId: member.id,
      shareCents: baseShare + extra,
    };
  });
};

export const calculateGroupBalances = ({ expenses, members, settlements }: GroupBalancesInput) => {
  const balances = new Map(
    members.map(member => [
      member.id,
      {
        memberId: member.id,
        memberName: member.displayName,
        paidCents: 0,
        owesCents: 0,
        settledInCents: 0,
        settledOutCents: 0,
      },
    ])
  );

  for (const expense of expenses) {
    const payer = balances.get(expense.payerMemberId);
    if (payer) {
      payer.paidCents += toCents(expense.amount);
    }

    const shares = computeSharesFromExpense(expense, members);

    for (const share of shares) {
      const member = balances.get(share.memberId);
      if (member) {
        member.owesCents += share.shareCents;
      }
    }
  }

  for (const settlement of settlements) {
    if (settlement.status !== 'confirmed') continue;

    const fromMember = balances.get(settlement.fromMemberId);
    const toMember = balances.get(settlement.toMemberId);
    const amountCents = toCents(settlement.amount);

    if (fromMember) {
      fromMember.settledOutCents += amountCents;
    }

    if (toMember) {
      toMember.settledInCents += amountCents;
    }
  }

  return [...balances.values()].map(balance => {
    const netCents =
      balance.paidCents - balance.owesCents + balance.settledOutCents - balance.settledInCents;

    return {
      memberId: balance.memberId,
      memberName: balance.memberName,
      paid: fromCents(balance.paidCents),
      owes: fromCents(balance.owesCents),
      settledIn: fromCents(balance.settledInCents),
      settledOut: fromCents(balance.settledOutCents),
      net: fromCents(netCents),
      netCents,
    };
  });
};

export const calculateSettlementSuggestions = (
  balances: Array<{ memberId: string; memberName: string; netCents: number }>
) => {
  const creditors = balances
    .filter(balance => balance.netCents > 0)
    .map(balance => ({ ...balance, remainingCents: balance.netCents }))
    .sort((a, b) => b.remainingCents - a.remainingCents);

  const debtors = balances
    .filter(balance => balance.netCents < 0)
    .map(balance => ({ ...balance, remainingCents: Math.abs(balance.netCents) }))
    .sort((a, b) => b.remainingCents - a.remainingCents);

  const suggestions: Array<{ fromMemberId: string; fromMemberName: string; toMemberId: string; toMemberName: string; amount: number }> = [];

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountCents = Math.min(creditor.remainingCents, debtor.remainingCents);

    if (amountCents > 0) {
      suggestions.push({
        fromMemberId: debtor.memberId,
        fromMemberName: debtor.memberName,
        toMemberId: creditor.memberId,
        toMemberName: creditor.memberName,
        amount: fromCents(amountCents),
      });
    }

    creditor.remainingCents -= amountCents;
    debtor.remainingCents -= amountCents;

    if (creditor.remainingCents <= 0) creditorIndex += 1;
    if (debtor.remainingCents <= 0) debtorIndex += 1;
  }

  return suggestions;
};
