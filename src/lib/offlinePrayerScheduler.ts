/**
 * Phase 2A: Offline On-Device Prayer & Adhan Scheduler
 *
 * Computes a rolling 10-day prayer schedule 100% locally on the device using the
 * bundled `adhan` astronomical library + locally cached `UserLocation` and `PrayerSettings`
 * (requires ZERO internet — works in Airplane Mode with the app killed once scheduled).
 *
 * Key Guarantees:
 * - Respects iOS `UNUserNotificationCenter`'s hard 64 pending local notification cap:
 *   schedules up to 59 prayer notifications + 1 Day-9 top-up reminder = max 60 pending.
 * - Deterministic integer IDs (`YYYYMMDD * 10 + prayerIndex`) prevent duplicates and stale alarms.
 * - Resolves real Muezzin audio files (full MP3 for Android Foreground Service + <=28s WAV/CAF clip
 *   for iOS `UNNotificationSound` & Android `NotificationChannel`). If a file is missing, marks
 *   `fallbackToSilentText: true` and NEVER plays a synthetic tone or horn.
 * - Detects timezone, DST offset, clock, location, or settings changes and triggers rescheduling.
 */

import {
  calculatePrayerTimes,
  formatPrayerTime,
  getDefaultCalculationMethod,
  type PrayerSettings,
  type PrayerAdhanMode,
} from './prayer';
import type { UserLocation } from './location';
import {
  OFFICIAL_MUEZZIN_CATALOG_SLOTS,
  type AdhanVoiceRow,
} from './adhanAudio';
import {
  scheduleNativePrayerAlarms,
  isNativeCapacitorApp,
  detectRuntimePlatform,
} from './nativeMediaBridge';
import { isFeatureEnabled } from './featureFlags';

export const IOS_MAX_PENDING_NOTIFICATIONS = 64;
export const SAFE_MAX_PRAYER_ALARMS = 59; // Reserve 1 slot for Day-9 top-up reminder + 4 safety margin
export const TOP_UP_REMINDER_ID = 999001;
export const DEFAULT_SCHEDULE_DAYS = 10;

const SCHEDULE_SNAPSHOT_KEY = 'nooraya_offline_schedule_snapshot_v1';

export type ScheduledPrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

const PRAYER_META: Array<{
  key: ScheduledPrayerKey;
  index: number;
  english: string;
  arabic: string;
}> = [
  { key: 'fajr', index: 1, english: 'Fajr', arabic: 'الفجر' },
  { key: 'sunrise', index: 2, english: 'Sunrise', arabic: 'الشروق' },
  { key: 'dhuhr', index: 3, english: 'Dhuhr', arabic: 'الظهر' },
  { key: 'asr', index: 4, english: 'Asr', arabic: 'العصر' },
  { key: 'maghrib', index: 5, english: 'Maghrib', arabic: 'المغرب' },
  { key: 'isha', index: 6, english: 'Isha', arabic: 'العشاء' },
];

export interface ScheduledOfflinePrayerAlarm {
  id: number;
  dateKey: string; // YYYY-MM-DD in target timezone
  prayerKey: ScheduledPrayerKey | 'top_up_reminder';
  prayerNameEn: string;
  prayerNameAr: string;
  title: string;
  body: string;
  prayerTimeIso: string;
  prayerTimeFormatted: string;
  fireAtMs: number;
  fireAtIso: string;
  reminderMinutesBefore: number;
  mode: PrayerAdhanMode;
  voiceId: string | null;
  muezzinName: string | null;
  fullAudioUrl: string | null;
  notificationClipUrl: string | null;
  nativeSoundResource: string | null; // e.g. 'madinah_standard_28s.wav'
  volume: number; // 0.1 - 1.0
  vibrate: boolean;
  isFajrVariant: boolean;
  hasAudioAsset: boolean;
  fallbackToSilentText: boolean;
  missingAssetReason: string | null;
}

export interface OfflineSchedulePlan {
  generatedAtIso: string;
  timezone: string;
  tzOffsetMinutes: number;
  cityName: string;
  method: string;
  daysCovered: number;
  alarms: ScheduledOfflinePrayerAlarm[];
  topUpReminder: ScheduledOfflinePrayerAlarm | null;
  totalPendingCount: number;
  withinIos64Cap: boolean;
  settingsHash: string;
}

