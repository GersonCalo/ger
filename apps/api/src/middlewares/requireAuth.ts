import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const [type, token] = authorizationHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
};

export const getUserIdFromAuthHeader = (authorizationHeader: unknown) => {
  const token = getBearerToken(authorizationHeader);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId?: string };
    return payload?.userId || null;
  } catch {
    return null;
  }
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = getUserIdFromAuthHeader(req.headers.authorization);

  if (!userId) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  res.locals.userId = userId;
  return next();
};
