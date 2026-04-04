const toNumber = (value: { toString(): string } | number | string | null | undefined) => {
  if (value == null) return null;
  const nextValue = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(nextValue) ? nextValue : null;
};

export const serializeGroupMember = (member: {
  id: string;
  userId: string | null;
  displayName: string;
  weight: { toString(): string } | number | string | null;
  role: string;
}) => ({
  id: member.id,
  userId: member.userId,
  displayName: member.displayName,
  weight: toNumber(member.weight),
  role: member.role,
  kind: member.userId ? 'user' : 'guest',
});

export const serializeGroupExpense = (expense: {
  id: string;
  payerMemberId: string;
  amount: { toString(): string } | number | string;
  description: string | null;
  occurredAt: Date;
  splitMethod: string;
  splits?: Array<{
    id: string;
    memberId: string;
    shareAmount: { toString(): string } | number | string | null;
    shareWeight: { toString(): string } | number | string | null;
  }>;
}) => ({
  id: expense.id,
  payerMemberId: expense.payerMemberId,
  amount: toNumber(expense.amount) || 0,
  description: expense.description,
  occurredAt: expense.occurredAt.toISOString(),
  splitMethod: expense.splitMethod,
  splits: (expense.splits || []).map(split => ({
    id: split.id,
    memberId: split.memberId,
    shareAmount: toNumber(split.shareAmount),
    shareWeight: toNumber(split.shareWeight),
  })),
});

export const serializeGroupSettlement = (settlement: {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: { toString(): string } | number | string;
  occurredAt: Date;
  status: string;
}) => ({
  id: settlement.id,
  fromMemberId: settlement.fromMemberId,
  toMemberId: settlement.toMemberId,
  amount: toNumber(settlement.amount) || 0,
  occurredAt: settlement.occurredAt.toISOString(),
  status: settlement.status,
});

export const serializeGroupSummary = (group: {
  id: string;
  name: string;
  currency: string;
  createdAt: Date;
  members: Array<{
    id: string;
    userId: string | null;
    displayName: string;
    weight: { toString(): string } | number | string | null;
    role: string;
  }>;
  expenses: Array<{
    id: string;
    payerMemberId: string;
    amount: { toString(): string } | number | string;
    description: string | null;
    occurredAt: Date;
    splitMethod: string;
    splits?: Array<{
      id: string;
      memberId: string;
      shareAmount: { toString(): string } | number | string | null;
      shareWeight: { toString(): string } | number | string | null;
    }>;
  }>;
}) => ({
  id: group.id,
  name: group.name,
  currency: group.currency,
  createdAt: group.createdAt.toISOString(),
  membersCount: group.members.length,
  expensesCount: group.expenses.length,
  members: group.members.map(serializeGroupMember),
  expenses: group.expenses.map(serializeGroupExpense),
});
