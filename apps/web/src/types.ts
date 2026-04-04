export type AppTab = 'home' | 'transactions' | 'groups' | 'profile';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  createdAt?: string;
};

export type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: string;
  category: string | null;
  note: string | null;
  occurredAt: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type ApiHealth = {
  status: string;
  env: string;
};

export type GroupMember = {
  id: string;
  userId: string | null;
  displayName: string;
  kind: 'user' | 'guest';
  weight: number | null;
  role: 'member' | 'admin';
};

export type GroupExpenseSplit = {
  id: string;
  memberId: string;
  shareAmount: number | null;
  shareWeight: number | null;
};

export type GroupExpense = {
  id: string;
  description: string | null;
  amount: number;
  payerMemberId: string;
  splitMethod: 'equal' | 'weights';
  occurredAt: string;
  splits: GroupExpenseSplit[];
};

export type GroupSummary = {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  membersCount: number;
  expensesCount: number;
  members: GroupMember[];
  expenses: GroupExpense[];
};

export type GroupSettlement = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  occurredAt: string;
  status: 'proposed' | 'confirmed' | 'cancelled';
};

export type GroupBalance = {
  memberId: string;
  memberName: string;
  paid: number;
  owes: number;
  settledIn: number;
  settledOut: number;
  net: number;
};

export type GroupSuggestion = {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
};

export type GroupBalancesPayload = {
  group: {
    id: string;
    name: string;
    currency: string;
    createdAt: string;
  };
  members: GroupMember[];
  expenses: GroupExpense[];
  settlements: GroupSettlement[];
  balances: GroupBalance[];
  suggestions: GroupSuggestion[];
};
