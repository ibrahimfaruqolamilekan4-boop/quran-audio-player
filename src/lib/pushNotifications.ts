/**
 * Client-Side Web Push & Local Notification Service
 * Coordinates browser PushManager, VAPID keys, and backend sync for Prayer Times.
 */

export interface PushSubscriptionState {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  endpoint?: string;
  error?: string;
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

export function detectPlatformInfo(): { isIOS: boolean; isStandalone: boolean } {
  if (typeof window === 'undefined') return { isIOS: false, isStandalone: false };
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  return { isIOS, isStandalone };
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  const { isIOS, isStandalone } = detectPlatformInfo();

  if (!isPushSupported()) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isIOS,
      isStandalone,
    };
  }

  const permission = Notification.permission;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: Boolean(sub),
      endpoint: sub?.endpoint,
      isIOS,
      isStandalone,
    };
  } catch (err: any) {
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
      isIOS,
      isStandalone,
      error: err?.message,
    };
  }
}

export async function subscribeToPrayerPush(options: {
  latitude: number;
  longitude: number;
  timezone?: string;
  city?: string;
  country?: string;
  calculationMethod?: string;
  juristic?: string;
  prayerPreferences?: Record<string, boolean>;
}): Promise<{ ok: boolean; message: string; requiresHomeScreen?: boolean }> {
  const { isIOS, isStandalone } = detectPlatformInfo();

  if (isIOS && !isStandalone) {
    // iOS 16.4+ Web Push requires the PWA to be added to the Home Screen
    return {
      ok: false,
      requiresHomeScreen: true,
      message: 'On iPhone/iPad, please add Nooraya to your Home Screen to enable prayer notifications.',
    };
  }

  if (!isPushSupported()) {
    return {
      ok: false,
      message: 'Push notifications are not supported in this browser.',
    };
  }

  // 1. Request permission
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return {
      ok: false,
      message: perm === 'denied' ? 'Notification permission was denied.' : 'Notification permission was not granted.',
    };
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    // 2. Fetch VAPID Public Key from backend
    const vapidRes = await fetch('/api/notifications/vapid-public-key').catch(() => null);
    let appServerKey: Uint8Array | undefined;
    if (vapidRes && vapidRes.ok) {
      const { publicKey } = await vapidRes.json();
      if (publicKey) {
        appServerKey = urlBase64ToUint8Array(publicKey);
      }
    }

    // 3. Subscribe with PushManager
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const subOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };
      if (appServerKey) {
        subOptions.applicationServerKey = appServerKey as any;
      }
      sub = await reg.pushManager.subscribe(subOptions);
    }

    // 4. Send subscription endpoint & coordinates to server
    const payload = {
      endpoint: sub.endpoint,
      keys: sub.toJSON().keys,
      latitude: options.latitude,
      longitude: options.longitude,
      timezone: options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      city: options.city,
      country: options.country,
      calculationMethod: options.calculationMethod,
      juristic: options.juristic,
      prayerPreferences: options.prayerPreferences,
    };

    const saveRes = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!saveRes.ok) {
      throw new Error('Could not persist notification settings on server.');
    }

    return {
      ok: true,
      message: 'Prayer times push notifications enabled successfully.',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Failed to register push notifications.',
    };
  }
}

export async function unsubscribeFromPrayerPush(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!isPushSupported()) return { ok: true, message: 'Push not supported' };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
    return { ok: true, message: 'Prayer push notifications disabled.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Failed to unsubscribe.' };
  }
}
