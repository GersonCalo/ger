import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
    },
    category: {
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

const makeRequest = async (body: Record<string, unknown>): Promise<{ status: number; body: any }> => {
  const app = express();
  app.use(express.json());
  app.use(insightsRouter);

  return new Promise(resolve => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      try {
        const response = await fetch(`http://localhost:${port}/insights/suggest-category`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
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

const premiumSubscription = { plan: 'premium', status: 'active', currentPeriodEnd: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.category.findMany.mockResolvedValue([
    { id: 'cat-super', name: 'Supermercado' },
    { id: 'cat-transporte', name: 'Transporte' },
  ] as any);
});

describe('POST /insights/suggest-category', () => {
  it('bloquea a un usuario free con 403 PLAN_LIMIT_REACHED', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null as any);

    const { status, body } = await makeRequest({ note: 'Mercadona' });

    expect(status).toBe(403);
    expect(body.error.code).toBe('PLAN_LIMIT_REACHED');
    expect(body.error.details.feature).toBe('insights.suggest-category');
  });

  it('sugiere una categoría existente del usuario a partir de la nota', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(premiumSubscription as any);

    const { status, body } = await makeRequest({ note: 'Compra Mercadona' });

    expect(status).toBe(200);
    expect(body.suggestion).toEqual({ categoryId: 'cat-super', name: 'Supermercado' });
  });

  it('devuelve null cuando no hay coincidencia', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(premiumSubscription as any);

    const { status, body } = await makeRequest({ note: 'xyz sin relación' });

    expect(status).toBe(200);
    expect(body.suggestion).toBeNull();
  });

  it('valida la nota', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(premiumSubscription as any);

    const { status, body } = await makeRequest({});

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });
});
