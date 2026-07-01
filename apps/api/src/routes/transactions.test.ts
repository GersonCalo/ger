import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

vi.mock('../db/prisma.js', () => {
  const createMockTx = () => ({
    groupMember: { findMany: vi.fn().mockResolvedValue([]) },
    groupExpense: { findMany: vi.fn().mockResolvedValue([]) },
    groupSettlement: { findMany: vi.fn().mockResolvedValue([]) },
    personalTransaction: {
      groupBy: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    budget: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    budgetAlert: { create: vi.fn() },
    category: { findFirst: vi.fn(), findUnique: vi.fn() },
  });
  const mockTx = createMockTx();
  return {
    prisma: {
      category: { findFirst: vi.fn(), findUnique: vi.fn() },
      budget: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      budgetAlert: { create: vi.fn() },
      personalTransaction: {
        groupBy: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockTx)),
    },
  };
});

vi.mock('../middlewares/requireAuth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    res.locals.userId = 'user-1';
    next();
  },
}));

vi.mock('../lib/push.js', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

import { transactionsRouter } from './transactions';
import { prisma } from '../db/prisma.js';

const mockPrisma = vi.mocked(prisma);

const createMockTx = () => ({
  groupMember: { findMany: vi.fn().mockResolvedValue([]) },
  groupExpense: { findMany: vi.fn().mockResolvedValue([]) },
  groupSettlement: { findMany: vi.fn().mockResolvedValue([]) },
  personalTransaction: {
    groupBy: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  budget: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  budgetAlert: { create: vi.fn() },
  category: { findFirst: vi.fn(), findUnique: vi.fn() },
});

const VALID_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440000';

const makeRequest = async (method: string, path: string, body?: Record<string, unknown>, query?: Record<string, unknown>): Promise<{ status: number; body: any }> => {
  const app = express();
  app.use(express.json());
  app.use(transactionsRouter);
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.originalUrl} not found` } });
  });

  const qs = query ? '?' + new URLSearchParams(query as Record<string, string>).toString() : '';
  const url = path + qs;

  const fetchOptions: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer fake-token' },
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      const fullUrl = `http://localhost:${port}${url}`;
      try {
        const response = await fetch(fullUrl, fetchOptions);
        const text = await response.text();
        let jsonBody = null;
        try { jsonBody = text ? JSON.parse(text) : null; } catch { jsonBody = null; }
        server.close(() => resolve({ status: response.status, body: jsonBody }));
      } catch (err: any) {
        server.close(() => resolve({ status: 500, body: { error: err.message } }));
      }
    });
  });
};

beforeEach(() => { vi.clearAllMocks(); });

