/**
 * Flow - Service Worker
 * Provides full offline functionality with cache-first strategy
 */

const CACHE_VERSION = 'flow-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignore failures for optional assets
      });
    })
  );
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first with Network fallback and Dynamic offline caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Handle HTML navigation requests (Offline-first App Shell)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put('/', copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/').then((cachedPage) => {
            return cachedPage || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Handle static assets (_next/static, icons, etc.)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached immediately, fetch update in background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // If request fails offline and is an image or icon, try root icon fallback
          if (request.destination === 'image') {
            return caches.match('/icons/icon-192.png');
          }
        });
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Flow';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'flow-notification',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existingClient = windowClients.find((c) => c.url === urlToOpen && 'focus' in c);
      if (existingClient) return existingClient.focus();
      return clients.openWindow(urlToOpen);
    })
  );
});

// Background sync for scheduled alarms
self.addEventListener('sync', (event) => {
  if (event.tag === 'flow-alarm-sync') {
    event.waitUntil(checkAlarms());
  }
});

async function checkAlarms() {
  // Alarms are managed from the main thread via IndexedDB
  const clients_ = await self.clients.matchAll();
  clients_.forEach((client) => {
    client.postMessage({ type: 'CHECK_ALARMS' });
  });
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'flow-periodic-check') {
    event.waitUntil(checkAlarms());
  }
});

// Message from main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      ...options,
      icon: options?.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
