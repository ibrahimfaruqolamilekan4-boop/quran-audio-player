import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Sparkles, PauseCircle } from 'lucide-react';
import {
  calculatePrayerTimes,
  DEFAULT_PRAYER_SETTINGS,
  getDefaultCalculationMethod,
  type PrayerSettings,
  type PrayerAdhanMode,
} from '../lib/prayer';
import { useLocationService } from '../lib/useLocationService';
import {
  fetchActiveAdhanVoices,
  subscribeToAdhanVoices,
  subscribeToAdhanPlaybackState,
  startAdhanPlayback,
  stopAdhanPlayback,
  getAdhanPlaybackState,
  type AdhanVoiceRow,
  type ActiveAdhanPlaybackState,
} from '../lib/adhanAudio';

const SCHEDULED_PRAYERS = [
  { key: 'fajr', english: 'Fajr', arabic: 'الفجر' },
  { key: 'sunrise', english: 'Sunrise', arabic: 'الشروق' },
  { key: 'dhuhr', english: 'Dhuhr', arabic: 'الظهر' },
  { key: 'asr', english: 'Asr', arabic: 'العصر' },
  { key: 'maghrib', english: 'Maghrib', arabic: 'المغرب' },
  { key: 'isha', english: 'Isha', arabic: 'العشاء' },
] as const;

const FIRED_PRAYERS_STORAGE_KEY = 'nooraya_fired_adhan_keys_v1';

function loadPrayerSettings(): PrayerSettings {
  try {
    const raw = localStorage.getItem('nooraya_prayer_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PRAYER_SETTINGS,
        ...parsed,
        adjustments: {
          ...DEFAULT_PRAYER_SETTINGS.adjustments,
          ...(parsed.adjustments || {}),
        },
        prayerReminders: {
          ...DEFAULT_PRAYER_SETTINGS.prayerReminders,
          ...(parsed.prayerReminders || {}),
        },
        prayerAdhanModes: {
          ...DEFAULT_PRAYER_SETTINGS.prayerAdhanModes,
          ...(parsed.prayerAdhanModes || {}),
        },
      };
    }
  } catch {}
  return DEFAULT_PRAYER_SETTINGS;
}

