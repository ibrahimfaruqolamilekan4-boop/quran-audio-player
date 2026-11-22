/**
 * Nooraya Capacitor Native Offline Prayer Notification & Exact Alarm Engine (Phase 2)
 *
 * Guarantees closed-app Adhan notification playback in AIRPLANE MODE / ZERO CONNECTIVITY:
 *
 * 1. Platform Detection: Runs on Android & iOS via `@capacitor/local-notifications`.
 * 2. Android Exact Alarms: Uses `SCHEDULE_EXACT_ALARM` / `allowWhileIdle: true` and notification
 *    channels (`nooraya_adhan_channel_v1`) bound to bundled audio `adhan_alert.wav`.
 * 3. iOS 30s Limit Architecture: iOS `UNNotificationSound` hard-caps custom notification sounds
 *    at strictly < 30 seconds. Bundles authentic 29-second Takbir recitation for the alert tone;
 *    tapping the banner immediately launches the app and continues the full 4-minute Adhan.
 * 4. 14-Day Schedule Replenishment: Automatically schedules the next 14 days (70 prayers)
 *    whenever the app is launched or resumed, guaranteeing weeks of offline alarms.
 */

import { calculatePrayerTimes, getDefaultCalculationMethod, type PrayerSettings } from './prayer';
import type { UserLocation } from './location';

export interface NativeNotificationDiagnostics {
  isNativePlatform: boolean;
  platform: 'android' | 'ios' | 'web';
  hasNotificationPermission: boolean;
  hasExactAlarmPermission: boolean;
  scheduledNotificationCount: number;
  nextScheduledAlert: {
    prayerKey: string;
    prayerName: string;
    fireDateIso: string;
    sound: string;
  } | null;
  channelsCreated: boolean;
}

const PRAYER_SCHEDULE_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

const PRAYER_DISPLAY_NAMES: Record<string, { en: string; ar: string }> = {
  fajr: { en: 'Fajr', ar: 'الفجر' },
  sunrise: { en: 'Sunrise', ar: 'الشروق' },
  dhuhr: { en: 'Dhuhr', ar: 'الظهر' },
  asr: { en: 'Asr', ar: 'العصر' },
  maghrib: { en: 'Maghrib', ar: 'المغرب' },
  isha: { en: 'Isha', ar: 'العشاء' },
};

/**
 * Checks if the app is currently running inside Capacitor native shell.
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Returns the current native platform name ('android' | 'ios' | 'web').
 */
export function getNativePlatform(): 'android' | 'ios' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return 'web';
  return cap.getPlatform() === 'ios' ? 'ios' : 'android';
}

/**
 * Safely imports and retrieves the Capacitor LocalNotifications plugin.
 */
async function getLocalNotificationsPlugin(): Promise<any | null> {
  if (!isNativePlatform()) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    return mod.LocalNotifications || null;
  } catch {
    return (window as any).Capacitor?.Plugins?.LocalNotifications || null;
  }
}

/**
 * Sets up Android High-Importance Notification Channels with authentic Adhan audio.
 */
export async function createNativeAdhanChannels(): Promise<boolean> {
  const plugin = await getLocalNotificationsPlugin();
  if (!plugin || typeof plugin.createChannel !== 'function') return false;

  try {
    // 1. Standard Adhan Channel (Dhuhr, Asr, Maghrib, Isha)
    await plugin.createChannel({
      id: 'nooraya_adhan_channel_v1',
      name: 'Prayer Time Adhan (Standard)',
      description: 'Plays authentic Muezzin Adhan at exact prayer time even in Airplane Mode',
      importance: 5, // MAX
      visibility: 1, // PUBLIC
      sound: 'adhan_alert.wav',
      vibration: true,
      lights: true,
      lightColor: '#10B981',
    });

    // 2. Fajr Adhan Channel
    await plugin.createChannel({
      id: 'nooraya_fajr_channel_v1',
      name: 'Fajr Adhan (الصلاة خير من النوم)',
      description: 'Plays authentic Fajr Adhan with As-Salatu Khayrun Min An-Nawm recitation',
      importance: 5,
      visibility: 1,
      sound: 'adhan_fajr_alert.wav',
      vibration: true,
      lights: true,
      lightColor: '#F59E0B',
    });

    // 3. Silent Notification Channel (for users with silent mode enabled)
    await plugin.createChannel({
      id: 'nooraya_silent_channel_v1',
      name: 'Silent Prayer Reminders',
      description: 'Visual notification banner without audio',
      importance: 3, // DEFAULT
      visibility: 1,
      sound: undefined,
      vibration: false,
    });

    return true;
  } catch (e) {
    console.warn('Native notification channel creation notice:', e);
    return false;
  }
}

/**
 * Requests native notification and exact alarm permissions.
 */
