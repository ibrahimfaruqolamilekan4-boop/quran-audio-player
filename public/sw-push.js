// Service Worker Push Notification & Adhan Receiver
// Phase 1: High reliability, late-delivery guard, full-screen notification click handling

self.addEventListener('push', function (event) {
  let data = {
    title: 'Prayer Time',
    body: 'Time for prayer has arrived.',
    prayer: 'fajr',
    prayerKey: 'fajr',
    prayerName: 'Prayer',
    url: '/dashboard/prayer-times?playAdhan=fajr',
    scheduledTimeIso: null,
    scheduledTimeMs: null,
    formattedTime: null,
    sentAt: null,
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const prayerKey = data.prayerKey || data.prayer || 'fajr';
  const prayerName = data.prayerName || (prayerKey.charAt(0).toUpperCase() + prayerKey.slice(1));
  const formattedTime = data.formattedTime || '';

  // Late Delivery Guard:
  // If the device was offline or sleeping and receives the push > 15 minutes after the scheduled prayer time:
  const now = Date.now();
  const scheduledMs =
    data.scheduledTimeMs ||
    (data.scheduledTimeIso ? new Date(data.scheduledTimeIso).getTime() : 0) ||
    (data.sentAt ? new Date(data.sentAt).getTime() : 0);

  const LATE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
  const isLate = Boolean(scheduledMs > 0 && now - scheduledMs > LATE_THRESHOLD_MS);

  let notificationTitle = data.title;
  let notificationBody = data.body;
  let targetUrl = data.url || `/dashboard/prayer-times?playAdhan=${prayerKey}`;
  let actions = [
    { action: 'open', title: 'Open & Listen' },
    { action: 'silence', title: 'Dismiss' },
  ];

  if (isLate) {
    notificationTitle = formattedTime
      ? `Passed: ${prayerName} was at ${formattedTime}`
      : `Passed: Time for ${prayerName} has passed`;
    notificationBody =
      'Delivered late because your device was offline or reconnecting. Tap to view today’s prayer times.';
    targetUrl = '/dashboard/prayer-times';
    actions = [
      { action: 'open', title: 'Open Prayer Times' },
      { action: 'silence', title: 'Dismiss' },
    ];
  }

  const options = {
    body: notificationBody,
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    vibrate: [200, 100, 200, 100, 300],
    tag: data.tag || `adhan-${prayerKey}`,
    renotify: true,
    data: {
      url: targetUrl,
      prayer: prayerKey,
      prayerKey: prayerKey,
      isLate: isLate,
    },
    actions: actions,
  };

  event.waitUntil(self.registration.showNotification(notificationTitle, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'silence') {
    return;
  }

  const notifData = event.notification.data || {};
  const isLate = Boolean(notifData.isLate);
  const prayerKey = notifData.prayerKey || notifData.prayer || 'fajr';
  const targetUrl =
    notifData.url ||
    (isLate ? '/dashboard/prayer-times' : `/dashboard/prayer-times?playAdhan=${prayerKey}`);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if (!isLate) {
            client.postMessage({
              type: 'NOORAYA_PUSH_NOTIFICATION_CLICK',
              prayerKey: prayerKey,
              prayer: prayerKey,
            });
            client.postMessage({
              type: 'NOORAYA_ADHAN_START',
              prayer: prayerKey,
            });
          }
          if ('navigate' in client && client.url.indexOf('/dashboard/prayer-times') === -1) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Test Notification Scheduler via Service Worker (Client local fallback)
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SCHEDULE_TEST_NOTIFICATION') {
    const delayMs = event.data.delayMs || 10000;
    setTimeout(function () {
      self.registration.showNotification('Test Prayer Notification (10s)', {
        body: 'Allahu Akbar • Time for prayer has arrived. Tap to listen to Adhan.',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        vibrate: [200, 100, 200, 100, 300],
        tag: `nooraya-test-${Date.now()}`,
        data: {
          url: '/dashboard/prayer-times?playAdhan=fajr',
          prayer: 'fajr',
          prayerKey: 'fajr',
          isLate: false,
        },
        actions: [
          { action: 'open', title: 'Open & Play Adhan' },
          { action: 'silence', title: 'Dismiss' },
        ],
      });
    }, delayMs);
  }
});
