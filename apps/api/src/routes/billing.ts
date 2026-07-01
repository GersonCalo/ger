import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { getPlanLimits, resolvePlan } from '../domain/billing/services/plan-policy.js';

export const billingRouter = Router();

billingRouter.get('/billing/plan', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;

  const [subscription, ownedGroups] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, currentPeriodEnd: true },
    }),
    prisma.group.count({ where: { ownerUserId: userId } }),
  ]);

  const plan = resolvePlan(subscription, new Date());

  return res.json({
    billing: {
      plan,
      limits: getPlanLimits(plan),
      usage: { ownedGroups },
    },
  });
});
