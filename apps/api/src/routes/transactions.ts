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

transactionsRouter.get('/transactions', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));

  // Support ?limit=all for full history (used by chart)
  const limitParam = typeof req.query.limit === 'string' ? req.query.limit : null;
  const takeLimit = limitParam === 'all' ? undefined : 50;

  const transactions = await prisma.personalTransaction.findMany({
    where: { userId },
    orderBy: { occurredAt: 'desc' },
    ...(takeLimit !== undefined ? { take: takeLimit } : {}),
    select: {
      id: true,
      type: true,
      amount: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
        },
      },
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
    transactions: transactions.map((transaction: any) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category ? {
        id: transaction.category.id,
        name: transaction.category.name,
        type: transaction.category.type,
        color: transaction.category.color || '',
        icon: transaction.category.icon || '',
      } : null,
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
    categoryId: z.string().uuid().optional().nullable(),
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

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: parsed.data.categoryId,
        OR: [
          { userId: null, groupId: null },
          { userId: userId, groupId: null },
        ],
      },
    });

    if (!category) {
      return res.status(400).json({ message: 'Categoría no encontrada o no tienes acceso a ella' });
    }
  }

  const transaction = await prisma.personalTransaction.create({
    data: {
      userId,
      type: parsed.data.type,
      amount: amountValue,
      categoryId: parsed.data.categoryId || null,
      note: parsed.data.note?.trim() || null,
      occurredAt,
    },
    select: {
      id: true,
      type: true,
      amount: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
        },
      },
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
      category: transaction.category ? {
        id: transaction.category.id,
        name: transaction.category.name,
        type: transaction.category.type,
        color: transaction.category.color || '',
        icon: transaction.category.icon || '',
      } : null,
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

transactionsRouter.patch('/transactions/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const transactionId = req.params.id;

  const bodySchema = z.object({
    type: z.enum(['income', 'expense']).optional(),
    amount: z.union([z.number().positive(), z.string().min(1)]).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    note: z.string().optional().nullable(),
    occurredAt: z.string().datetime().optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const hasAnyField = Object.values(parsed.data).some(v => v !== undefined);
  if (!hasAnyField) {
    return res.status(400).json({ message: 'Datos inválidos' });
  }

  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));

  const existing = await prisma.personalTransaction.findFirst({
    where: { id: transactionId, userId },
    select: { id: true, locked: true },
  });

  if (!existing) {
    return res.status(404).json({ message: 'Transacción no encontrada' });
  }

  if (existing.locked) {
    return res.status(409).json({ message: 'Transacción bloqueada' });
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.type !== undefined) {
    updates.type = parsed.data.type;
  }

  if (parsed.data.amount !== undefined) {
    const amountValue = typeof parsed.data.amount === 'string' ? Number(parsed.data.amount) : parsed.data.amount;
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ message: 'Monto inválido' });
    }
    updates.amount = amountValue;
  }

  if (parsed.data.occurredAt !== undefined) {
    const occurredAt = new Date(parsed.data.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      return res.status(400).json({ message: 'Fecha inválida' });
    }
    updates.occurredAt = occurredAt;
  }

  if (parsed.data.note !== undefined) {
    updates.note = parsed.data.note?.trim() || null;
  }

  if (parsed.data.categoryId !== undefined) {
    const categoryId = parsed.data.categoryId || null;
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          OR: [
            { userId: null, groupId: null },
            { userId: userId, groupId: null },
          ],
        },
      });

      if (!category) {
        return res.status(400).json({ message: 'Categoría no encontrada o no tienes acceso a ella' });
      }
    }
    updates.categoryId = categoryId;
  }

  const transaction = await prisma.personalTransaction.update({
    where: { id: existing.id },
    data: updates as any,
    select: {
      id: true,
      type: true,
      amount: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
        },
      },
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
    transaction: {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category ? {
        id: transaction.category.id,
        name: transaction.category.name,
        type: transaction.category.type,
        color: transaction.category.color || '',
        icon: transaction.category.icon || '',
      } : null,
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

transactionsRouter.delete('/transactions/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const transactionId = req.params.id;

  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));

  const existing = await prisma.personalTransaction.findFirst({
    where: { id: transactionId, userId },
    select: { id: true, locked: true },
  });

  if (!existing) {
    return res.status(404).json({ message: 'Transacción no encontrada' });
  }

  if (existing.locked) {
    return res.status(409).json({ message: 'Transacción bloqueada' });
  }

  await prisma.personalTransaction.delete({
    where: { id: existing.id },
  });

  return res.status(204).send();
});