export interface OfflineScheduleSyncResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  platform: string;
  plan: OfflineSchedulePlan;
  nativeResult?: {
    scheduledCount: number;
    exactAlarmUsed: boolean;
    error?: string;
  };
}

/**
 * Converts a clip URL like `/audio/adhan/clips/madinah-standard-28s.wav`
 * into a native bundle/raw-safe filename `madinah_standard_28s.wav` (Android raw requires [a-z0-9_]).
 */
export function toNativeSoundFilename(clipUrl: string | null | undefined): string | null {
  if (!clipUrl) return null;
  const rawName = clipUrl.split('/').pop() || '';
  if (!rawName) return null;
  const dotIdx = rawName.lastIndexOf('.');
  const stem = (dotIdx >= 0 ? rawName.slice(0, dotIdx) : rawName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const ext = dotIdx >= 0 ? rawName.slice(dotIdx).toLowerCase() : '.wav';
  if (!stem) return null;
  return `${stem}${ext}`;
}

/**
 * Deterministic positive 32-bit integer notification ID: YYYYMMDD * 10 + prayerIndex.
 * Example: 2026-11-20 Fajr -> 202611201. Prevents duplicates across reschedules.
 */
export function buildDeterministicAlarmId(dateKey: string, prayerIndex: number): number {
  const digits = dateKey.replace(/-/g, '');
  const numericDay = Number.parseInt(digits, 10);
  if (Number.isNaN(numericDay)) {
    return 100000 + prayerIndex;
  }
  return numericDay * 10 + prayerIndex;
}

function getDateKeyInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function resolveVoiceAsset(
  voices: AdhanVoiceRow[],
  voiceId: string | undefined,
  isFajr: boolean
): {
  voiceId: string | null;
  muezzinName: string | null;
  fullAudioUrl: string | null;
  notificationClipUrl: string | null;
  missingReason: string | null;
} {
  const list = voices.length > 0 ? voices : OFFICIAL_MUEZZIN_CATALOG_SLOTS;
  const chosen =
    (voiceId ? list.find((v) => v.id === voiceId) : null) ||
    list.find((v) => v.is_default) ||
    list[0] ||
    null;

  if (!chosen) {
    return {
      voiceId: null,
      muezzinName: null,
      fullAudioUrl: null,
      notificationClipUrl: null,
      missingReason: 'No Adhan voice available in catalog.',
    };
  }

  const fullAudioUrl = isFajr
    ? chosen.fajr_audio_url || chosen.audio_url || null
    : chosen.audio_url || null;
  const notificationClipUrl = isFajr
    ? chosen.fajr_notification_clip_url || chosen.notification_clip_url || null
    : chosen.notification_clip_url || null;

  const missingReason = !fullAudioUrl
    ? `Full Adhan recording missing for ${chosen.muezzin_name_en}; silent text notification will be used (no synthetic fallback).`
    : !notificationClipUrl
    ? `<=30s notification clip missing for ${chosen.muezzin_name_en}; full file will play on Android foreground service, silent notification on iOS.`
    : null;

  return {
    voiceId: chosen.id,
    muezzinName: chosen.muezzin_name_en,
    fullAudioUrl,
    notificationClipUrl,
    missingReason,
  };
}

export function computeSettingsHash(
  location: Pick<UserLocation, 'latitude' | 'longitude' | 'timezone' | 'cityName'>,
  settings: PrayerSettings,
  tzOffsetMinutes: number
): string {
  const payload = JSON.stringify({
    lat: Math.round(location.latitude * 1000) / 1000,
    lng: Math.round(location.longitude * 1000) / 1000,
    tz: location.timezone,
    tzOff: tzOffsetMinutes,
    m: settings.method,
    md: settings.madhab,
    hl: settings.highLatitudeRule,
    adj: settings.adjustments,
    en: settings.notificationsEnabled,
    rem: settings.prayerReminders,
    modes: settings.prayerAdhanModes,
    voices: settings.prayerVoices,
    offs: settings.prayerReminderOffsets,
    vols: settings.prayerVolumes,
    vib: settings.prayerVibrate,
    v: settings.activeAdhanVoiceId,
    f: settings.useFajrAdhan,
    r: settings.reminderMinutesBefore,
    h24: settings.is24Hour,
  });

  // Simple deterministic FNV-1a 32-bit hash (works in browser, Node, and offline)
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Pure offline schedule generator: builds up to `daysAhead` days of local prayer alarms,
 * capped strictly below iOS's 64-pending-notification limit, plus a Day-9 top-up reminder.
 */
export function buildOfflinePrayerSchedule(params: {
  now?: Date;
  location: Pick<UserLocation, 'latitude' | 'longitude' | 'timezone' | 'cityName' | 'countryCode' | 'country'>;
  settings: PrayerSettings;
  voices?: AdhanVoiceRow[];
  daysAhead?: number;
  maxAlarms?: number;
}): OfflineSchedulePlan {
  const now = params.now || new Date();
  const nowMs = now.getTime();
  const { location, settings } = params;
  const voices = params.voices && params.voices.length > 0 ? params.voices : OFFICIAL_MUEZZIN_CATALOG_SLOTS;
  const daysAhead = Math.max(1, Math.min(14, params.daysAhead ?? DEFAULT_SCHEDULE_DAYS));
  const maxAlarms = Math.max(1, Math.min(SAFE_MAX_PRAYER_ALARMS, params.maxAlarms ?? SAFE_MAX_PRAYER_ALARMS));
  const timezone = location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const method = settings.method || getDefaultCalculationMethod(location.countryCode, location.country);
  const tzOffsetMinutes = now.getTimezoneOffset();
  const settingsHash = computeSettingsHash(location, settings, tzOffsetMinutes);

  if (!settings.notificationsEnabled) {
    return {
      generatedAtIso: now.toISOString(),
      timezone,
      tzOffsetMinutes,
      cityName: location.cityName,
      method,
      daysCovered: 0,
      alarms: [],
      topUpReminder: null,
      totalPendingCount: 0,
      withinIos64Cap: true,
      settingsHash,
    };
  }

  const alarms: ScheduledOfflinePrayerAlarm[] = [];
  const seenIds = new Set<number>();
  const defaultOffsetMins = settings.reminderMinutesBefore || 0;

  for (let dayOffset = 0; dayOffset < daysAhead + 1; dayOffset++) {
    if (alarms.length >= maxAlarms) break;

    const targetDate = new Date(nowMs + dayOffset * 86_400_000);
    const dateKey = getDateKeyInTimezone(targetDate, timezone);
    const prayers = calculatePrayerTimes(
      location.latitude,
      location.longitude,
      targetDate,
      method,
      settings.madhab,
      settings.highLatitudeRule,
      settings.adjustments,
      timezone
    );

    for (const meta of PRAYER_META) {
      if (alarms.length >= maxAlarms) break;

      const enabled = settings.prayerReminders?.[meta.key] ?? (meta.key !== 'sunrise');
      if (!enabled) continue;

      const prayerDate: Date = (prayers as any)[meta.key];
      if (!prayerDate || Number.isNaN(prayerDate.getTime())) continue;

      const perPrayerOffset = settings.prayerReminderOffsets?.[meta.key];
      const reminderMinutesBefore =
        typeof perPrayerOffset === 'number' && !Number.isNaN(perPrayerOffset)
          ? Math.max(0, Math.min(60, perPrayerOffset))
          : defaultOffsetMins;

      const fireAtMs = prayerDate.getTime() - reminderMinutesBefore * 60_000;
      // Only schedule future alarms (at least 15 seconds ahead)
      if (fireAtMs <= nowMs + 15_000) continue;

      const id = buildDeterministicAlarmId(dateKey, meta.index);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const rawMode = settings.prayerAdhanModes?.[meta.key] || (meta.key === 'sunrise' ? 'silent' : 'full');
      const mode: PrayerAdhanMode =
        rawMode === 'takbir' || rawMode === 'silent' ? rawMode : 'full';
      const isFajrVariant = meta.key === 'fajr' && settings.useFajrAdhan !== false;
      const voiceId = settings.prayerVoices?.[meta.key] || settings.activeAdhanVoiceId;
      const voiceAsset = resolveVoiceAsset(voices, voiceId, isFajrVariant);

      const rawVolume = settings.prayerVolumes?.[meta.key];
      const volume =
        typeof rawVolume === 'number' && !Number.isNaN(rawVolume)
          ? Math.max(0.1, Math.min(1, rawVolume))
          : 1;
      const vibrate = settings.prayerVibrate?.[meta.key] ?? (meta.key !== 'sunrise');

      const hasAudioAsset = mode === 'silent' ? false : Boolean(voiceAsset.fullAudioUrl);
      const fallbackToSilentText = mode === 'silent' || !hasAudioAsset;
      const prayerTimeFormatted = formatPrayerTime(prayerDate, settings.is24Hour, timezone);

      const title =
        reminderMinutesBefore > 0
          ? `${meta.english} (${meta.arabic}) in ${reminderMinutesBefore} min • ${location.cityName}`
          : `It is time for ${meta.english} (${meta.arabic}) • ${location.cityName}`;
      const body =
        mode === 'silent'
          ? `${prayerTimeFormatted} • Silent prayer reminder for ${location.cityName}.`
          : !hasAudioAsset
          ? `${prayerTimeFormatted} • Prayer reminder (Adhan audio file unavailable — silent text alert).`
          : isFajrVariant
          ? `${prayerTimeFormatted} • As-salatu khayrun min an-nawm (الصلاة خير من النوم)`
          : `${prayerTimeFormatted} • Hayya ’ala-s-Salah (حي على الصلاة)`;

      alarms.push({
        id,
        dateKey,
        prayerKey: meta.key,
        prayerNameEn: meta.english,
        prayerNameAr: meta.arabic,
        title,
        body,
        prayerTimeIso: prayerDate.toISOString(),
        prayerTimeFormatted,
        fireAtMs,
        fireAtIso: new Date(fireAtMs).toISOString(),
        reminderMinutesBefore,
        mode,
        voiceId: voiceAsset.voiceId,
        muezzinName: voiceAsset.muezzinName,
        fullAudioUrl: fallbackToSilentText ? null : voiceAsset.fullAudioUrl,
        notificationClipUrl: fallbackToSilentText ? null : voiceAsset.notificationClipUrl,
        nativeSoundResource: fallbackToSilentText
          ? null
          : toNativeSoundFilename(voiceAsset.notificationClipUrl),
        volume,
        vibrate,
        isFajrVariant,
        hasAudioAsset,
        fallbackToSilentText,
        missingAssetReason: mode === 'silent' ? null : voiceAsset.missingReason,
      });
    }
  }

  // Schedule a Day-9 (or penultimate scheduled day) gentle reminder to open Nooraya so iOS's 64-cap rolls forward
  let topUpReminder: ScheduledOfflinePrayerAlarm | null = null;
  if (alarms.length >= 5) {
    const lastAlarm = alarms[alarms.length - 1];
    // Fire 24 hours before the last scheduled prayer (or at least 12 hours from now)
    const topUpFireMs = Math.max(nowMs + 12 * 3600_000, lastAlarm.fireAtMs - 24 * 3600_000);
    const topUpDate = new Date(topUpFireMs);
    const topUpDateKey = getDateKeyInTimezone(topUpDate, timezone);
    topUpReminder = {
      id: TOP_UP_REMINDER_ID,
      dateKey: topUpDateKey,
      prayerKey: 'top_up_reminder',
      prayerNameEn: 'Schedule Top-Up',
      prayerNameAr: 'تحديث مواقيت الصلاة',
      title: 'Open Nooraya to refresh upcoming prayer alerts',
      body: 'Your 10-day offline prayer schedule is almost complete. Tap to refresh the next 10 days of Adhan alerts.',
      prayerTimeIso: topUpDate.toISOString(),
      prayerTimeFormatted: formatPrayerTime(topUpDate, settings.is24Hour, timezone),
      fireAtMs: topUpFireMs,
      fireAtIso: topUpDate.toISOString(),
      reminderMinutesBefore: 0,
      mode: 'silent',
      voiceId: null,
      muezzinName: null,
      fullAudioUrl: null,
      notificationClipUrl: null,
      nativeSoundResource: null,
      volume: 1,
      vibrate: true,
      isFajrVariant: false,
      hasAudioAsset: false,
      fallbackToSilentText: true,
      missingAssetReason: null,
    };
  }

  const totalPendingCount = alarms.length + (topUpReminder ? 1 : 0);
  const uniqueDays = new Set(alarms.map((a) => a.dateKey));

  return {
    generatedAtIso: now.toISOString(),
    timezone,
    tzOffsetMinutes,
    cityName: location.cityName,
    method,
    daysCovered: uniqueDays.size,
    alarms,
    topUpReminder,
    totalPendingCount,
    withinIos64Cap: totalPendingCount <= IOS_MAX_PENDING_NOTIFICATIONS,
    settingsHash,
  };
}

export function loadSavedOfflineScheduleSnapshot(): OfflineSchedulePlan | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SCHEDULE_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineSchedulePlan;
  } catch {
    return null;
  }
}

