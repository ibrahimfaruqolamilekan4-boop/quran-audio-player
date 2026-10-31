// Service Worker Push Notification & Adhan Event Receiver
self.addEventListener('push', function (event) {
  let data = {
    title: 'Prayer Time',
    body: 'Time for prayer has arrived.',
    prayer: 'fajr',
    url: '/prayer-times',
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    vibrate: [200, 100, 200, 100, 300],
    data: {
      url: data.url || '/prayer-times',
      prayer: data.prayer,
    },
    actions: [
      { action: 'open', title: 'Open Nooraya' },
      { action: 'silence', title: 'Silence' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'silence') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'NOORAYA_ADHAN_START',
            prayer: event.notification.data ? event.notification.data.prayer : null,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/prayer-times?autoPlayAdhan=true');
      }
    })
  );
});
