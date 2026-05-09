import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendError, zodIssuesDetails } from '../lib/apiError.js';
import { syncUserGroupLedgerBackfill } from '../lib/personalLedgerSync.js';

export const transactionsRouter = Router();

const serializeTransaction = (transaction: {
  id: string;
  type: string;
  amount: { toString(): string };
  category?: { id: string; name: string; type: string; color?: string | null; icon?: string | null } | null;
  occurredAt: string | Date;
  note?: string | null;
  sourceType?: string | null;
  sourceRefId?: string | null;
  locked?: boolean;
  groupId?: string | null;
  group?: { name: string } | null;
}) => ({
  id: transaction.id,
  type: transaction.type,
  amount: Number(transaction.amount.toString()),
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
});

transactionsRouter.get('/transactions', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const limit = _req.query.limit === 'all' ? undefined : 50;

  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));

  const transactions = await prisma.personalTransaction.findMany({
    where: { userId },
    orderBy: { occurredAt: 'desc' },
    take: limit,
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
    transactions: transactions.map(serializeTransaction),
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
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const amountValue = typeof parsed.data.amount === 'string' ? Number(parsed.data.amount) : parsed.data.amount;
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return sendError(res, 400, 'TX_INVALID_AMOUNT', 'Monto inválido');
  }

  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return sendError(res, 400, 'TX_INVALID_DATE', 'Fecha inválida');
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
      return sendError(res, 400, 'TX_CATEGORY_NOT_ACCESSIBLE', 'Categoría no encontrada o no tienes acceso a ella');
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
    transaction: serializeTransaction(transaction),
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
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const hasAnyField = Object.values(parsed.data).some(v => v !== undefined);
  if (!hasAnyField) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos');
  }

  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));

  const existing = await prisma.personalTransaction.findFirst({
    where: { id: transactionId, userId },
    select: { id: true, locked: true },
  });

  if (!existing) {
    return sendError(res, 404, 'TX_NOT_FOUND', 'Transacción no encontrada');
  }

  if (existing.locked) {
    return sendError(res, 409, 'TX_LOCKED', 'Transacción bloqueada');
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.type !== undefined) {
    updates.type = parsed.data.type;
  }

  if (parsed.data.amount !== undefined) {
    const amountValue = typeof parsed.data.amount === 'string' ? Number(parsed.data.amount) : parsed.data.amount;
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return sendError(res, 400, 'TX_INVALID_AMOUNT', 'Monto inválido');
    }
    updates.amount = amountValue;
  }

  if (parsed.data.occurredAt !== undefined) {
    const occurredAt = new Date(parsed.data.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      return sendError(res, 400, 'TX_INVALID_DATE', 'Fecha inválida');
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
        return sendError(res, 400, 'TX_CATEGORY_NOT_ACCESSIBLE', 'Categoría no encontrada o no tienes acceso a ella');
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
    transaction: serializeTransaction(transaction),
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
    return sendError(res, 404, 'TX_NOT_FOUND', 'Transacción no encontrada');
  }

  if (existing.locked) {
    return sendError(res, 409, 'TX_LOCKED', 'Transacción bloqueada');
  }

  await prisma.personalTransaction.delete({
    where: { id: existing.id },
  });

  return res.status(204).send();
});
