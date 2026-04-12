import webpush from 'web-push';
import { prisma } from '../db/prisma.js';

// Initialize VAPID
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidMailto = process.env.VAPID_MAILTO || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidMailto, vapidPublicKey, vapidPrivateKey);
}

export const getVapidPublicKey = () => vapidPublicKey || null;

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export const sendPushToUser = async (userId: string, payload: PushPayload) => {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return;

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  });

  await Promise.all(
    subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notification
        );
      } catch (err: any) {
        // 410 Gone = subscription expired/expired, remove it
        if (err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          // Log but don't throw — push is fire-and-forget
          console.error(`Push notification failed for subscription ${sub.id}:`, err.message);
        }
      }
    })
  );
};
