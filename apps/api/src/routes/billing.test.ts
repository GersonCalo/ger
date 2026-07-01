import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    group: {
      count: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../middlewares/requireAuth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    res.locals.userId = 'user-1';
    next();
  },
}));

import { billingRouter } from './billing';
import { prisma } from '../db/prisma.js';

const mockPrisma = vi.mocked(prisma);

const makeRequest = async (): Promise<{ status: number; body: any }> => {
  const app = express();
  app.use(billingRouter);

  return new Promise(resolve => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      try {
        const response = await fetch(`http://localhost:${port}/billing/plan`);
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /billing/plan', () => {
  it('devuelve plan free con sus límites y uso cuando no hay suscripción', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null as any);
    mockPrisma.group.count.mockResolvedValue(1 as any);

    const { status, body } = await makeRequest();

    expect(status).toBe(200);
    expect(body.billing.plan).toBe('free');
    expect(body.billing.limits.maxOwnedGroups).toBe(1);
    expect(body.billing.usage.ownedGroups).toBe(1);
  });

  it('devuelve plan premium sin límite de grupos', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'premium',
      status: 'active',
      currentPeriodEnd: null,
    } as any);
    mockPrisma.group.count.mockResolvedValue(4 as any);

    const { status, body } = await makeRequest();

    expect(status).toBe(200);
    expect(body.billing.plan).toBe('premium');
    expect(body.billing.limits.maxOwnedGroups).toBeNull();
  });
});
