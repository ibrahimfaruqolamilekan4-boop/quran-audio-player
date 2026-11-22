import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  PauseCircle,
  Play,
  AlertTriangle,
  X,
  Bell,
} from 'lucide-react';
import {
  calculatePrayerTimes,
  DEFAULT_PRAYER_SETTINGS,
  getDefaultCalculationMethod,
  type PrayerSettings,
  type PrayerAdhanMode,
} from '../lib/prayer';
import { useLocationService } from '../lib/useLocationService';
import type { UserLocation } from '../lib/location';
import {
  fetchActiveAdhanVoices,
  subscribeToAdhanVoices,
  subscribeToAdhanPlaybackState,
  playAdhan,
  stopAdhanPlayback,
  resumeBlockedAdhanFromGesture,
  clearAdhanErrorMessage,
  preloadAndCacheAdhanAudio,
  resolveVoiceForPlayback,
  getAdhanPlaybackState,
  type AdhanVoiceRow,
  type ActiveAdhanPlaybackState,
} from '../lib/adhanAudio';

export const SCHEDULED_PRAYERS = [
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
    if (typeof localStorage === 'undefined') return DEFAULT_PRAYER_SETTINGS;
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

const memoryFiredKeys = new Set<string>();

export function clearFiredAdhanKeysForTesting(): void {
  memoryFiredKeys.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FIRED_PRAYERS_STORAGE_KEY);
    }
  } catch {}
}

function hasFiredKey(fireKey: string): boolean {
  if (memoryFiredKeys.has(fireKey)) return true;
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(FIRED_PRAYERS_STORAGE_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return Array.isArray(list) && list.includes(fireKey);
  } catch {
    return false;
  }
}