export function saveOfflineScheduleSnapshot(plan: OfflineSchedulePlan): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SCHEDULE_SNAPSHOT_KEY, JSON.stringify(plan));
  } catch {}
}

/**
 * Checks whether a reschedule is required (app open, settings/location changed,
 * timezone or DST offset changed, clock jumped, or fewer than 4 days remain).
 */
export function needsOfflineReschedule(
  previous: OfflineSchedulePlan | null,
  currentHash: string,
  nowMs: number = Date.now()
): { needed: boolean; reason: string } {
  if (!previous) return { needed: true, reason: 'initial_schedule' };
  if (previous.settingsHash !== currentHash) {
    return { needed: true, reason: 'settings_location_or_timezone_changed' };
  }
  const currentOffset = new Date(nowMs).getTimezoneOffset();
  if (previous.tzOffsetMinutes !== currentOffset) {
    return { needed: true, reason: 'dst_or_clock_offset_changed' };
  }
  const generatedMs = Date.parse(previous.generatedAtIso);
  if (Number.isNaN(generatedMs) || nowMs - generatedMs > 12 * 3600_000) {
    return { needed: true, reason: 'daily_top_up_refresh' };
  }
  const remainingFuture = (previous.alarms || []).filter((a) => a.fireAtMs > nowMs);
  if (remainingFuture.length < 20) {
    return { needed: true, reason: 'low_remaining_buffer' };
  }
  return { needed: false, reason: 'up_to_date' };
}

