import type {
  ApiHealth,
  AuthResponse,
  AuthUser,
  Category,
  GlobalBalancePayload,
  GroupBalancesPayload,
  GroupExpense,
  GroupExpenseSplitInput,
  GroupJoinCodePayload,
  GroupMember,
  GroupSettlement,
  GroupSummary,
  Transaction,
} from '@/types';

const API_URL: string = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL || 'http://localhost:8080';
const API_BASE = `${API_URL}/api/v1`;

const parseJson = async <T>(response: Response) => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || `Error ${response.status}`);
  }

  return payload as T;
};

const createHeaders = (token?: string) => {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
};

export const api = {
  baseUrl: API_BASE,
  async health() {
    const response = await fetch(`${API_BASE}/health`);
    return parseJson<ApiHealth>(response);
  },
  async login(input: { email: string; password: string }) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(input),
    });

    return parseJson<AuthResponse>(response);
  },
  async register(input: { email: string; password: string; name?: string }) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(input),
    });

    return parseJson<AuthResponse>(response);
  },
  async me(token: string) {
    const response = await fetch(`${API_BASE}/me`, {
      headers: createHeaders(token),
    });

    const data = await parseJson<{ user: AuthUser }>(response);
    return data.user;
  },
  async transactions(token: string) {
    const response = await fetch(`${API_BASE}/transactions`, {
      headers: createHeaders(token),
    });

    const data = await parseJson<{ transactions: Transaction[] }>(response);
    return data.transactions;
  },
  async createTransaction(
    token: string,
    input: { type: 'income' | 'expense'; amount: number; categoryId?: string; note?: string; occurredAt: string }
  ) {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ transaction: Transaction }>(response);
    return data.transaction;
  },
  async getCategories(token: string) {
    const response = await fetch(`${API_BASE}/categories`, {
      headers: createHeaders(token),
    });

    const data = await parseJson<{ categories: Category[] }>(response);
    return data.categories;
  },
  async createCategory(
    token: string,
    input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }
  ) {
    const response = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ category: Category }>(response);
    return data.category;
  },
  async updateCategory(
    token: string,
    categoryId: string,
    input: { name?: string; color?: string; icon?: string }
  ) {
    const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
      method: 'PATCH',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ category: Category }>(response);
    return data.category;
  },
  async deleteCategory(token: string, categoryId: string) {
    const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: createHeaders(token),
    });

    return parseJson<{ message: string }>(response);
  },
  async getGroupCategories(token: string, groupId: string) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/categories`, {
      headers: createHeaders(token),
    });

    const data = await parseJson<{ categories: Category[] }>(response);
    return data.categories;
  },
  async createGroupCategory(
    token: string,
    groupId: string,
    input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }
  ) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/categories`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ category: Category }>(response);
    return data.category;
  },
  async updateGroupCategory(
    token: string,
    groupId: string,
    categoryId: string,
    input: { name?: string; color?: string; icon?: string }
  ) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/categories/${categoryId}`, {
      method: 'PATCH',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ category: Category }>(response);
    return data.category;
  },
  async deleteGroupCategory(token: string, groupId: string, categoryId: string) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: createHeaders(token),
    });

    return parseJson<{ message: string }>(response);
  },
  async balance(token: string) {
    const response = await fetch(`${API_BASE}/balance`, {
      headers: createHeaders(token),
    });

    return parseJson<GlobalBalancePayload>(response);
  },
  async groups(token: string) {
    const response = await fetch(`${API_BASE}/groups`, {
      headers: createHeaders(token),
    });

    const data = await parseJson<{ groups: GroupSummary[] }>(response);
    return data.groups;
  },
  async createGroup(
    token: string,
    input: {
      name: string;
      currency?: string;
      members?: Array<{ userId?: string; displayName?: string; weight?: number | null; role?: 'member' | 'admin' }>;
    }
  ) {
    const response = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ group: GroupSummary }>(response);
    return data.group;
  },
  async joinGroupByCode(token: string, code: string) {
    const response = await fetch(`${API_BASE}/groups/join-by-code`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify({ code }),
    });

    return parseJson<{ group: GroupSummary }>(response);
  },
  async groupJoinCode(token: string, groupId: string) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/join-code`, {
      headers: createHeaders(token),
    });

    return parseJson<GroupJoinCodePayload>(response);
  },
  async groupBalances(token: string, groupId: string) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/balances`, {
      headers: createHeaders(token),
    });

    return parseJson<GroupBalancesPayload>(response);
  },
  async createGroupExpense(
    token: string,
    groupId: string,
    input: {
      description: string;
      amount: number;
      payerMemberId: string;
      categoryId?: string;
      splitMethod: 'equal' | 'manual' | 'weights';
      splits?: GroupExpenseSplitInput[];
      occurredAt: string;
    }
  ) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/expenses`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ expense: GroupExpense }>(response);
    return data.expense;
  },
  async updateGroupExpense(
    token: string,
    groupId: string,
    expenseId: string,
    input: {
      description: string;
      amount: number;
      payerMemberId: string;
      categoryId?: string;
      splitMethod: 'equal' | 'manual' | 'weights';
      splits?: GroupExpenseSplitInput[];
      occurredAt: string;
    }
  ) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ expense: GroupExpense }>(response);
    return data.expense;
  },
  async createGroupMember(
    token: string,
    groupId: string,
    input: { userId?: string; displayName?: string; weight?: number | null; role?: 'member' | 'admin' }
  ) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/members`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ member: GroupMember }>(response);
    return data.member;
  },
  async createSettlement(
    token: string,
    groupId: string,
    input: { fromMemberId: string; toMemberId: string; amount: number; occurredAt: string }
  ) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/settlements`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ settlement: GroupSettlement }>(response);
    return data.settlement;
  },
  async updateSettlementStatus(
    token: string,
    groupId: string,
    settlementId: string,
    status: 'confirmed' | 'cancelled'
  ) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/settlements/${settlementId}`, {
      method: 'PUT',
      headers: createHeaders(token),
      body: JSON.stringify({ status }),
    });

    const data = await parseJson<{ settlement: GroupSettlement }>(response);
    return data.settlement;
  },
};
