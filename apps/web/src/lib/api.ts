import type {
  ApiHealth,
  AuthResponse,
  AuthUser,
  Budget,
  BudgetListFilters,
  Category,
  CreateBudgetInput,
  GlobalBalancePayload,
  GroupBalancesPayload,
  GroupExpense,
  GroupExpenseSplitInput,
  GroupJoinCodePayload,
  GroupMember,
  GroupSettlement,
  GroupSummary,
  Transaction,
  TransactionListFilters,
  TransactionListResponse,
} from '@/types';

const API_URL: string = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL || 'http://localhost:8080';
const API_BASE = `${API_URL}/api/v1`;

const parseJson = async <T>(response: Response) => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const baseMessage = payload?.error?.message ?? payload?.message ?? `Error ${response.status}`;
    const details = payload?.error?.details;
    let message = baseMessage;

    if (details?.issues && Array.isArray(details.issues)) {
      const issueMessages = details.issues.map((issue: { path?: (string | number)[]; message?: string }) => {
        const field = issue.path?.join('.') ?? 'campo';
        return `${field}: ${issue.message ?? 'inválido'}`;
      });
      message = `${baseMessage}. ${issueMessages.join('; ')}`;
    }

    throw new Error(message);
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

const createCsvHeaders = (token?: string) => {
  const headers = new Headers();
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
  async transactions(token: string, filters?: TransactionListFilters) {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.origin) params.set('origin', filters.origin);
    if (filters?.cursor) params.set('cursor', filters.cursor);
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));

    const qs = params.toString();
    const url = `${API_BASE}/transactions${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, {
      headers: createHeaders(token),
    });

    return parseJson<TransactionListResponse>(response);
  },
  async exportTransactionsCsv(token: string, filters?: TransactionListFilters) {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.origin) params.set('origin', filters.origin);

    const qs = params.toString();
    const url = `${API_BASE}/transactions/export.csv${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, {
      headers: createCsvHeaders(token),
    });

    if (!response.ok) {
      const text = await response.text();
      let message = `Error ${response.status}`;
      try {
        const payload = JSON.parse(text);
        message = payload?.error?.message ?? message;
      } catch {
        // not JSON
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : 'movimientos.csv';

    return { blob, filename };
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
      idempotencyKey: string;
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
  async deleteGroupMember(token: string, groupId: string, memberId: string) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
      headers: createHeaders(token),
    });

    if (response.status === 204) {
      return;
    }

    const data = await parseJson<{ message: string }>(response);
    throw new Error(data.message || 'Error eliminando miembro');
  },
  async rejoinGroupMember(token: string, groupId: string, memberId: string) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/members/${memberId}/rejoin`, {
      method: 'POST',
      headers: createHeaders(token),
    });

    const data = await parseJson<{ member: GroupMember }>(response);
    return data.member;
  },
  async getVapidPublicKey(token: string) {
    const response = await fetch(`${API_BASE}/push/vapid-public-key`, {
      headers: createHeaders(token),
    });

    const data = await parseJson<{ publicKey: string }>(response);
    return data;
  },
  async subscribeToPush(
    token: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  ) {
    const response = await fetch(`${API_BASE}/push/subscribe`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(subscription),
    });

    if (response.status === 204) return;
    await parseJson(response);
  },
  async createSettlement(
    token: string,
    groupId: string,
    input: { fromMemberId: string; toMemberId: string; amount: number; occurredAt: string; idempotencyKey: string }
  ) {
    const response = await fetch(`${API_BASE}/groups/${groupId}/settlements`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ settlement: GroupSettlement }>(response);
    return data.settlement;
  },
  async updateTransaction(
    token: string,
    id: string,
    input: { type?: 'income' | 'expense'; amount?: number; categoryId?: string | null; note?: string | null; occurredAt?: string }
  ) {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'PATCH',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ transaction: Transaction }>(response);
    return data.transaction;
  },
  async deleteTransaction(token: string, id: string) {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE',
      headers: createHeaders(token),
    });

    if (response.status === 204) {
      return;
    }

    return parseJson<{ message: string }>(response);
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
  async getBudgets(token: string, filters?: BudgetListFilters) {
    const params = new URLSearchParams();
    if (filters?.month !== undefined) params.set('month', String(filters.month));
    if (filters?.year !== undefined) params.set('year', String(filters.year));
    if (filters?.period !== undefined) params.set('period', filters.period);
    if (filters?.categoryId !== undefined) params.set('categoryId', filters.categoryId);

    const qs = params.toString();
    const url = `${API_BASE}/budgets${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, {
      headers: createHeaders(token),
    });

    const data = await parseJson<{ budgets: Budget[] }>(response);
    return data.budgets;
  },
  async createBudget(token: string, input: CreateBudgetInput) {
    const response = await fetch(`${API_BASE}/budgets`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ budgets: Budget[]; duplicates?: Array<{ month: number; year: number }> }>(response);
    return { budgets: data.budgets, duplicates: data.duplicates };
  },
};
