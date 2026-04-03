import { Router } from 'express';
import { env } from '../config/env.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV });
});

router.get('/config', (_req, res) => {
  res.json({ hasDatabaseUrl: Boolean(env.DATABASE_URL) });
});

// TODO: rutas de auth, transactions, groups según el plan
