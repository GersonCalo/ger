import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendError, zodIssuesDetails } from '../lib/apiError.js';

export const authRouter = Router();

const signToken = (userId: string) => jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '30d' });

authRouter.post('/auth/register', async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
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
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return sendError(res, 409, 'AUTH_EMAIL_ALREADY_REGISTERED', 'Ese email ya está registrado');
    }

    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }
});

authRouter.post('/auth/login', async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, currency: true, passwordHash: true },
  });

  if (!user) {
    return sendError(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
  }

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) {
    return sendError(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
  }

  const token = signToken(user.id);

  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, currency: user.currency },
  });
});

authRouter.get('/me', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, currency: true, createdAt: true },
  });

  if (!user) {
    return sendError(res, 401, 'AUTH_UNAUTHENTICATED', 'No autenticado');
  }

  return res.json({ user });
});