/**
 * Rebuilds the 10-day offline schedule locally and syncs it into the native Android/iOS
 * Capacitor alarm/notification plugin (when running in the native wrapper).
 */
export async function syncOfflinePrayerSchedule(params: {
  location: Pick<UserLocation, 'latitude' | 'longitude' | 'timezone' | 'cityName' | 'countryCode' | 'country'>;
  settings: PrayerSettings;
  voices?: AdhanVoiceRow[];
  force?: boolean;
}): Promise<OfflineScheduleSyncResult> {
  const platform = detectRuntimePlatform();
  const now = new Date();
  const plan = buildOfflinePrayerSchedule({
    now,
    location: params.location,
    settings: params.settings,
    voices: params.voices,
  });

  if (!isFeatureEnabled('nativeOfflineAdhanEngine')) {
    return {
      ok: true,
      skipped: true,
      reason: 'feature_flag_disabled',
      platform,
      plan,
    };
  }

  const prev = loadSavedOfflineScheduleSnapshot();
  const check = needsOfflineReschedule(prev, plan.settingsHash, now.getTime());

  if (!params.force && !check.needed) {
    return {
      ok: true,
      skipped: true,
      reason: check.reason,
      platform,
      plan: prev || plan,
    };
  }

  saveOfflineScheduleSnapshot(plan);

  if (isNativeCapacitorApp()) {
    const allItems = plan.topUpReminder ? [...plan.alarms, plan.topUpReminder] : plan.alarms;
    const nativeResult = await scheduleNativePrayerAlarms({
      timezone: plan.timezone,
      cityName: plan.cityName,
      alarms: allItems,
    });
    return {
      ok: !nativeResult.error,
      reason: check.reason,
      platform,
      plan,
      nativeResult,
    };
  }

  return {
    ok: true,
    reason: check.reason,
    platform,
    plan,
  };
}