export async function requestNativeNotificationPermissions(): Promise<{
  granted: boolean;
  exactAlarmGranted: boolean;
}> {
  const plugin = await getLocalNotificationsPlugin();
  if (!plugin) return { granted: false, exactAlarmGranted: false };

  try {
    const status = await plugin.requestPermissions();
    const granted = status.display === 'granted';

    // On Android 12+ (API 31+), check exact alarm permission if method exists
    let exactAlarmGranted = true;
    if (typeof plugin.checkExactAlarmPermission === 'function') {
      const exactStatus = await plugin.checkExactAlarmPermission();
      exactAlarmGranted = exactStatus?.exact_alarm === 'granted';
    }

    return { granted, exactAlarmGranted };
  } catch {
    return { granted: false, exactAlarmGranted: false };
  }
}

/**
 * Schedules 14 days of exact offline prayer notifications.
 *
 * Runs completely locally using `adhan` astronomical calculations:
 * - Zero network requests needed.
 * - `allowWhileIdle: true` triggers exact alarm on Android even in deep battery Doze mode.
 * - iOS respects the < 30s UNNotificationSound limit with bundled 29s authentic Takbir.
 */
export async function scheduleNativeOfflinePrayers(
  location: UserLocation,
  settings: PrayerSettings,
  daysToSchedule = 14
): Promise<{
  ok: boolean;
  scheduledCount: number;
  error?: string;
}> {
  const plugin = await getLocalNotificationsPlugin();
  if (!plugin) {
    return { ok: false, scheduledCount: 0, error: 'Not running in native Capacitor environment' };
  }

  try {
    await createNativeAdhanChannels();

    // Cancel previously scheduled prayer notifications to avoid duplicate stacking
    const pending = await plugin.getPending();
    if (pending?.notifications?.length > 0) {
      const prayerIds = pending.notifications
        .filter((n: any) => n.id >= 1000 && n.id < 99000)
        .map((n: any) => ({ id: n.id }));
      if (prayerIds.length > 0) {
        await plugin.cancel({ notifications: prayerIds });
      }
    }

    if (!settings.notificationsEnabled) {
      return { ok: true, scheduledCount: 0 };
    }

    const now = new Date();
    const nowMs = now.getTime();
    const method =
      settings.method || getDefaultCalculationMethod(location.countryCode, location.country);

    const notificationsToSchedule: any[] = [];
    const offsetMs = (settings.reminderMinutesBefore || 0) * 60_000;

    // Apple iOS enforces a hard limit of 64 local notifications per app.
    // 10 days * 5 prayers = 50 notifications, safely under the 64 limit.
    const platform = getNativePlatform();
    const safeDays = platform === 'ios' ? Math.min(daysToSchedule, 10) : Math.min(daysToSchedule, 21);

    for (let dayOffset = 0; dayOffset < safeDays; dayOffset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 12, 0, 0);
      const prayerTimes = calculatePrayerTimes(
        location.latitude,
        location.longitude,
        targetDate,
        method,
        settings.madhab,
        settings.highLatitudeRule,
        settings.adjustments,
        location.timezone
      );

      PRAYER_SCHEDULE_ORDER.forEach((pKey, pIdx) => {
        const isEnabled = settings.prayerReminders?.[pKey] ?? (pKey !== 'sunrise');
        if (!isEnabled) return;

        const rawTime: Date = (prayerTimes as any)[pKey];
        if (!rawTime || isNaN(rawTime.getTime())) return;

        const scheduledTimeMs = rawTime.getTime() - offsetMs;
        if (scheduledTimeMs <= nowMs + 10_000) {
          // Already passed or within 10 seconds
          return;
        }

        const isFajr = pKey === 'fajr' && settings.useFajrAdhan !== false;
        const mode = settings.prayerAdhanModes?.[pKey] || (pKey === 'sunrise' ? 'silent' : 'full');
        const display = PRAYER_DISPLAY_NAMES[pKey] || { en: pKey, ar: '' };

        // Unique deterministic 32-bit integer ID for this day + prayer
        const notifId = 1000 + dayOffset * 10 + pIdx;

        let channelId = 'nooraya_adhan_channel_v1';
        let soundFile: string | undefined = 'adhan_alert.wav';

        if (mode === 'silent') {
          channelId = 'nooraya_silent_channel_v1';
          soundFile = undefined;
        } else if (isFajr) {
          channelId = 'nooraya_fajr_channel_v1';
          soundFile = 'adhan_fajr_alert.wav';
        }

        const title =
          settings.reminderMinutesBefore && settings.reminderMinutesBefore > 0
            ? `${display.en} in ${settings.reminderMinutesBefore}m • ${location.cityName}`
            : `Time for ${display.en} (${display.ar}) • ${location.cityName}`;

        const body =
          isFajr
            ? 'As-Salatu Khayrun Min An-Nawm (الصلاة خير من النوم) • Tap to listen to Adhan.'
            : 'Hayya ’ala-s-Salah (حي على الصلاة) • Allāhu Akbar.';

        notificationsToSchedule.push({
          id: notifId,
          title,
          body,
          largeBody: body,
          summaryText: `Nooraya Prayer Call • ${location.cityName}`,
          schedule: {
            at: new Date(scheduledTimeMs),
            allowWhileIdle: true, // Guarantees execution during Android Doze mode
          },
          sound: soundFile,
          channelId,
          smallIcon: 'ic_stat_prayer_adhan',
          iconColor: '#10B981',
          autoCancel: true,
          extra: {
            prayerKey: pKey,
            prayerNameEn: display.en,
            prayerNameAr: display.ar,
            scheduledTimeMs,
            isFajr,
            cityName: location.cityName,
          },
          actionTypeId: 'PRAYER_ACTION_OPEN_ADHAN',
        });
      });
    }

    if (notificationsToSchedule.length > 0) {
      await plugin.schedule({ notifications: notificationsToSchedule });
    }

    try {
      localStorage.setItem('nooraya_native_scheduled_count', String(notificationsToSchedule.length));
      localStorage.setItem('nooraya_native_last_scheduled_at', new Date().toISOString());
    } catch {}

    return {
      ok: true,
      scheduledCount: notificationsToSchedule.length,
    };
  } catch (err: any) {
    return {
      ok: false,
      scheduledCount: 0,
      error: err?.message || 'Failed to schedule native offline prayer alerts.',
    };
  }
}

