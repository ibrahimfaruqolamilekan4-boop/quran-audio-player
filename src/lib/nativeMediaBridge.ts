/**
 * Phase 1C & Phase 2: Capacitor Native Audio, Offline Alarm & Reliability Bridge
 *
 * Detects whether Nooraya is running inside a native iOS/Android Capacitor shell
 * (`window.Capacitor?.isNativePlatform()`) vs. a Standalone PWA vs. a mobile browser tab,
 * and bridges to our custom native `NoorayaAdhan` Capacitor plugin (Kotlin on Android,
 * Swift on iOS) for offline closed-app prayer notifications, full Adhan foreground playback,
 * and Adhan Reliability Check system deep-links.
 */

import type { ScheduledOfflinePrayerAlarm } from './offlinePrayerScheduler';

export type RuntimePlatformMode =
  | 'capacitor-ios'
  | 'capacitor-android'
  | 'pwa-ios'
  | 'pwa-android'
  | 'browser-ios'
  | 'browser-android'
  | 'desktop';

export type NativeSettingTarget =
  | 'notifications'
  | 'exact_alarms'
  | 'battery_optimization'
  | 'oem_autostart'
  | 'channel_sound'
  | 'dnd';

export interface NativeReliabilityStatus {
  platform: RuntimePlatformMode;
  isNative: boolean;
  notificationsGranted: boolean;
  canScheduleExactAlarms: boolean; // Android 12+ SCHEDULE_EXACT_ALARM
  batteryOptimizationIgnored: boolean; // Android PowerManager.isIgnoringBatteryOptimizations
  oemManufacturer: string; // e.g. 'TECNO', 'INFINIX', 'XIAOMI', 'SAMSUNG', 'OPPO', 'VIVO', 'APPLE', 'WEB'
  oemRequiresAutostartStep: boolean;
  channelSoundConfigured: boolean;
  dndInterruptsAllowed: boolean;
  iosTimeSensitiveAllowed: boolean;
  iosPendingCount: number;
  iosMaxPending: number;
  lastScheduledAtIso: string | null;
  lastBootRescheduleAtIso: string | null;
}

interface NoorayaAdhanPluginApi {
  schedulePrayerAlarms(payload: {
    timezone: string;
    cityName: string;
    alarms: ScheduledOfflinePrayerAlarm[];
  }): Promise<{ scheduledCount: number; exactAlarmUsed: boolean; error?: string }>;
  cancelAllPrayerAlarms(): Promise<{ ok: boolean }>;
  getReliabilityStatus(): Promise<Partial<NativeReliabilityStatus>>;
  openNativeSetting(opts: { target: NativeSettingTarget }): Promise<{ opened: boolean }>;
  stopNativeAdhan(): Promise<{ ok: boolean }>;
  testNativeAdhanIn10Seconds(opts: {
    alarm: ScheduledOfflinePrayerAlarm;
  }): Promise<{ ok: boolean; scheduledForMs?: number; error?: string }>;
}

function getNoorayaAdhanPlugin(): NoorayaAdhanPluginApi | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as any).Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) {
    return null;
  }
  const plugin = cap.Plugins?.NoorayaAdhan;
  return plugin || null;
}

export function detectRuntimePlatform(): RuntimePlatformMode {
  if (typeof window === 'undefined') return 'desktop';

  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    const p = cap.getPlatform?.() || '';
    if (p === 'ios') return 'capacitor-ios';
    if (p === 'android') return 'capacitor-android';
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    (window.navigator as any)?.standalone === true;

  if (isIOS) return isStandalone ? 'pwa-ios' : 'browser-ios';
  if (isAndroid) return isStandalone ? 'pwa-android' : 'browser-android';
  return 'desktop';
}

export function isNativeCapacitorApp(): boolean {
  const mode = detectRuntimePlatform();
  return mode === 'capacitor-ios' || mode === 'capacitor-android';
}

export async function scheduleNativePrayerAlarms(payload: {
  timezone: string;
  cityName: string;
  alarms: ScheduledOfflinePrayerAlarm[];
}): Promise<{ scheduledCount: number; exactAlarmUsed: boolean; error?: string }> {
  const plugin = getNoorayaAdhanPlugin();
  if (!plugin) {
    return {
      scheduledCount: 0,
      exactAlarmUsed: false,
      error: 'Native NoorayaAdhan plugin unavailable (running in Web/PWA mode).',
    };
  }
  try {
    return await plugin.schedulePrayerAlarms(payload);
  } catch (err: any) {
    return {
      scheduledCount: 0,
      exactAlarmUsed: false,
      error: err?.message || 'Failed to schedule native alarms.',
    };
  }
}

export async function cancelNativePrayerAlarms(): Promise<void> {
  const plugin = getNoorayaAdhanPlugin();
  if (!plugin) return;
  try {
    await plugin.cancelAllPrayerAlarms();
  } catch {}
}

export async function getNativeReliabilityStatus(): Promise<NativeReliabilityStatus> {
  const platform = detectRuntimePlatform();
  const isNative = platform === 'capacitor-ios' || platform === 'capacitor-android';
  const notifGranted =
    typeof Notification !== 'undefined' && Notification.permission === 'granted';

  const fallback: NativeReliabilityStatus = {
    platform,
    isNative,
    notificationsGranted: notifGranted,
    canScheduleExactAlarms: false,
    batteryOptimizationIgnored: false,
    oemManufacturer: platform.includes('ios') ? 'APPLE' : platform.includes('android') ? 'ANDROID_WEB' : 'WEB',
    oemRequiresAutostartStep: platform === 'capacitor-android' || platform === 'pwa-android' || platform === 'browser-android',
    channelSoundConfigured: false,
    dndInterruptsAllowed: false,
    iosTimeSensitiveAllowed: false,
    iosPendingCount: 0,
    iosMaxPending: 64,
    lastScheduledAtIso: null,
    lastBootRescheduleAtIso: null,
  };

  const plugin = getNoorayaAdhanPlugin();
  if (!plugin) return fallback;

  try {
    const live = await plugin.getReliabilityStatus();
    return {
      ...fallback,
      ...live,
      platform,
      isNative: true,
    };
  } catch {
    return fallback;
  }
}

export async function openNativeReliabilitySetting(
  target: NativeSettingTarget
): Promise<{ opened: boolean }> {
  const plugin = getNoorayaAdhanPlugin();
  if (!plugin) return { opened: false };
  try {
    return await plugin.openNativeSetting({ target });
  } catch {
    return { opened: false };
  }
}

export async function triggerNativeAdhanTestIn10Seconds(
  alarm: ScheduledOfflinePrayerAlarm
): Promise<{ ok: boolean; scheduledForMs?: number; error?: string }> {
  const plugin = getNoorayaAdhanPlugin();
  if (!plugin) {
    return { ok: false, error: 'Native alarm test requires the installed Android/iOS native app.' };
  }
  try {
    return await plugin.testNativeAdhanIn10Seconds({ alarm });
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not schedule 10-second native Adhan test.' };
  }
}
