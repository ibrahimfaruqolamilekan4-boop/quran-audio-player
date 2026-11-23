import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildOfflinePrayerSchedule,
  needsOfflineReschedule,
  toNativeSoundFilename,
  IOS_MAX_PENDING_NOTIFICATIONS,
  SAFE_MAX_PRAYER_ALARMS,
  TOP_UP_REMINDER_ID,
} from '../offlinePrayerScheduler';
import { DEFAULT_PRAYER_SETTINGS } from '../prayer';
import { OFFICIAL_MUEZZIN_CATALOG_SLOTS, type AdhanVoiceRow } from '../adhanAudio';
import { FEATURE_FLAG_CATALOG, isFeatureEnabled } from '../featureFlags';

const LAGOS_LOCATION = {
  latitude: 6.5244,
  longitude: 3.3792,
  timezone: 'Africa/Lagos',
  cityName: 'Lagos',
  countryCode: 'NG',
  country: 'Nigeria',
};

describe('Phase 2 — Native Offline 10-Day Adhan Scheduler & Real Clip Integrity', () => {
  it('exposes the nativeOfflineAdhanEngine feature flag with rollback plan', () => {
    const flag = FEATURE_FLAG_CATALOG.find((f) => f.key === 'nativeOfflineAdhanEngine');
    expect(flag).toBeDefined();
    expect(flag!.rollbackPlan.length).toBeGreaterThan(20);
    expect(isFeatureEnabled('nativeOfflineAdhanEngine')).toBe(true);
  });

  it('computes a 10-day offline schedule strictly under the iOS 64 pending notification cap with Day-9 top-up reminder', () => {
    const plan = buildOfflinePrayerSchedule({
      now: new Date('2026-11-20T04:00:00.000Z'),
      location: LAGOS_LOCATION,
      settings: {
        ...DEFAULT_PRAYER_SETTINGS,
        notificationsEnabled: true,
        activeAdhanVoiceId: 'nabawi-khashuqji',
      },
      daysAhead: 10,
    });

    expect(plan.daysCovered).toBeGreaterThanOrEqual(7);
    expect(plan.alarms.length).toBeLessThanOrEqual(SAFE_MAX_PRAYER_ALARMS);
    expect(plan.topUpReminder).not.toBeNull();
    expect(plan.topUpReminder?.id).toBe(TOP_UP_REMINDER_ID);
    expect(plan.totalPendingCount).toBe(plan.alarms.length + 1);
    expect(plan.totalPendingCount).toBeLessThanOrEqual(IOS_MAX_PENDING_NOTIFICATIONS);
    expect(plan.withinIos64Cap).toBe(true);

    // Deterministic unique IDs prevent duplicate/stale alarms
    const ids = new Set(plan.alarms.map((a) => a.id));
    expect(ids.size).toBe(plan.alarms.length);
  });

  it('respects per-prayer voice, reminder offset, volume, vibrate, and Fajr clip selection', () => {
    const plan = buildOfflinePrayerSchedule({
      now: new Date('2026-11-20T04:00:00.000Z'),
      location: LAGOS_LOCATION,
      settings: {
        ...DEFAULT_PRAYER_SETTINGS,
        notificationsEnabled: true,
        useFajrAdhan: true,
        activeAdhanVoiceId: 'nabawi-khashuqji',
        prayerVoices: {
          ...DEFAULT_PRAYER_SETTINGS.prayerVoices,
          fajr: 'alafasy-kuwait',
        },
        prayerReminderOffsets: {
          ...DEFAULT_PRAYER_SETTINGS.prayerReminderOffsets,
          dhuhr: 10,
        },
        prayerVolumes: {
          ...DEFAULT_PRAYER_SETTINGS.prayerVolumes,
          asr: 0.6,
        },
        prayerVibrate: {
          ...DEFAULT_PRAYER_SETTINGS.prayerVibrate,
          maghrib: false,
        },
      },
      daysAhead: 2,
    });

    const fajr = plan.alarms.find((a) => a.prayerKey === 'fajr');
    const dhuhr = plan.alarms.find((a) => a.prayerKey === 'dhuhr');
    const asr = plan.alarms.find((a) => a.prayerKey === 'asr');
    const maghrib = plan.alarms.find((a) => a.prayerKey === 'maghrib');

    expect(fajr).toBeDefined();
    expect(fajr?.isFajrVariant).toBe(true);
    expect(fajr?.voiceId).toBe('alafasy-kuwait');
    expect(fajr?.nativeSoundResource).toBe('alafasy_fajr_28s.wav');
    expect(fajr?.fallbackToSilentText).toBe(false);

    expect(dhuhr?.reminderMinutesBefore).toBe(10);
    expect(Date.parse(dhuhr!.prayerTimeIso) - dhuhr!.fireAtMs).toBe(10 * 60_000);

    expect(asr?.volume).toBeCloseTo(0.6, 2);
    expect(maghrib?.vibrate).toBe(false);
  });

  it('falls back strictly to silent text (NEVER synthetic tone) when a voice has null audio URLs', () => {
    const missingVoices: AdhanVoiceRow[] = [
      {
        ...OFFICIAL_MUEZZIN_CATALOG_SLOTS[0],
        id: 'missing-test-voice',
        audio_url: null,
        fajr_audio_url: null,
        notification_clip_url: null,
        fajr_notification_clip_url: null,
      },
    ];

    const plan = buildOfflinePrayerSchedule({
      now: new Date('2026-11-20T04:00:00.000Z'),
      location: LAGOS_LOCATION,
      settings: {
        ...DEFAULT_PRAYER_SETTINGS,
        notificationsEnabled: true,
        activeAdhanVoiceId: 'missing-test-voice',
      },
      voices: missingVoices,
      daysAhead: 2,
    });

    expect(plan.alarms.length).toBeGreaterThan(0);
    for (const alarm of plan.alarms) {
      expect(alarm.hasAudioAsset).toBe(false);
      expect(alarm.fallbackToSilentText).toBe(true);
      expect(alarm.fullAudioUrl).toBeNull();
      expect(alarm.nativeSoundResource).toBeNull();
      expect(alarm.missingAssetReason).toContain('no synthetic fallback');
    }
  });

  it('detects settings/location/timezone/DST changes and low remaining alarm buffer', () => {
    const now = new Date('2026-11-20T04:00:00.000Z');
    const plan = buildOfflinePrayerSchedule({
      now,
      location: LAGOS_LOCATION,
      settings: { ...DEFAULT_PRAYER_SETTINGS, notificationsEnabled: true },
    });

    expect(needsOfflineReschedule(null, plan.settingsHash, now.getTime()).needed).toBe(true);
    expect(needsOfflineReschedule(plan, plan.settingsHash, now.getTime() + 60_000).needed).toBe(false);

    // Settings/location hash change
    expect(needsOfflineReschedule(plan, 'different-hash', now.getTime()).reason).toBe(
      'settings_location_or_timezone_changed'
    );

    // DST / timezone offset shift
    const dstShifted = { ...plan, tzOffsetMinutes: plan.tzOffsetMinutes + 60 };
    expect(needsOfflineReschedule(dstShifted, plan.settingsHash, now.getTime()).reason).toBe(
      'dst_or_clock_offset_changed'
    );

    // Low remaining alarm buffer (< 20 remaining)
    const lowBuffer = { ...plan, alarms: plan.alarms.slice(0, 5) };
    expect(needsOfflineReschedule(lowBuffer, plan.settingsHash, now.getTime() + 60_000).reason).toBe(
      'low_remaining_buffer'
    );
  });

  it('verifies all 6 real 28-second WAV notification clips exist on disk and map cleanly to native filenames', () => {
    expect(toNativeSoundFilename('/audio/adhan/clips/madinah-standard-28s.wav')).toBe(
      'madinah_standard_28s.wav'
    );

    const requiredClips = [
      'alafasy-fajr-28s.wav',
      'alafasy-standard-28s.wav',
      'madinah-fajr-bukhari-28s.wav',
      'madinah-fajr-sunbul-28s.wav',
      'madinah-standard-28s.wav',
      'madinah-surayhee-28s.wav',
    ];

    for (const clip of requiredClips) {
      const fullPath = path.resolve(process.cwd(), 'public/audio/adhan/clips', clip);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(500_000); // ~1.2MB 28s real PCM WAV
    }

    // Android manifest must explicitly remove USE_EXACT_ALARM for Play Store compliance
    const androidManifest = fs.readFileSync(
      path.resolve(process.cwd(), 'native/android/AndroidManifest.adhan.xml'),
      'utf8'
    );
    expect(androidManifest).toContain('SCHEDULE_EXACT_ALARM');
    expect(androidManifest).toContain('USE_EXACT_ALARM');
    expect(androidManifest).toContain('tools:node="remove"');
  });
});
