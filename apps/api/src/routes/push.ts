import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { getVapidPublicKey } from '../lib/push.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendError, zodIssuesDetails } from '../lib/apiError.js';

const pushRouter = Router();

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

pushRouter.get('/push/vapid-public-key', requireAuth, async (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return sendError(res, 503, 'PUSH_NOT_CONFIGURED', 'Push notifications not configured');
  }
  res.json({ publicKey: key });
});

pushRouter.post('/push/subscribe', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId,
        endpoint: parsed.data.endpoint,
      },
    },
    create: {
      userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    update: {
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
  });

  res.status(204).send();
});

export default pushRouter;
