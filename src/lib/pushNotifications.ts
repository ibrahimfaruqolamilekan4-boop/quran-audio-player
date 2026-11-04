/**
 * Nooraya Web Push & Closed-App Prayer Notifications Client (Phase 3)
 *
 * Manages:
 * - Service Worker registration & PushManager VAPID subscription
 * - Syncing opted-in prayer schedule + coordinates to `/api/push/subscribe` (Supabase `push_subscriptions`)
 * - Immediate removal of server coordinates on opt-out (`/api/push/unsubscribe`)
 * - iOS "Add to Home Screen" requirement detection (iOS 16.4+ Web Push rule)
 * - "Send Test Notification" verification
 * - Full User + Admin Push Diagnostics
 */

import type { UserLocation } from './location';
import type { PrayerSettings } from './prayer';

export interface PlatformPushCapabilities {
  isIOS: boolean;
  isAndroid: boolean;
  isStandalonePWA: boolean;
  isCapacitorNative: boolean;
  iosRequiresHomeScreenInstall: boolean;
  serviceWorkerSupported: boolean;
  pushManagerSupported: boolean;
  notificationSupported: boolean;
  permission: NotificationPermission | 'unsupported';
}

export interface PushDiagnosticsReport {
  capabilities: PlatformPushCapabilities;
  serviceWorkerState: 'active' | 'installing' | 'none' | 'unsupported';
  swScriptUrl: string | null;
  pushSubscribed: boolean;
  endpointHost: string | null;
  endpointPreview: string | null;
  vapidPublicKeyReady: boolean;
  configuredViaEnv: boolean;
  schedulerEngine: string;
  totalActiveSubscriptions: number;
  serverSubscription: {
    id: string;
    cityName: string;
    timezone: string;
    method: string;
    reminderMinutesBefore: number;
    isActive: boolean;
    lastSentPrayerKey: string | null;
    lastSentAt: string | null;
    lastStatus: string | null;
    updatedAt: string | null;
  } | null;
  nextScheduledPrayer: {
    key: string;
    english: string;
    timeIso: string;
    minutesBefore: number;
  } | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function detectPushPlatformCapabilities(): PlatformPushCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isStandalonePWA: false,
      isCapacitorNative: false,
      iosRequiresHomeScreenInstall: false,
      serviceWorkerSupported: false,
      pushManagerSupported: false,
      notificationSupported: false,
      permission: 'unsupported',
    };
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalonePWA =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as any).standalone === true;
  const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());

  const serviceWorkerSupported = 'serviceWorker' in navigator;
  const pushManagerSupported = 'PushManager' in window;
  const notificationSupported = 'Notification' in window;
  const permission: NotificationPermission | 'unsupported' = notificationSupported
    ? Notification.permission
    : 'unsupported';

  return {
    isIOS,
    isAndroid,
    isStandalonePWA,
    isCapacitorNative,
    iosRequiresHomeScreenInstall: isIOS && !isStandalonePWA && !isCapacitorNative,
    serviceWorkerSupported,
    pushManagerSupported,
    notificationSupported,
    permission,
  };
}

/**
 * Ensures an active Service Worker with push support is registered.
 */
export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing && (existing.active || existing.installing || existing.waiting)) {
      return await navigator.serviceWorker.ready;
    }
    // Register /push-sw.js directly if VitePWA SW hasn't registered yet
    const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
    return reg;
  } catch (e) {
    console.warn('Service Worker registration notice:', e);
    return null;
  }
}

/**
 * Fetches the public VAPID key from `/api/push/vapid-public-key` (or client env).
 */
export async function getServerVapidPublicKey(): Promise<string> {
  try {
    const res = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.publicKey) {
        return String(data.publicKey);
      }
    }
  } catch {}

  const envKey = ((import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || '').trim();
  if (envKey && !envKey.startsWith('Bxxxxx')) {
    return envKey;
  }
  throw new Error('Could not retrieve VAPID public key from server.');
}

/**
 * Subscribes the user's device to background Web Push notifications and stores
 * their opted-in coordinates & prayer schedule in Supabase (`push_subscriptions`).
 */
export async function subscribeToPrayerPushNotifications(
  location: UserLocation,
  settings: PrayerSettings
): Promise<{ ok: boolean; error?: string; endpoint?: string }> {
  const caps = detectPushPlatformCapabilities();

  if (caps.iosRequiresHomeScreenInstall) {
    return {
      ok: false,
      error:
        'On iPhone/iPad, tap Share → "Add to Home Screen" and open Nooraya from your Home Screen first to enable background push notifications.',
    };
  }

  if (!caps.notificationSupported || !caps.serviceWorkerSupported || !caps.pushManagerSupported) {
    return {
      ok: false,
      error: 'Web Push is not supported in this browser.',
    };
  }

  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }

  if (perm !== 'granted') {
    return {
      ok: false,
      error:
        'Notification permission was denied. Please enable Notifications for this site in your browser settings.',
    };
  }

  const reg = await ensurePushServiceWorker();
  if (!reg || !reg.pushManager) {
    return {
      ok: false,
      error: 'Service Worker could not be initialized for PushManager.',
    };
  }

  try {
    const publicKey = await getServerVapidPublicKey();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    const subJson = sub.toJSON();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subJson,
        platform: caps.isIOS ? 'ios-pwa' : caps.isAndroid ? 'android-pwa' : 'web',
        cityName: location.cityName,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        method: settings.method,
        madhab: settings.madhab,
        highLatitudeRule: settings.highLatitudeRule,
        adjustments: settings.adjustments,
        prayerReminders: settings.prayerReminders,
        prayerAdhanModes: settings.prayerAdhanModes,
        reminderMinutesBefore: settings.reminderMinutesBefore || 0,
        activeAdhanVoiceId: settings.activeAdhanVoiceId,
        useFajrAdhan: settings.useFajrAdhan !== false,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errData.error || 'Failed to save push subscription on server.',
      };
    }

    try {
      localStorage.setItem('nooraya_push_opted_in', 'true');
      localStorage.setItem('nooraya_push_endpoint', sub.endpoint);
    } catch {}

    return { ok: true, endpoint: sub.endpoint };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Could not subscribe to PushManager.',
    };
  }
}

