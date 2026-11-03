import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import {
  disablePushSubscription,
  getPushPublicConfig,
  getPushSubscriptionCount,
  savePushSubscription
} from '../pushNotifications.js';

export const notificationsRouter = Router();

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10)
  })
});

notificationsRouter.get('/public-key', (_req, res) => {
  res.json(getPushPublicConfig());
});

notificationsRouter.get('/status', requireAdmin, asyncHandler(async (_req, res) => {
  res.json({
    ...getPushPublicConfig(),
    activeSubscriptions: await getPushSubscriptionCount()
  });
}));

notificationsRouter.post('/subscribe', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body.subscription);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Suscripcion push invalida' });
  }

  await savePushSubscription(parsed.data, req.headers['user-agent']);
  res.status(201).json({ message: 'Notificaciones activadas en este dispositivo' });
}));

notificationsRouter.delete('/subscribe', requireAdmin, asyncHandler(async (req, res) => {
  const endpoint = String(req.body.endpoint || '');
  if (!endpoint) {
    return res.status(400).json({ message: 'Endpoint requerido' });
  }

  await disablePushSubscription(endpoint);
  res.json({ message: 'Notificaciones desactivadas en este dispositivo' });
}));