function markKeyFired(fireKey: string): void {
  memoryFiredKeys.add(fireKey);
  try {
    if (typeof localStorage === 'undefined') return;
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

/**
 * Pure, drift-corrected scheduler evaluation tick (Step 2.2, 2.3 & Step 3 unit tests):
 * - Preloads and caches the next prayer's Adhan audio file when within 15 minutes of prayer time.
 * - Triggers `playAdhan(voiceId, prayer)` when within [0, 45s) of a scheduled prayer time.
 * - Never triggers a stand-in or synthetic tone.
 */
export async function evaluateAdhanSchedulerTick(params: {
  now: Date;
  location: Pick<UserLocation, 'latitude' | 'longitude' | 'timezone' | 'cityName' | 'countryCode' | 'country'>;
  settings: PrayerSettings;
  voices: AdhanVoiceRow[];
  onSilentAlert?: (alert: { english: string; arabic: string }) => void;
}): Promise<{
  triggeredPrayerKey: string | null;
  preloadedUrl: string | null;
}> {
  const { now, location, settings, voices, onSilentAlert } = params;
  if (!settings.notificationsEnabled) {
    return { triggeredPrayerKey: null, preloadedUrl: null };
  }

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
  let preloadedUrl: string | null = null;

  for (const p of SCHEDULED_PRAYERS) {
    const isReminderEnabled = settings.prayerReminders?.[p.key] ?? (p.key !== 'sunrise');
    if (!isReminderEnabled) continue;

    const rawMode = settings.prayerAdhanModes?.[p.key] || (p.key === 'sunrise' ? 'silent' : 'full');
    const mode: PrayerAdhanMode =
      rawMode === 'takbir' || rawMode === 'silent' ? rawMode : 'full';

    const rawTime: Date = (todayPrayers as any)[p.key];
    if (!rawTime || isNaN(rawTime.getTime())) continue;

    const targetTimeMs = rawTime.getTime() - offsetMs;
    const deltaMs = nowMs - targetTimeMs;

    // Preload & cache the next prayer's Adhan file when 0 to 15 minutes before prayer time
    if (deltaMs < 0 && deltaMs >= -15 * 60_000 && mode !== 'silent') {
      const isFajr = p.key === 'fajr' && settings.useFajrAdhan !== false;
      const resolved = resolveVoiceForPlayback(voices, settings.activeAdhanVoiceId, isFajr);
      if (resolved.audioUrl) {
        preloadedUrl = resolved.audioUrl;
        void preloadAndCacheAdhanAudio(resolved.audioUrl);
      }
    }

    // Trigger within a 45-second window of exact prayer wall-clock time
    if (deltaMs >= 0 && deltaMs < 45_000) {
      const fireKey = `${dateKey}:${p.key}:${settings.reminderMinutesBefore || 0}`;
      if (hasFiredKey(fireKey)) continue;

      markKeyFired(fireKey);

      // Standard silent/text notification if browser permission is granted (never plays a synthetic horn)
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`It is time for ${p.english} (${p.arabic})`, {
            body: `Prayer time in ${location.cityName} • Hayya 'ala-s-Salah`,
            icon: '/pwa-192x192.png',
            tag: `adhan-${fireKey}`,
            silent: true,
          });
        }
      } catch {}

      if (mode === 'silent') {
        onSilentAlert?.({ english: p.english, arabic: p.arabic });
        return { triggeredPrayerKey: p.key, preloadedUrl };
      }

      await playAdhan(settings.activeAdhanVoiceId, p.key, {
        mode,
        useFajrAdhan: settings.useFajrAdhan !== false,
        voices,
        trigger: 'scheduled',
      });

      return { triggeredPrayerKey: p.key, preloadedUrl };
    }
  }

  return { triggeredPrayerKey: null, preloadedUrl };
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

  // Subscribe to Adhan voices from Supabase Realtime and preload selected voice
  useEffect(() => {
    fetchActiveAdhanVoices()
      .then((list) => {
        setVoices(list);
        const resolved = resolveVoiceForPlayback(list, settings.activeAdhanVoiceId, false);
        if (resolved.audioUrl) {
          void preloadAndCacheAdhanAudio(resolved.audioUrl);
        }
      })
      .catch(() => {});
    const unsub = subscribeToAdhanVoices(setVoices);
    return unsub;
  }, [settings.activeAdhanVoiceId]);

  // Subscribe to Adhan audio playback state
  useEffect(() => {
    return subscribeToAdhanPlaybackState(setPlayback);
  }, []);

  // Step 2.4: Listen for Service Worker notification clicks and ?playAdhan=<prayerKey> URL triggers
  // Opens a full-screen "It is time for <Prayer>" modal with a big Play Adhan button and auto-starts if allowed.
  useEffect(() => {
    const triggerFromNotification = (prayerKeyRaw: string) => {
      const key = prayerKeyRaw.toLowerCase();
      const matched = SCHEDULED_PRAYERS.find((p) => p.key === key) || SCHEDULED_PRAYERS[0];
      void playAdhan(settings.activeAdhanVoiceId, matched.key, {
        mode: 'full',
        useFajrAdhan: settings.useFajrAdhan !== false,
        voices: voicesRef.current.length > 0 ? voicesRef.current : undefined,
        trigger: 'notification_tap',
        openFullScreenModal: true,
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
  useEffect(() => {
    const checkWallClockSchedule = () => {
      void evaluateAdhanSchedulerTick({
        now: new Date(),
        location,
        settings,
        voices: voicesRef.current,
        onSilentAlert: (alert) => {
          setSilentAlertBanner(alert);
          setTimeout(() => setSilentAlertBanner(null), 20_000);
        },
      });
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

  const showFullScreenModal = playback.notificationTapScreenOpen || playback.autoplayBlocked;
  const hasTopBanner =
    playback.isPlaying || Boolean(playback.errorMessage) || Boolean(silentAlertBanner);

  if (!showFullScreenModal && !hasTopBanner) {
    return null;
  }

  return (
    <>
      {/* Step 2.3 & 2.4: Full-screen "It is time for <Prayer>" Notification Tap / Autoplay-Blocked Screen */}
      {showFullScreenModal && (
        <div className="fixed inset-0 z-[95] bg-[#020B07]/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-gradient-to-b from-[#07261C] to-[#04150F] border border-amber-400/40 rounded-3xl p-6 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.85)] text-center relative">
            <button
              type="button"
              onClick={() => {
                stopAdhanPlayback();
                clearAdhanErrorMessage();
              }}
              className="absolute top-4 right-4 p-2 rounded-full bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200/70 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-300 mx-auto mb-4 shadow-inner">
              <Volume2 size={32} className={playback.isPlaying ? 'animate-pulse' : ''} />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold uppercase tracking-widest">
              <Sparkles size={12} />
              {playback.isFajrVariant ? 'Fajr Prayer • الصلاة خير من النوم' : 'Hayya ’ala-s-Salah • حي على الصلاة'}
            </span>

            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3">
              It is time for {playback.prayerNameEn || 'Prayer'}
            </h2>
            {playback.prayerNameAr && (
              <p className="text-xl font-arabic text-amber-300 mt-1" dir="rtl">
                حان وقت صلاة {playback.prayerNameAr}
              </p>
            )}

            <p className="text-xs text-emerald-200/85 mt-3 font-medium">
              {playback.muezzinNameEn || 'Selected Muezzin'}
              {playback.mosqueEn ? ` • ${playback.mosqueEn}` : ''}
            </p>

            {playback.errorMessage ? (
              <div className="mt-5 p-4 rounded-2xl bg-red-950/70 border border-red-500/40 text-left flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-200 leading-relaxed">
                  {playback.errorMessage}
                </div>
              </div>
            ) : playback.autoplayBlocked || !playback.isPlaying ? (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-2.5">
                  Tap the button below to play the full Adhan recording at full volume.
                </p>
                <button
                  type="button"
                  onClick={() => resumeBlockedAdhanFromGesture()}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#03120C] font-extrabold text-base flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/25 cursor-pointer transition-all"
                >
                  <Play size={20} className="fill-[#03120C]" />
                  <span>Tap to Play Adhan Now</span>
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Playing real Adhan recording...</span>
                </div>
                <button
                  type="button"
                  onClick={() => stopAdhanPlayback()}
                  className="w-full py-3.5 px-6 rounded-2xl bg-red-500/90 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 cursor-pointer transition-all"
                >
                  <VolumeX size={18} />
                  <span>Stop / Silence Adhan</span>
                </button>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-emerald-900/60 text-[11px] text-emerald-300/65 leading-relaxed flex items-start gap-2 text-left">
              <Bell size={13} className="text-amber-400/80 shrink-0 mt-0.5" />
              <span>
                Web browsers use the operating system&apos;s default alert sound when a closed-app push notification arrives; opening Nooraya plays the full Muezzin Adhan.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Floating Banner for Active Playback, Visible Error, or Silent Reminder */}
      {hasTopBanner && !showFullScreenModal && (
        <div className="fixed top-[calc(12px+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-[80] w-[94%] max-w-xl animate-in fade-in slide-in-from-top-4 duration-300">
          {playback.errorMessage ? (
            <div className="bg-gradient-to-r from-[#2A090D]/95 via-[#380C11]/95 to-[#2A090D]/95 backdrop-blur-2xl border border-red-500/45 rounded-2xl p-4 shadow-[0_16px_50px_rgba(0,0,0,0.75)] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/35 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-red-300">
                    Adhan Audio Unavailable (No Synthetic Fallback Played)
                  </div>
                  <p className="text-xs font-semibold text-white mt-0.5 leading-relaxed">
                    {playback.errorMessage}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => clearAdhanErrorMessage()}
                className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-bold shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          ) : (
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
          )}
        </div>
      )}
    </>
  );
}
