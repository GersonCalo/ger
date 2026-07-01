import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
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

import { groupsRouter } from './groups';
import { prisma } from '../db/prisma.js';

const mockPrisma = vi.mocked(prisma);

const makeRequest = async (body: Record<string, unknown>): Promise<{ status: number; body: any }> => {
  const app = express();
  app.use(express.json());
  app.use(groupsRouter);

  return new Promise(resolve => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      try {
        const response = await fetch(`http://localhost:${port}/groups`, {
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

const createdGroup = {
  id: 'group-1',
  name: 'Piso',
  currency: 'EUR',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  members: [
    {
      id: 'member-1',
      userId: 'user-1',
      displayName: 'Gerson',
      weight: 1,
      role: 'admin',
      leftAt: null,
    },
  ],
  expenses: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({ name: 'Gerson', email: 'g@example.com', currency: 'EUR' } as any);
  mockPrisma.group.findUnique.mockResolvedValue(null as any); // joinCode libre
  mockPrisma.group.create.mockResolvedValue(createdGroup as any);
});

describe('POST /groups con límites de plan', () => {
  // Scenario Gherkin HU-08.1:
  //   Given un usuario tiene plan gratuito
  //   And ya tiene un grupo activo
  //   When intenta crear otro grupo
  //   Then el sistema debe bloquear la acción
  it('bloquea al usuario free que ya tiene un grupo', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null as any);
    mockPrisma.group.count.mockResolvedValue(1 as any);

    const { status, body } = await makeRequest({ name: 'Segundo grupo' });

    expect(status).toBe(403);
    expect(body.error.code).toBe('PLAN_LIMIT_REACHED');
    expect(body.error.details.limit).toBe(1);
    expect(body.error.details.plan).toBe('free');
    expect(mockPrisma.group.create).not.toHaveBeenCalled();
  });

  it('permite al usuario free crear su primer grupo', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null as any);
    mockPrisma.group.count.mockResolvedValue(0 as any);

    const { status } = await makeRequest({ name: 'Primer grupo' });

    expect(status).toBe(201);
    expect(mockPrisma.group.create).toHaveBeenCalledTimes(1);
  });

  it('no limita al usuario premium con suscripción activa', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'premium',
      status: 'active',
      currentPeriodEnd: null,
    } as any);
    mockPrisma.group.count.mockResolvedValue(7 as any);

    const { status } = await makeRequest({ name: 'Otro grupo más' });

    expect(status).toBe(201);
    expect(mockPrisma.group.create).toHaveBeenCalledTimes(1);
  });

  it('trata una suscripción premium caducada como free', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'premium',
      status: 'active',
      currentPeriodEnd: new Date('2020-01-01T00:00:00Z'),
    } as any);
    mockPrisma.group.count.mockResolvedValue(1 as any);

    const { status, body } = await makeRequest({ name: 'Grupo bloqueado' });

    expect(status).toBe(403);
    expect(body.error.code).toBe('PLAN_LIMIT_REACHED');
  });
});