/**
 * Unsubscribes the device from Web Push and deletes stored coordinates from the server.
 */
export async function unsubscribeFromPrayerPushNotifications(): Promise<{ ok: boolean }> {
  try {
    const savedEndpoint = localStorage.getItem('nooraya_push_endpoint') || '';
    let endpoint = savedEndpoint;

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
      }
    }

    if (endpoint) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }

    localStorage.removeItem('nooraya_push_opted_in');
    localStorage.removeItem('nooraya_push_endpoint');
  } catch {}
  return { ok: true };
}

/**
 * Sends a test push notification via `/api/push/test` (and also triggers the local Service Worker
 * `showNotification` if the user wants immediate verification).
 */
export async function sendTestPushNotification(cityName: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const reg = await ensurePushServiceWorker();
  const sub = await reg?.pushManager?.getSubscription();

  if (sub) {
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          cityName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        return {
          ok: true,
          message: `Server Web Push delivered (HTTP ${data.status}) for ${cityName}! Check your device notification shade.`,
        };
      }
    } catch {}
  }

  // Fallback: Service Worker showNotification if browser is granted
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    if (reg && reg.showNotification) {
      await reg.showNotification('Nooraya Prayer Notification Test • حي على الصلاة', {
        body: `Notifications are active for ${cityName}. Tap to open Nooraya and listen to the Adhan.`,
        icon: '/pwa-192x192.png',
        badge: '/favicon-64.png',
        tag: `nooraya-local-test-${Date.now()}`,
      });
      return {
        ok: true,
        message: `Test notification displayed via Service Worker for ${cityName}!`,
      };
    }

    new Notification('Nooraya Prayer Notification Test • حي على الصلاة', {
      body: `Notifications are active for ${cityName}.`,
      icon: '/pwa-192x192.png',
    });
    return {
      ok: true,
      message: `Test notification displayed for ${cityName}!`,
    };
  }

  return {
    ok: false,
    message: 'Enable Background Push Notifications first to send a test notification.',
  };
}

/**
 * Gathers full client + server diagnostics for the Push & Background Notifications panel.
 */
export async function fetchPushDiagnostics(): Promise<PushDiagnosticsReport> {
  const capabilities = detectPushPlatformCapabilities();
  let serviceWorkerState: 'active' | 'installing' | 'none' | 'unsupported' = capabilities.serviceWorkerSupported
    ? 'none'
    : 'unsupported';
  let swScriptUrl: string | null = null;
  let pushSubscribed = false;
  let endpoint = '';
  let endpointHost: string | null = null;
  let endpointPreview: string | null = null;

  if (capabilities.serviceWorkerSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.active) {
        serviceWorkerState = 'active';
        swScriptUrl = reg.active.scriptURL;
      } else if (reg?.installing || reg?.waiting) {
        serviceWorkerState = 'installing';
      }
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        pushSubscribed = true;
        endpoint = sub.endpoint;
        try {
          const u = new URL(sub.endpoint);
          endpointHost = u.host;
          endpointPreview = `${u.origin}/...${sub.endpoint.slice(-14)}`;
        } catch {
          endpointPreview = sub.endpoint.slice(0, 40) + '...';
        }
      }
    } catch {}
  }

  let serverDiag: any = null;
  try {
    const qParam = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : '';
    const res = await fetch(`/api/push/diagnostics${qParam}`, { cache: 'no-store' });
    if (res.ok) {
      serverDiag = await res.json();
    }
  } catch {}

  return {
    capabilities,
    serviceWorkerState,
    swScriptUrl,
    pushSubscribed,
    endpointHost,
    endpointPreview,
    vapidPublicKeyReady: Boolean(serverDiag?.vapidPublicKeyReady),
    configuredViaEnv: Boolean(serverDiag?.configuredViaEnv),
    schedulerEngine: serverDiag?.schedulerEngine || 'Supabase pg_cron (* * * * *) + /api/push/dispatch',
    totalActiveSubscriptions: Number(serverDiag?.totalActiveSubscriptions || 0),
    serverSubscription: serverDiag?.subscription || null,
    nextScheduledPrayer: serverDiag?.nextScheduledPrayer || null,
  };
}
