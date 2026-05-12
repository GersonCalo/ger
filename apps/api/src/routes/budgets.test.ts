import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    category: {
      findFirst: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../middlewares/requireAuth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    res.locals.userId = 'user-1';
    next();
  },
}));

import { budgetsRouter } from './budgets';
import { prisma } from '../db/prisma.js';

const mockPrisma = vi.mocked(prisma);

const VALID_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_CATEGORY_ID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const makeRequest = async (method: string, path: string, body?: Record<string, unknown>, query?: Record<string, unknown>): Promise<{ status: number; body: any }> => {
  const app = express();
  app.use(express.json());
  app.use(budgetsRouter);
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.originalUrl} not found` } });
  });

  const qs = query ? '?' + new URLSearchParams(query as Record<string, string>).toString() : '';
  const url = path + qs;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer fake-token',
    },
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
        try {
          jsonBody = text ? JSON.parse(text) : null;
        } catch {
          jsonBody = null;
        }
        server.close(() => {
          resolve({ status: response.status, body: jsonBody });
        });
      } catch (err: any) {
        server.close(() => {
          resolve({ status: 500, body: { error: err.message } });
        });
      }
    });
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /budgets', () => {
  it('returns all budgets for the authenticated user', async () => {
    mockPrisma.budget.findMany.mockResolvedValue([
      {
        id: 'budget-1',
        userId: 'user-1',
        categoryId: 'cat-1',
        amount: 500,
        period: 'monthly',
        month: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await makeRequest('GET', '/budgets');

    expect(result.status).toBe(200);
    expect(result.body.budgets).toHaveLength(1);
    expect(result.body.budgets[0].id).toBe('budget-1');
  });

  it('filters by month and year', async () => {
    mockPrisma.budget.findMany.mockResolvedValue([]);

    await makeRequest('GET', '/budgets', undefined, { month: '3', year: '2025' });

    expect(mockPrisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          month: 3,
          year: 2025,
        }),
      })
    );
  });

  it('filters by period', async () => {
    mockPrisma.budget.findMany.mockResolvedValue([]);

    await makeRequest('GET', '/budgets', undefined, { period: 'monthly' });

    expect(mockPrisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          period: 'monthly',
        }),
      })
    );
  });

  it('validates categoryId belongs to user when filtering', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null);

    const result = await makeRequest('GET', '/budgets', undefined, { categoryId: VALID_CATEGORY_ID });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('BUDGET_INVALID_CATEGORY');
  });

  it('filters by categoryId when valid', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: VALID_CATEGORY_ID, userId: 'user-1', groupId: null });
    mockPrisma.budget.findMany.mockResolvedValue([]);

    await makeRequest('GET', '/budgets', undefined, { categoryId: VALID_CATEGORY_ID });

    expect(mockPrisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          categoryId: VALID_CATEGORY_ID,
        }),
      })
    );
  });

  it('rejects invalid query parameters', async () => {
    const result = await makeRequest('GET', '/budgets', undefined, { month: '13' });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /budgets', () => {
  const validBody = {
    categoryId: VALID_CATEGORY_ID,
    amount: 500,
    period: 'monthly' as const,
    month: 1,
    year: 2025,
  };

  it('creates a budget successfully (201)', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: VALID_CATEGORY_ID, userId: 'user-1', groupId: null });
    mockPrisma.budget.create.mockResolvedValue({
      id: 'budget-1',
      userId: 'user-1',
      categoryId: VALID_CATEGORY_ID,
      amount: 500,
      period: 'monthly',
      month: 1,
      year: 2025,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await makeRequest('POST', '/budgets', validBody);

    expect(result.status).toBe(201);
    expect(result.body.budget.id).toBe('budget-1');
    expect(result.body.budget.amount).toBe(500);
  });

  it('rejects amount <= 0', async () => {
    const result = await makeRequest('POST', '/budgets', { ...validBody, amount: 0 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects negative amount', async () => {
    const result = await makeRequest('POST', '/budgets', { ...validBody, amount: -100 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects month outside 1-12', async () => {
    const result = await makeRequest('POST', '/budgets', { ...validBody, month: 13 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects month 0', async () => {
    const result = await makeRequest('POST', '/budgets', { ...validBody, month: 0 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects year outside 2020-2099', async () => {
    const result = await makeRequest('POST', '/budgets', { ...validBody, year: 2019 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects year 2100', async () => {
    const result = await makeRequest('POST', '/budgets', { ...validBody, year: 2100 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects categoryId not owned by user', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null);

    const result = await makeRequest('POST', '/budgets', validBody);

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('BUDGET_INVALID_CATEGORY');
  });

  it('rejects duplicate budget (409)', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: VALID_CATEGORY_ID, userId: 'user-1', groupId: null });
    mockPrisma.budget.create.mockRejectedValue({ code: 'P2002' });

    const result = await makeRequest('POST', '/budgets', validBody);

    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('BUDGET_ALREADY_EXISTS');
  });
});

describe('PATCH /budgets/:id', () => {
  const existingBudget = {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: VALID_CATEGORY_ID,
    month: 1,
    year: 2025,
    period: 'monthly',
  };

  it('updates budget amount successfully', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(existingBudget);
    mockPrisma.budget.update.mockResolvedValue({
      ...existingBudget,
      amount: 750,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await makeRequest('PATCH', '/budgets/budget-1', { amount: 750 });

    expect(result.status).toBe(200);
    expect(result.body.budget.amount).toBe(750);
  });

  it('rejects update to non-existent budget (404)', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const result = await makeRequest('PATCH', '/budgets/budget-999', { amount: 100 });

    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('BUDGET_NOT_FOUND');
  });

  it('rejects update with no fields', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(existingBudget);

    const result = await makeRequest('PATCH', '/budgets/budget-1', {});

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects invalid amount in update', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(existingBudget);

    const result = await makeRequest('PATCH', '/budgets/budget-1', { amount: -50 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects invalid month in update', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(existingBudget);

    const result = await makeRequest('PATCH', '/budgets/budget-1', { month: 13 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects invalid year in update', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(existingBudget);

    const result = await makeRequest('PATCH', '/budgets/budget-1', { year: 2010 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects categoryId not owned by user in update', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(existingBudget);
    mockPrisma.category.findFirst.mockResolvedValue(null);

    const result = await makeRequest('PATCH', '/budgets/budget-1', { categoryId: VALID_CATEGORY_ID_2 });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('BUDGET_INVALID_CATEGORY');
  });

  it('detects uniqueness conflict when changing month', async () => {
    mockPrisma.budget.findFirst.mockResolvedValueOnce(existingBudget);
    mockPrisma.budget.findFirst.mockResolvedValueOnce({ id: 'budget-2' });

    const result = await makeRequest('PATCH', '/budgets/budget-1', { month: 2 });

    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('BUDGET_ALREADY_EXISTS');
  });

  it('handles P2002 error from Prisma on update', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(existingBudget);
    mockPrisma.budget.update.mockRejectedValue({ code: 'P2002' });

    const result = await makeRequest('PATCH', '/budgets/budget-1', { amount: 600 });

    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('BUDGET_ALREADY_EXISTS');
  });
});

describe('DELETE /budgets/:id', () => {
  it('deletes budget successfully (204)', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue({ id: 'budget-1' });
    mockPrisma.budget.delete.mockResolvedValue({ id: 'budget-1' });

    const result = await makeRequest('DELETE', '/budgets/budget-1');

    expect(result.status).toBe(204);
  });

  it('rejects delete of non-existent budget (404)', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const result = await makeRequest('DELETE', '/budgets/budget-999');

    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('BUDGET_NOT_FOUND');
  });

  it('only deletes budgets belonging to the user', async () => {
    mockPrisma.budget.findFirst.mockResolvedValue(null);

    const result = await makeRequest('DELETE', '/budgets/budget-other-user');

    expect(result.status).toBe(404);
    expect(mockPrisma.budget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'budget-other-user', userId: 'user-1' },
      })
    );
  });
});
