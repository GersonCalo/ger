import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    personalTransaction: {
      findMany: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
    },
    aiInsight: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../middlewares/requireAuth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    res.locals.userId = 'user-1';
    next();
  },
}));

const generateSummaryMock = vi.fn();

vi.mock('../lib/aiInsightProvider.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/aiInsightProvider.js')>('../lib/aiInsightProvider.js');
  return {
    ...actual,
    getAiInsightProvider: () => ({
      name: 'mock-provider',
      generateSummary: generateSummaryMock,
    }),
  };
});

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
        const response = await fetch(`http://localhost:${port}/insights/ai-summary`, {
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

const decimal = (value: string) => ({ toString: () => value });

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({ currency: 'EUR' } as any);
  mockPrisma.personalTransaction.findMany.mockResolvedValue([
    { type: 'expense', amount: decimal('120'), categoryId: 'cat-super', category: { name: 'Supermercado' } },
  ] as any);
  mockPrisma.budget.findMany.mockResolvedValue([
    { categoryId: 'cat-super', amount: decimal('250'), category: { name: 'Supermercado' } },
  ] as any);
  mockPrisma.aiInsight.create.mockImplementation(async ({ data }: any) => ({
    id: 'insight-1',
    ...data,
    createdAt: new Date('2026-07-02T00:00:00Z'),
  }));
  generateSummaryMock.mockResolvedValue('ANÁLISIS GENERADO POR IA MOCK');
});

describe('POST /insights/ai-summary', () => {
  // Scenario Gherkin HU-07.1: usuario free no accede
  it('bloquea a un usuario free con 403 PLAN_LIMIT_REACHED', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null as any);

    const { status, body } = await makeRequest({ month: 7, year: 2026 });

    expect(status).toBe(403);
    expect(body.error.code).toBe('PLAN_LIMIT_REACHED');
    expect(body.error.details.feature).toBe('insights.ai-summary');
    expect(generateSummaryMock).not.toHaveBeenCalled();
    expect(mockPrisma.aiInsight.create).not.toHaveBeenCalled();
  });

  it('genera y guarda el análisis para un usuario premium', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'premium',
      status: 'active',
      currentPeriodEnd: null,
    } as any);

    const { status, body } = await makeRequest({ month: 7, year: 2026 });

    expect(status).toBe(201);
    expect(body.insight.content).toBe('ANÁLISIS GENERADO POR IA MOCK');
    expect(body.insight.provider).toBe('mock-provider');
    expect(body.insight.month).toBe(7);
    expect(body.insight.year).toBe(2026);
    expect(mockPrisma.aiInsight.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.aiInsight.create.mock.calls[0][0].data.content).toBe('ANÁLISIS GENERADO POR IA MOCK');
  });

  it('no envía datos personales al proveedor', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'premium',
      status: 'active',
      currentPeriodEnd: null,
    } as any);

    await makeRequest({ month: 7, year: 2026 });

    expect(generateSummaryMock).toHaveBeenCalledTimes(1);
    const input = generateSummaryMock.mock.calls[0][0];
    const serialized = JSON.stringify(input);

    expect(serialized).not.toContain('user-1');
    expect(input.topCategory.name).toBe('Supermercado');
    expect(input.budgets).toEqual([{ categoryName: 'Supermercado', amount: 250, spent: 120 }]);
  });

  it('valida el periodo', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'premium',
      status: 'active',
      currentPeriodEnd: null,
    } as any);

    const { status, body } = await makeRequest({ month: 13, year: 2026 });

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });
});
