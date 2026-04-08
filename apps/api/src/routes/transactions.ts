import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { syncUserGroupLedgerBackfill } from '../lib/personalLedgerSync.js';
import { calculateUserBalance } from '../lib/userBalance.js';
import { requireAuth } from '../middlewares/requireAuth.js';

export const transactionsRouter = Router();

transactionsRouter.get('/balance', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));
  const balance = await calculateUserBalance(userId);

  return res.json(balance);
});

transactionsRouter.get('/transactions', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));

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
      sourceType: true,
      sourceRefId: true,
      locked: true,
      groupId: true,
      group: {
        select: {
          name: true,
        },
      },
    },
  });

  return res.json({
    transactions: transactions.map((transaction: {
      id: string;
      type: string;
      amount: { toString(): string };
      category: string | null;
      occurredAt: Date;
      note: string | null;
      sourceType: string;
      sourceRefId: string | null;
      locked: boolean;
      groupId: string | null;
      group: { name: string } | null;
    }) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      occurredAt: transaction.occurredAt,
      note: transaction.note,
      sourceType: transaction.sourceType,
      sourceRefId: transaction.sourceRefId,
      locked: transaction.locked,
      groupId: transaction.groupId,
      groupName: transaction.group?.name || null,
    })),
  });
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
    select: {
      id: true,
      type: true,
      amount: true,
      category: true,
      occurredAt: true,
      note: true,
      sourceType: true,
      sourceRefId: true,
      locked: true,
      groupId: true,
      group: {
        select: {
          name: true,
        },
      },
    },
  });

  return res.status(201).json({
    transaction: {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      occurredAt: transaction.occurredAt,
      note: transaction.note,
      sourceType: transaction.sourceType,
      sourceRefId: transaction.sourceRefId,
      locked: transaction.locked,
      groupId: transaction.groupId,
      groupName: transaction.group?.name || null,
    },
  });
});
