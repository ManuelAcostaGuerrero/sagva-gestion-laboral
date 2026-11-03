self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data?.json?.() || {};
  const title = data.title || 'Red Taurus Codex Asistencia';
  const options = {
    body: data.body || 'Nueva marcacion registrada.',
    icon: data.icon || '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'attendance',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => client.url === targetUrl);

    if (existing) {
      return existing.focus();
    }

    return self.clients.openWindow(targetUrl);
  })());
});
