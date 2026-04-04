import { Router } from 'express';
import { env } from '../config/env.js';
import { authRouter } from './auth.js';
import { groupsRouter } from './groups.js';
import { transactionsRouter } from './transactions.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV });
});

router.get('/config', (_req, res) => {
  res.json({ hasDatabaseUrl: Boolean(env.DATABASE_URL) });
});

router.use(authRouter);
router.use(transactionsRouter);
router.use(groupsRouter);
