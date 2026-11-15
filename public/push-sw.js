/**
 * Nooraya Web Push, Offline Audio 206 Range Server & Background Prayer Notification Service Worker Module
 * Imported into Workbox SW via `workbox.importScripts: ['/push-sw.js']`.
 */

const OFFLINE_AUDIO_CACHE = 'quran-offline-audio-v2';

/**
 * Broadcasts diagnostic telemetry to active window clients for `/diag` inspection.
 */
async function postSwAudioDiag(payload) {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of clients) {
      client.postMessage({
        type: 'NOORAYA_SW_AUDIO_DIAG',
        ...payload,
      });
    }
  } catch {}
}

/**
 * Serves cached `/offline-audio/*` files with full RFC 7233 HTTP 206 Partial Content
 * byte-range support required by iOS Safari / WebKit and Android Chrome `<audio>`.
 * Remote audio streams are NEVER intercepted so the browser handles Range requests natively.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let urlObj;
  try {
    urlObj = new URL(req.url);
  } catch {
    return;
  }

  // Only intercept virtual `/offline-audio/` URLs stored in CacheStorage.
  // Never intercept remote CDN MP3s or `/audio/adhan/` static files.
  if (!urlObj.pathname.startsWith('/offline-audio/')) {
    return;
  }

  event.respondWith(
    (async () => {
      const rangeHeader = req.headers.get('range');
      try {
        const cache = await caches.open(OFFLINE_AUDIO_CACHE);
        const cachedResp = await cache.match(urlObj.pathname);
        if (!cachedResp) {
          await postSwAudioDiag({
            event: 'SW_OFFLINE_AUDIO_MISS',
            url: urlObj.pathname,
            status: 404,
            rangeHeader: rangeHeader || null,
          });
          return new Response('Offline audio not found in cache', { status: 404 });
        }

        const fullBuf = await cachedResp.arrayBuffer();
        const total = fullBuf.byteLength;
        const contentType =
          cachedResp.headers.get('Content-Type') || 'audio/mpeg';

        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10) || 0;
          const requestedEnd = parts[1] ? parseInt(parts[1], 10) : total - 1;
          const end = Math.min(requestedEnd, total - 1);

          if (start >= total || start > end) {
            return new Response(null, {
              status: 416,
              headers: {
                'Content-Range': `bytes */${total}`,
                'X-Nooraya-SW': '1',
              },
            });
          }

          const sliced = fullBuf.slice(start, end + 1);
          const contentRange = `bytes ${start}-${end}/${total}`;

          await postSwAudioDiag({
            event: 'SW_OFFLINE_AUDIO_206',
            url: urlObj.pathname,
            status: 206,
            rangeHeader,
            contentRange,
            details: { byteLength: sliced.byteLength, total },
          });

          return new Response(sliced, {
            status: 206,
            statusText: 'Partial Content',
            headers: {
              'Content-Type': contentType,
              'Content-Range': contentRange,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(sliced.byteLength),
              'Cache-Control': 'public, max-age=31536000, immutable',
              'X-Nooraya-SW': '1',
            },
          });
        }

        await postSwAudioDiag({
          event: 'SW_OFFLINE_AUDIO_200',
          url: urlObj.pathname,
          status: 200,
          rangeHeader: null,
          contentRange: `bytes 0-${total - 1}/${total}`,
          details: { total },
        });

        return new Response(fullBuf, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(total),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Nooraya-SW': '1',
          },
        });
      } catch (err) {
        await postSwAudioDiag({
          event: 'SW_OFFLINE_AUDIO_ERROR',
          url: urlObj.pathname,
          status: 500,
          rangeHeader: rangeHeader || null,
          details: { error: err && err.message ? err.message : String(err) },
        });
        return new Response('Offline audio read error', { status: 500 });
      }
    })()
  );
});

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

    // Note: Web Push on Android/iOS uses the OS notification channel sound (not a synthetic oscillator horn).
    // When tapped, it opens `/dashboard/prayer-times?playAdhan=<prayer>` to play the full real Muezzin recording.
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
