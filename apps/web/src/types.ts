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
  name: string;
  kind: 'me' | 'guest';
  weight: number;
};

export type GroupExpense = {
  id: string;
  description: string;
  amount: number;
  payerMemberId: string;
  splitMethod: 'equal' | 'weights';
  occurredAt: string;
};

export type LocalGroup = {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  members: GroupMember[];
  expenses: GroupExpense[];
};

export type GroupBalance = {
  memberId: string;
  memberName: string;
  paid: number;
  owes: number;
  net: number;
};
