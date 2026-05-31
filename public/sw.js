/* Welcome 24 Admin — service worker для Web Push.
 * Ловит push и по клику открывает админку на нужном URL. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'Welcome 24', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Welcome 24';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // В админке deep-link из портала ('/cases') ведём на свой /cases.
  let target = (event.notification.data && event.notification.data.url) || '/';
  if (/\/cases/.test(target)) target = '/cases';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && target !== '/') client.navigate(target).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
