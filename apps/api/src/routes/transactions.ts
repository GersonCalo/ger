import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { calculateUserBalance } from '../lib/userBalance.js';
import { requireAuth } from '../middlewares/requireAuth.js';

export const transactionsRouter = Router();

transactionsRouter.get('/balance', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const balance = await calculateUserBalance(userId);

  return res.json(balance);
});

transactionsRouter.get('/transactions', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;

  const transactions = await prisma.personalTransaction.findMany({
    where: { userId },
    orderBy: { occurredAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      amount: true,
      category: true,
      occurredAt: true,
      note: true,
    },
  });

  return res.json({ transactions });
});

transactionsRouter.post('/transactions', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const bodySchema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.union([z.number().positive(), z.string().min(1)]),
    category: z.string().optional(),
    note: z.string().optional(),
    occurredAt: z.string().datetime().optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const amountValue = typeof parsed.data.amount === 'string' ? Number(parsed.data.amount) : parsed.data.amount;
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return res.status(400).json({ message: 'Monto inválido' });
  }

  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return res.status(400).json({ message: 'Fecha inválida' });
  }

  const transaction = await prisma.personalTransaction.create({
    data: {
      userId,
      type: parsed.data.type,
      amount: amountValue,
      category: parsed.data.category?.trim() || null,
      note: parsed.data.note?.trim() || null,
      occurredAt,
    },
    select: { id: true, type: true, amount: true, category: true, occurredAt: true, note: true },
  });

  return res.status(201).json({ transaction });
});
