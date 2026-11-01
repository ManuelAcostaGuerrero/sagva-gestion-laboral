import { runMigrations } from './migrations.js';
import webpush from 'web-push';
import { pool } from './db.js';

function pushEnabled() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configureWebPush() {
  if (!pushEnabled()) {
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  return true;
}

export async function ensurePushSubscriptionTable() {
  await runMigrations();
}

export function getPushPublicConfig() {
  return {
    enabled: pushEnabled(),
    publicKey: process.env.VAPID_PUBLIC_KEY || ''
  };
}

export async function getPushSubscriptionCount() {
  await ensurePushSubscriptionTable();

  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM push_subscriptions WHERE is_active = 1'
  );

  return Number(rows[0]?.total || 0);
}

export async function savePushSubscription(subscription, userAgent = '') {
  await ensurePushSubscriptionTable();

  await pool.execute(
    `INSERT INTO push_subscriptions (endpoint, subscription_json, user_agent, is_active)
     VALUES (:endpoint, :subscriptionJson, :userAgent, 1)
     ON CONFLICT DO UPDATE SET
       subscription_json = excluded.subscription_json,
       user_agent = excluded.user_agent,
       is_active = 1`,
    {
      endpoint: subscription.endpoint,
      subscriptionJson: JSON.stringify(subscription),
      userAgent: String(userAgent || '').slice(0, 255)
    }
  );
}

export async function disablePushSubscription(endpoint) {
  await ensurePushSubscriptionTable();

  await pool.execute(
    'UPDATE push_subscriptions SET is_active = 0 WHERE endpoint = :endpoint',
    { endpoint }
  );
}

export async function sendAttendanceNotification({ employee, record, source }) {
  if (!configureWebPush()) {
    return;
  }

  await ensurePushSubscriptionTable();

  const [subscriptions] = await pool.execute(
    'SELECT id, subscription_json AS subscriptionJson FROM push_subscriptions WHERE is_active = 1'
  );

  if (!subscriptions.length) {
    return;
  }

  const recordTypeLabels = {
    entrada: 'Entrada',
    salida: 'Salida',
    salida_colacion: 'Salida de colacion',
    entrada_colacion: 'Entrada a colacion'
  };
  const recordType = recordTypeLabels[record.type] || 'Marcacion';
  const registeredAt = new Date(record.registeredAt).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  const payload = JSON.stringify({
    title: `${recordType} registrada`,
    body: `${employee.fullName} marco ${recordType.toLowerCase()} a las ${registeredAt}${source ? ` (${source})` : ''}.`,
    url: '/',
    tag: `attendance-${record.id}`,
    icon: '/icon.svg'
  });

  const deliveries = subscriptions.map(async (row) => {
    try {
      const subscription = typeof row.subscriptionJson === 'string'
        ? JSON.parse(row.subscriptionJson)
        : row.subscriptionJson;

      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await pool.execute(
          'UPDATE push_subscriptions SET is_active = 0 WHERE id = :id',
          { id: row.id }
        );
      } else {
        console.error('No se pudo enviar notificacion push:', error.message);
      }
    }
  });

  await Promise.allSettled(deliveries);
}
