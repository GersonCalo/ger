import { Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV });
});

router.get('/config', (_req, res) => {
  res.json({ hasDatabaseUrl: Boolean(env.DATABASE_URL) });
});

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const [type, token] = authorizationHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
};

const requireUserIdFromAuthHeader = (authorizationHeader: unknown) => {
  const token = getBearerToken(authorizationHeader);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId?: string };
    if (!payload?.userId) return null;
    return payload.userId;
  } catch {
    return null;
  }
};

const signToken = (userId: string) => jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '30d' });

router.post('/auth/register', async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: parsed.data.name?.trim() || null,
      },
      select: { id: true, email: true, name: true, currency: true },
    });

    const token = signToken(user.id);
    return res.status(201).json({ token, user });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ message: 'Ese email ya está registrado' });
    }
    return res.status(500).json({ message: 'Error creando usuario' });
  }
});

router.post('/auth/login', async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, currency: true, passwordHash: true },
  });

  if (!user) return res.status(401).json({ message: 'Email o contraseña incorrectos' });

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Email o contraseña incorrectos' });

  const token = signToken(user.id);
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, currency: user.currency },
  });
});

router.get('/me', async (req, res) => {
  const userId = requireUserIdFromAuthHeader(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: 'No autenticado' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, currency: true, createdAt: true },
  });

  if (!user) return res.status(401).json({ message: 'No autenticado' });
  return res.json({ user });
});

router.get('/transactions', async (req, res) => {
  const userId = requireUserIdFromAuthHeader(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: 'No autenticado' });

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

router.post('/transactions', async (req, res) => {
  const userId = requireUserIdFromAuthHeader(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: 'No autenticado' });

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

  const tx = await prisma.personalTransaction.create({
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

  return res.status(201).json({ transaction: tx });
});
