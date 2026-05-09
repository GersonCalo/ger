export type AppTab = 'home' | 'transactions' | 'groups' | 'profile';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  createdAt?: string;
};

export type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  userId: string | null;
  groupId: string | null;
};

export type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: string;
  category: Category | null;
  note: string | null;
  occurredAt: string;
  sourceType: 'manual' | 'group_expense' | 'group_settlement_paid' | 'group_settlement_received';
  sourceRefId: string | null;
  locked: boolean;
  groupId: string | null;
  groupName: string | null;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type ApiHealth = {
  status: string;
  env: string;
};

export type GlobalBalancePayload = {
  personalIncome: number;
  personalExpense: number;
  personalBalance: number;
  groupNet: number;
  totalBalance: number;
  groupsBreakdown: Array<{
    groupId: string;
    groupName: string;
    currency: string;
    memberId: string;
    net: number;
  }>;
};

export type GroupMember = {
  id: string;
  userId: string | null;
  displayName: string;
  kind: 'user' | 'guest';
  weight: number | null;
  role: 'member' | 'admin';
  leftAt: string | null;
};

export type GroupExpenseSplit = {
  id: string;
  memberId: string;
  shareAmount: number | null;
  shareWeight: number | null;
};

export type GroupExpenseSplitInput = {
  memberId: string;
  shareAmount: number;
};

export type GroupExpense = {
  id: string;
  description: string | null;
  amount: number;
  payerMemberId: string;
  category: Category | null;
  categoryId: string | null;
  splitMethod: 'equal' | 'manual' | 'weights';
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

export type GroupJoinCodePayload = {
  groupId: string;
  groupName: string;
  joinCode: string;
};

export type JoinGroupByCodePayload = {
  group: GroupSummary;
  message: string;
};

export type TransactionListFilters = {
  from?: string;
  to?: string;
  type?: 'income' | 'expense';
  origin?: 'manual' | 'group';
  cursor?: string;
  limit?: number;
};

export type TransactionListResponse = {
  transactions: Transaction[];
  nextCursor: string | null;
  hasMore: boolean;
};
