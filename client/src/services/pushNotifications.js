import { api } from './api.js';

export function isPushSupported() {
  return 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  return navigator.serviceWorker.register('/sw.js');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function getPushStatus() {
  const status = await api('/notifications/status');
  let browserPermission = 'unsupported';
  let hasLocalSubscription = false;

  if (isPushSupported()) {
    browserPermission = Notification.permission;
    const registration = await registerAppServiceWorker();
    const subscription = await registration.pushManager.getSubscription();
    hasLocalSubscription = Boolean(subscription);
  }

  return { ...status, browserPermission, hasLocalSubscription };
}

export async function enablePushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Este navegador no soporta notificaciones push.');
  }

  const config = await api('/notifications/public-key');
  if (!config.enabled || !config.publicKey) {
    throw new Error('El servidor no tiene llaves push configuradas.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones rechazado.');
  }

  const registration = await registerAppServiceWorker();
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.publicKey)
  });

  await api('/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription })
  });

  return subscription;
}

export async function disablePushNotifications() {
  if (!isPushSupported()) {
    return;
  }

  const registration = await registerAppServiceWorker();
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  await api('/notifications/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });

  await subscription.unsubscribe();
}
