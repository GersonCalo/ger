import type { ApiHealth, AuthResponse, AuthUser, Transaction } from '@/types';

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
    input: { type: 'income' | 'expense'; amount: number; category?: string; note?: string; occurredAt: string }
  ) {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify(input),
    });

    const data = await parseJson<{ transaction: Transaction }>(response);
    return data.transaction;
  },
};