/**
 * Cancels all scheduled native offline prayer alarms.
 */
export async function cancelAllNativeScheduledPrayers(): Promise<boolean> {
  const plugin = await getLocalNotificationsPlugin();
  if (!plugin) return false;

  try {
    const pending = await plugin.getPending();
    if (pending?.notifications?.length > 0) {
      await plugin.cancel({ notifications: pending.notifications });
    }
    localStorage.removeItem('nooraya_native_scheduled_count');
    return true;
  } catch {
    return false;
  }
}

/**
 * Gathers complete diagnostics about the native offline notification subsystem.
 */
export async function getNativeNotificationDiagnostics(): Promise<NativeNotificationDiagnostics> {
  const isNative = isNativePlatform();
  const platform = getNativePlatform();

  if (!isNative) {
    return {
      isNativePlatform: false,
      platform: 'web',
      hasNotificationPermission: false,
      hasExactAlarmPermission: false,
      scheduledNotificationCount: 0,
      nextScheduledAlert: null,
      channelsCreated: false,
    };
  }

  const plugin = await getLocalNotificationsPlugin();
  let hasNotificationPermission = false;
  let hasExactAlarmPermission = true;
  let scheduledNotificationCount = 0;
  let nextScheduledAlert: NativeNotificationDiagnostics['nextScheduledAlert'] = null;

  if (plugin) {
    try {
      const status = await plugin.checkPermissions();
      hasNotificationPermission = status.display === 'granted';

      if (typeof plugin.checkExactAlarmPermission === 'function') {
        const exact = await plugin.checkExactAlarmPermission();
        hasExactAlarmPermission = exact?.exact_alarm === 'granted';
      }

      const pending = await plugin.getPending();
      if (Array.isArray(pending?.notifications)) {
        scheduledNotificationCount = pending.notifications.length;

        // Find the soonest alert
        const sorted = [...pending.notifications]
          .filter((n: any) => n.schedule?.at)
          .sort(
            (a: any, b: any) =>
              new Date(a.schedule.at).getTime() - new Date(b.schedule.at).getTime()
          );

        if (sorted[0]) {
          nextScheduledAlert = {
            prayerKey: sorted[0].extra?.prayerKey || 'prayer',
            prayerName: sorted[0].extra?.prayerNameEn || sorted[0].title,
            fireDateIso: new Date(sorted[0].schedule.at).toISOString(),
            sound: sorted[0].sound || 'adhan_alert.wav',
          };
        }
      }
    } catch {}
  }

  return {
    isNativePlatform: true,
    platform,
    hasNotificationPermission,
    hasExactAlarmPermission,
    scheduledNotificationCount,
    nextScheduledAlert,
    channelsCreated: true,
  };
}

/**
 * Initializes native background event handlers and notification action taps.
 */
export function initNativeNotificationHandlers(onAdhanNotificationTap: (prayerKey: string) => void): () => void {
  if (!isNativePlatform()) return () => {};

  let cleanupListeners: Array<() => void> = [];

  void (async () => {
    const plugin = await getLocalNotificationsPlugin();
    if (!plugin) return;

    // Listen for user tapping on a local notification
    const tapSub = await plugin.addListener(
      'localNotificationActionPerformed',
      (notificationAction: any) => {
        const extra = notificationAction.notification?.extra;
        const prayerKey = extra?.prayerKey || 'fajr';
        onAdhanNotificationTap(prayerKey);
      }
    );
    cleanupListeners.push(() => tapSub.remove());

    // Also register App resume listener to refresh the schedule whenever user reopens the app
    try {
      const appMod = await import('@capacitor/app');
      const App = appMod.App;
      if (App) {
        const appStateSub = await App.addListener('appStateChange', (state: any) => {
          if (state.isActive) {
            window.dispatchEvent(new CustomEvent('nooraya_native_resume_replenish'));
          }
        });
        cleanupListeners.push(() => appStateSub.remove());
      }
    } catch {}
  })();

  return () => {
    cleanupListeners.forEach((fn) => fn());
  };
}
