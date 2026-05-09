import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendError, zodIssuesDetails } from '../lib/apiError.js';
import { syncUserGroupLedgerBackfill } from '../lib/personalLedgerSync.js';
import { calculateUserBalance } from '../lib/userBalance.js';

export const transactionsRouter = Router();

transactionsRouter.get('/balance', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));
  const balance = await calculateUserBalance(userId);

  return res.json(balance);
});

const GROUP_SOURCE_TYPES = ['group_expense', 'group_settlement_paid', 'group_settlement_received'] as const;

const CURSOR_SCHEMA = z.object({
  occurredAt: z.string().datetime(),
  id: z.string().uuid(),
});

const encodeCursor = (occurredAt: Date | string, id: string): string => {
  const raw = JSON.stringify({
    occurredAt: typeof occurredAt === 'string' ? occurredAt : occurredAt.toISOString(),
    id,
  });
  return Buffer.from(raw).toString('base64');
};

const decodeCursor = (cursor: string): { occurredAt: Date; id: string } | null => {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = CURSOR_SCHEMA.parse(JSON.parse(raw));
    const date = new Date(parsed.occurredAt);
    if (Number.isNaN(date.getTime())) return null;
    return { occurredAt: date, id: parsed.id };
  } catch {
    return null;
  }
};

const LIST_QUERY_SCHEMA = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: z.enum(['income', 'expense']).optional(),
  origin: z.enum(['manual', 'group']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const TX_SELECT = {
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
} as const;

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

  const parsed = LIST_QUERY_SCHEMA.safeParse(_req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Parámetros de consulta inválidos', zodIssuesDetails(parsed.error));
  }

  const { from, to, type, origin, cursor, limit } = parsed.data;

  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));

  const where: Record<string, unknown> = { userId };

  if (from) {
    const existing = (where.occurredAt as Record<string, Date> | undefined) ?? {};
    where.occurredAt = { ...existing, gte: new Date(from) };
  }

  if (to) {
    const existing = (where.occurredAt as Record<string, Date> | undefined) ?? {};
    where.occurredAt = { ...existing, lte: new Date(to) };
  }

  if (type) {
    where.type = type;
  }

  if (origin) {
    if (origin === 'manual') {
      where.sourceType = 'manual';
    } else if (origin === 'group') {
      where.sourceType = { in: [...GROUP_SOURCE_TYPES] };
    }
  }

  const cursorClause: Record<string, unknown> = {};

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      return sendError(res, 400, 'INVALID_CURSOR', 'Cursor inválido');
    }

    cursorClause.OR = [
      { occurredAt: { lt: decoded.occurredAt } },
      {
        occurredAt: decoded.occurredAt,
        id: { lt: decoded.id },
      },
    ];
  }

  const finalWhere = {
    AND: [where, cursorClause],
  };

  const rows = await prisma.personalTransaction.findMany({
    where: finalWhere,
    orderBy: [
      { occurredAt: 'desc' },
      { id: 'desc' },
    ],
    take: limit + 1,
    select: TX_SELECT,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items.length > 0 ? items[items.length - 1] : null;
  const nextCursor = hasMore && lastItem
    ? encodeCursor(lastItem.occurredAt, lastItem.id)
    : null;

  return res.json({
    transactions: items.map(serializeTransaction),
    nextCursor,
    hasMore,
  });
});

const EXPORT_QUERY_SCHEMA = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: z.enum(['income', 'expense']).optional(),
  origin: z.enum(['manual', 'group']).optional(),
});

const escapeCsvField = (value: string | null): string => {
  if (value === null || value === '') return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const mapOrigin = (sourceType: string | null): string => {
  if (sourceType === 'manual') return 'manual';
  return 'group';
};

transactionsRouter.get('/transactions/export.csv', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;

  const parsed = EXPORT_QUERY_SCHEMA.safeParse(_req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Parámetros de consulta inválidos', zodIssuesDetails(parsed.error));
  }

  const { from, to, type, origin } = parsed.data;

  await prisma.$transaction((tx: Prisma.TransactionClient) => syncUserGroupLedgerBackfill(tx, userId));

  const where: Record<string, unknown> = { userId };

  if (from) {
    where.occurredAt = { ...((where.occurredAt as Record<string, Date> | undefined) ?? {}), gte: new Date(from) };
  }

  if (to) {
    where.occurredAt = { ...((where.occurredAt as Record<string, Date> | undefined) ?? {}), lte: new Date(to) };
  }

  if (type) {
    where.type = type;
  }

  if (origin) {
    if (origin === 'manual') {
      where.sourceType = 'manual';
    } else if (origin === 'group') {
      where.sourceType = { in: [...GROUP_SOURCE_TYPES] };
    }
  }

  const rows = await prisma.personalTransaction.findMany({
    where,
    orderBy: [
      { occurredAt: 'desc' },
      { id: 'desc' },
    ],
    select: {
      occurredAt: true,
      type: true,
      amount: true,
      sourceType: true,
      note: true,
      group: {
        select: {
          name: true,
        },
      },
    },
  });

  const header = 'fecha,tipo,monto,origen,descripcion,grupo';

  const csvRows = rows.map(row => {
    const date = new Date(row.occurredAt).toISOString();
    const amount = row.amount.toString();
    const originValue = mapOrigin(row.sourceType);
    const description = escapeCsvField(row.note);
    const groupName = escapeCsvField(row.group?.name ?? null);

    return `${date},${row.type},${amount},${originValue},${description},${groupName}`;
  });

  const bom = '\uFEFF';
  const csvContent = `${bom}${header}\n${csvRows.join('\n')}\n`;

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `movimientos-${dateStr}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  return res.send(csvContent);
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
