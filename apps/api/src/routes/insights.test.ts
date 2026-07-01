import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    personalTransaction: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../middlewares/requireAuth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    res.locals.userId = 'user-1';
    next();
  },
}));

import { insightsRouter } from './insights';
import { prisma } from '../db/prisma.js';

const mockPrisma = vi.mocked(prisma);

const makeRequest = async (path: string, query?: Record<string, string>): Promise<{ status: number; body: any }> => {
  const app = express();
  app.use(express.json());
  app.use(insightsRouter);

  const qs = query ? '?' + new URLSearchParams(query).toString() : '';

  return new Promise(resolve => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      try {
        const response = await fetch(`http://localhost:${port}${path}${qs}`);
        const text = await response.text();
        server.close(() => {
          resolve({ status: response.status, body: text ? JSON.parse(text) : null });
        });
      } catch (err: any) {
        server.close(() => {
          resolve({ status: 500, body: { error: err.message } });
        });
      }
    });
  });
};

const decimal = (value: string) => ({ toString: () => value });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /insights/monthly-summary', () => {
  it('devuelve el resumen del mes con categoría top y comparación con el mes anterior', async () => {
    // Primera llamada: mes actual. Segunda: mes anterior.
    mockPrisma.personalTransaction.findMany
      .mockResolvedValueOnce([
        { type: 'expense', amount: decimal('120'), categoryId: 'cat-super', category: { name: 'Supermercado' } },
        { type: 'expense', amount: decimal('45'), categoryId: 'cat-cafe', category: { name: 'Cafés' } },
        { type: 'income', amount: decimal('1500'), categoryId: null, category: null },
      ] as any)
      .mockResolvedValueOnce([
        { type: 'expense', amount: decimal('100'), categoryId: 'cat-super', category: { name: 'Supermercado' } },
      ] as any);

    const { status, body } = await makeRequest('/insights/monthly-summary', { month: '7', year: '2026' });

    expect(status).toBe(200);
    expect(body.summary.month).toBe(7);
    expect(body.summary.year).toBe(2026);
    expect(body.summary.income).toBe(1500);
    expect(body.summary.expense).toBe(165);
    expect(body.summary.topCategory.name).toBe('Supermercado');
    expect(body.summary.previousExpense).toBe(100);
    expect(body.summary.expenseDeltaPercent).toBe(65);
    expect(body.summary.tips.length).toBeGreaterThan(0);
  });

  it('filtra por el rango de fechas del mes pedido y el anterior', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([] as any);

    await makeRequest('/insights/monthly-summary', { month: '1', year: '2026' });

    const calls = mockPrisma.personalTransaction.findMany.mock.calls;
    expect(calls).toHaveLength(2);

    const currentWhere = (calls[0][0] as any).where;
    expect(currentWhere.userId).toBe('user-1');
    expect(currentWhere.occurredAt.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(currentWhere.occurredAt.lt.toISOString()).toBe('2026-02-01T00:00:00.000Z');

    const previousWhere = (calls[1][0] as any).where;
    expect(previousWhere.occurredAt.gte.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(previousWhere.occurredAt.lt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rechaza un mes inválido', async () => {
    const { status, body } = await makeRequest('/insights/monthly-summary', { month: '13', year: '2026' });

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('usa el mes actual si no se pasa periodo', async () => {
    mockPrisma.personalTransaction.findMany.mockResolvedValue([] as any);

    const { status, body } = await makeRequest('/insights/monthly-summary');

    expect(status).toBe(200);
    expect(body.summary.month).toBeGreaterThanOrEqual(1);
    expect(body.summary.month).toBeLessThanOrEqual(12);
  });
});
