/**
 * Nooraya Web Push & Background Prayer Notification Service Worker Module
 * Imported into Workbox SW via `workbox.importScripts: ['/push-sw.js']`.
 */

self.addEventListener('push', (event) => {
  const handlePush = async () => {
    let payload = null;
    if (event.data) {
      try {
        payload = event.data.json();
      } catch {
        try {
          const text = event.data.text();
          payload = { title: 'Nooraya Prayer Reminder', body: text };
        } catch {}
      }
    }

    const title = (payload && payload.title) || 'Hayya ’ala-s-Salah • Prayer Time';
    const body =
      (payload && payload.body) ||
      'It is time for prayer. Tap to open Nooraya and listen to the Adhan.';
    const prayerKey = (payload && payload.prayerKey) || 'fajr';
    const tag = (payload && payload.tag) || `nooraya-prayer-${prayerKey}-${Date.now()}`;
    const targetUrl =
      (payload && payload.url) || `/dashboard/prayer-times?playAdhan=${encodeURIComponent(prayerKey)}`;

    const options = {
      body,
      icon: '/pwa-192x192.png',
      badge: '/favicon-64.png',
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 250, 100, 400],
      data: {
        url: targetUrl,
        prayerKey,
        sentAt: (payload && payload.sentAt) || new Date().toISOString(),
      },
      actions: [
        {
          action: 'play_adhan',
          title: 'Open & Play Adhan',
        },
        {
          action: 'dismiss',
          title: 'Silence',
        },
      ],
    };

    await self.registration.showNotification(title, options);
  };

  event.waitUntil(handlePush());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action || 'play_adhan';
  if (action === 'dismiss') {
    return;
  }

  const prayerKey = data.prayerKey || 'fajr';
  const targetUrl = data.url || `/dashboard/prayer-times?playAdhan=${encodeURIComponent(prayerKey)}`;

  const focusOrOpen = async () => {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of clientList) {
      if ('focus' in client) {
        await client.focus();
        client.postMessage({
          type: 'NOORAYA_PUSH_NOTIFICATION_CLICK',
          action,
          prayerKey,
          url: targetUrl,
        });
        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  };

  event.waitUntil(focusOrOpen());
});