function hasFiredKey(fireKey: string): boolean {
  try {
    const raw = localStorage.getItem(FIRED_PRAYERS_STORAGE_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return Array.isArray(list) && list.includes(fireKey);
  } catch {
    return false;
  }
}

function markKeyFired(fireKey: string): void {
  try {
    const raw = localStorage.getItem(FIRED_PRAYERS_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [fireKey, ...list.filter((k) => k !== fireKey)].slice(0, 30);
    localStorage.setItem(FIRED_PRAYERS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function notifyPrayerSettingsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nooraya_prayer_settings_changed'));
  }
}

export function AdhanSchedulerOverlay() {
  const { location } = useLocationService();
  const [settings, setSettings] = useState<PrayerSettings>(loadPrayerSettings);
  const [voices, setVoices] = useState<AdhanVoiceRow[]>([]);
  const [playback, setPlayback] = useState<ActiveAdhanPlaybackState>(getAdhanPlaybackState);
  const [silentAlertBanner, setSilentAlertBanner] = useState<{
    english: string;
    arabic: string;
  } | null>(null);

  const voicesRef = useRef<AdhanVoiceRow[]>([]);
  voicesRef.current = voices;

  // Keep prayer settings synced across components/tabs
  useEffect(() => {
    const syncSettings = () => setSettings(loadPrayerSettings());
    window.addEventListener('nooraya_prayer_settings_changed', syncSettings);
    window.addEventListener('storage', syncSettings);
    return () => {
      window.removeEventListener('nooraya_prayer_settings_changed', syncSettings);
      window.removeEventListener('storage', syncSettings);
    };
  }, []);

  // Subscribe to Adhan voices from Supabase Realtime
  useEffect(() => {
    fetchActiveAdhanVoices().then(setVoices).catch(() => {});
    const unsub = subscribeToAdhanVoices(setVoices);
    return unsub;
  }, []);

  // Subscribe to Adhan audio playback state
  useEffect(() => {
    return subscribeToAdhanPlaybackState(setPlayback);
  }, []);

  // Listen for Service Worker notification clicks and ?playAdhan=<prayerKey> URL triggers
  useEffect(() => {
    const triggerFromNotification = (prayerKeyRaw: string) => {
      const key = prayerKeyRaw.toLowerCase();
      const matched = SCHEDULED_PRAYERS.find((p) => p.key === key) || SCHEDULED_PRAYERS[0];
      void startAdhanPlayback({
        prayerKey: matched.key,
        prayerNameEn: matched.english,
        prayerNameAr: matched.arabic,
        mode: 'full',
        preferredVoiceId: settings.activeAdhanVoiceId,
        useFajrAdhan: settings.useFajrAdhan !== false,
        voices: voicesRef.current,
      });
    };

    try {
      const params = new URLSearchParams(window.location.search);
      const playAdhanParam = params.get('playAdhan');
      if (playAdhanParam) {
        triggerFromNotification(playAdhanParam);
        params.delete('playAdhan');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {}

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOORAYA_PUSH_NOTIFICATION_CLICK' && event.data?.prayerKey) {
        triggerFromNotification(String(event.data.prayerKey));
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
    }
  }, [settings.activeAdhanVoiceId, settings.useFajrAdhan]);

  // Drift-corrected wall-clock scheduler: re-checks Date.now() every 1,000ms
  // (never relies on a long setTimeout that drifts when the device sleeps)
  useEffect(() => {
    const checkWallClockSchedule = () => {
      if (!settings.notificationsEnabled) return;

      const now = new Date();
      const nowMs = now.getTime();
      const method =
        settings.method || getDefaultCalculationMethod(location.countryCode, location.country);

      const todayPrayers = calculatePrayerTimes(
        location.latitude,
        location.longitude,
        now,
        method,
        settings.madhab,
        settings.highLatitudeRule,
        settings.adjustments,
        location.timezone
      );

      let dateKey = now.toISOString().slice(0, 10);
      try {
        if (location.timezone) {
          dateKey = new Intl.DateTimeFormat('en-CA', {
            timeZone: location.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(now);
        }
      } catch {}

      const offsetMs = (settings.reminderMinutesBefore || 0) * 60 * 1000;

      for (const p of SCHEDULED_PRAYERS) {
        const isReminderEnabled = settings.prayerReminders?.[p.key] ?? (p.key !== 'sunrise');
        if (!isReminderEnabled) continue;

        const mode: PrayerAdhanMode =
          settings.prayerAdhanModes?.[p.key] ||
          (p.key === 'sunrise' ? 'silent' : 'full');

        const rawTime: Date = (todayPrayers as any)[p.key];
        if (!rawTime || isNaN(rawTime.getTime())) continue;

        const targetTimeMs = rawTime.getTime() - offsetMs;
        const deltaMs = nowMs - targetTimeMs;

        // Trigger within a 45-second window of exact prayer wall-clock time
        if (deltaMs >= 0 && deltaMs < 45_000) {
          const fireKey = `${dateKey}:${p.key}:${settings.reminderMinutesBefore || 0}`;
          if (hasFiredKey(fireKey)) continue;

          markKeyFired(fireKey);

          // Optional browser notification when permission is already granted
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(`It is time for ${p.english} (${p.arabic})`, {
                body: `Prayer time in ${location.cityName} • Hayya 'ala-s-Salah`,
                icon: '/pwa-192x192.png',
                tag: `adhan-${fireKey}`,
              });
            }
          } catch {}

          if (mode === 'silent') {
            setSilentAlertBanner({ english: p.english, arabic: p.arabic });
            setTimeout(() => setSilentAlertBanner(null), 20_000);
          } else {
            void startAdhanPlayback({
              prayerKey: p.key,
              prayerNameEn: p.english,
              prayerNameAr: p.arabic,
              mode,
              preferredVoiceId: settings.activeAdhanVoiceId,
              useFajrAdhan: settings.useFajrAdhan !== false,
              voices: voicesRef.current,
            });
          }
          break;
        }
      }
    };

    checkWallClockSchedule();
    const interval = window.setInterval(checkWallClockSchedule, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkWallClockSchedule();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [
    location.latitude,
    location.longitude,
    location.timezone,
    location.cityName,
    location.countryCode,
    location.country,
    settings,
  ]);

  if (!playback.isPlaying && !silentAlertBanner) {
    return null;
  }

  return (
    <div className="fixed top-[calc(12px+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-[80] w-[94%] max-w-xl animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-gradient-to-r from-[#06241B]/95 via-[#093226]/95 to-[#06241B]/95 backdrop-blur-2xl border border-amber-400/40 rounded-2xl p-4 shadow-[0_16px_50px_rgba(0,0,0,0.75)] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0 relative">
            <Volume2 size={20} className="animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                <Sparkles size={10} />
                {playback.mode === 'preview'
                  ? 'Adhan Audio Preview'
                  : silentAlertBanner
                  ? 'Prayer Time (Silent Mode)'
                  : playback.isFajrVariant
                  ? 'Fajr Adhan • الصلاة خير من النوم'
                  : 'Hayya ’ala-s-Salah • Adhan Active'}
              </span>
              {playback.backgroundAudioPaused && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                  <PauseCircle size={10} />
                  Quran / Ambient Paused (Auto-Resumes)
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-white mt-1 truncate">
              {silentAlertBanner
                ? `${silentAlertBanner.english} (${silentAlertBanner.arabic})`
                : `${playback.prayerNameEn || 'Adhan'} ${playback.prayerNameAr ? `• ${playback.prayerNameAr}` : ''}`}
            </h4>
            {playback.muezzinNameEn && !silentAlertBanner && (
              <p className="text-xs text-emerald-200/80 truncate mt-0.5">
                {playback.muezzinNameEn}
                {playback.usedFallbackChime ? ' • Sanctuary Tone (Awaiting Licensed Audio Upload)' : ''}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            stopAdhanPlayback();
            setSilentAlertBanner(null);
          }}
          className="px-4 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition-all shrink-0 cursor-pointer"
        >
          <VolumeX size={15} />
          <span>Stop / Silence Adhan</span>
        </button>
      </div>
    </div>
  );
}