describe('POST /transactions - budget alerts', () => {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  it('returns alertsTriggered when expense crosses 80% threshold', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: VALID_CATEGORY_ID, userId: 'user-1', groupId: null });

    const mockTx = createMockTx();
    mockTx.personalTransaction.create.mockResolvedValue({
      id: 'tx-1', type: 'expense', amount: 80, categoryId: VALID_CATEGORY_ID,
      category: { id: VALID_CATEGORY_ID, name: 'Comida', type: 'expense', color: '#FF0000', icon: '🍕' },
      occurredAt: now, note: null, sourceType: 'manual', sourceRefId: null,
      locked: false, groupId: null, group: null, userId: 'user-1',
    });
    mockTx.personalTransaction.groupBy.mockResolvedValue([
      { categoryId: VALID_CATEGORY_ID, _sum: { amount: { toString: () => '80' } } },
    ]);
    mockTx.budget.findMany.mockResolvedValue([
      { id: 'budget-1', categoryId: VALID_CATEGORY_ID, amount: 100 },
    ]);
    mockTx.budgetAlert.create.mockResolvedValue({ id: 'alert-1' });
    mockTx.category.findUnique.mockResolvedValue({ name: 'Comida' });

    (mockPrisma.$transaction as any).mockImplementation(async (cb) => cb(mockTx));

    const result = await makeRequest('POST', '/transactions', {
      type: 'expense', amount: 80, categoryId: VALID_CATEGORY_ID,
    });

    expect(result.status).toBe(201);
    expect(result.body.alertsTriggered).toBeDefined();
    expect(result.body.alertsTriggered).toHaveLength(1);
    expect(result.body.alertsTriggered[0].threshold).toBe(80);
    expect(result.body.alertsTriggered[0].categoryName).toBe('Comida');
  });

  it('does not return alertsTriggered for income transactions', async () => {
    mockPrisma.personalTransaction.create.mockResolvedValue({
      id: 'tx-2', type: 'income', amount: 500, categoryId: null, category: null,
      occurredAt: now, note: null, sourceType: 'manual', sourceRefId: null,
      locked: false, groupId: null, group: null, userId: 'user-1',
    });

    const result = await makeRequest('POST', '/transactions', { type: 'income', amount: 500 });

    expect(result.status).toBe(201);
    expect(result.body.alertsTriggered).toBeUndefined();
  });

  it('does not return alertsTriggered for expense without category', async () => {
    mockPrisma.personalTransaction.create.mockResolvedValue({
      id: 'tx-3', type: 'expense', amount: 50, categoryId: null, category: null,
      occurredAt: now, note: null, sourceType: 'manual', sourceRefId: null,
      locked: false, groupId: null, group: null, userId: 'user-1',
    });

    const result = await makeRequest('POST', '/transactions', { type: 'expense', amount: 50 });

    expect(result.status).toBe(201);
    expect(result.body.alertsTriggered).toBeUndefined();
  });

  it('does not duplicate alert when threshold already sent (unique constraint)', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: VALID_CATEGORY_ID, userId: 'user-1', groupId: null });

    const mockTx = createMockTx();
    mockTx.personalTransaction.create.mockResolvedValue({
      id: 'tx-4', type: 'expense', amount: 90, categoryId: VALID_CATEGORY_ID,
      category: { id: VALID_CATEGORY_ID, name: 'Comida', type: 'expense', color: '#FF0000', icon: '🍕' },
      occurredAt: now, note: null, sourceType: 'manual', sourceRefId: null,
      locked: false, groupId: null, group: null, userId: 'user-1',
    });
    mockTx.personalTransaction.groupBy.mockResolvedValue([
      { categoryId: VALID_CATEGORY_ID, _sum: { amount: { toString: () => '90' } } },
    ]);
    mockTx.budget.findMany.mockResolvedValue([
      { id: 'budget-1', categoryId: VALID_CATEGORY_ID, amount: 100 },
    ]);
    const uniqueError = new Error('Unique constraint failed');
    (uniqueError as any).code = 'P2002';
    mockTx.budgetAlert.create.mockRejectedValue(uniqueError);
    mockTx.category.findUnique.mockResolvedValue({ name: 'Comida' });

    (mockPrisma.$transaction as any).mockImplementation(async (cb) => cb(mockTx));

    const result = await makeRequest('POST', '/transactions', {
      type: 'expense', amount: 90, categoryId: VALID_CATEGORY_ID,
    });

    expect(result.status).toBe(201);
    expect(result.body.alertsTriggered).toBeUndefined();
  });
});

describe('PATCH /transactions/:id - budget alerts', () => {
  const CAT_OLD_ID = '550e8400-e29b-41d4-a716-446655440001';
  const CAT_NEW_ID = '550e8400-e29b-41d4-a716-446655440002';

  it('checks both old and new month/category when transaction is moved', async () => {
    const oldDate = new Date(Date.UTC(2025, 2, 15));
    const newDate = new Date(Date.UTC(2025, 4, 15));

    const mockTx = createMockTx();
    mockTx.personalTransaction.update.mockResolvedValue({
      id: 'tx-1', type: 'expense', amount: 100, categoryId: CAT_NEW_ID,
      category: { id: CAT_NEW_ID, name: 'Transporte', type: 'expense', color: '#00FF00', icon: '🚗' },
      occurredAt: newDate, note: null, sourceType: 'manual', sourceRefId: null,
      locked: false, groupId: null, group: null, userId: 'user-1',
    });
    mockTx.personalTransaction.groupBy.mockResolvedValue([]);
    mockTx.budget.findMany.mockResolvedValue([]);

    (mockPrisma.$transaction as any).mockImplementation(async (cb) => cb(mockTx));

    mockPrisma.personalTransaction.findFirst.mockResolvedValue({
      id: 'tx-1', locked: false, type: 'expense', categoryId: CAT_OLD_ID, occurredAt: oldDate,
    });
    mockPrisma.category.findFirst.mockResolvedValue({ id: CAT_NEW_ID, userId: 'user-1', groupId: null });

    const result = await makeRequest('PATCH', '/transactions/tx-1', {
      categoryId: CAT_NEW_ID, occurredAt: newDate.toISOString(), amount: 100,
    });

    expect(result.status).toBe(200);
    expect(mockTx.budget.findMany).toHaveBeenCalled();
  });
});
