import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun,
  Sunset,
  Moon,
  Sunrise,
  ShieldCheck,
  Calendar,
  WifiOff,
} from 'lucide-react';
import {
  DEFAULT_PRAYER_SETTINGS,
  PrayerSettings,
  calculatePrayerTimes,
  formatPrayerTime,
  getHijriDate,
  getDefaultCalculationMethod,
} from '../../lib/prayer';
import { useLocationService } from '../../lib/useLocationService';
import { LocationPermissionModal } from '../../components/LocationPermissionModal';
import {
  PRIVACY_POLICY_SECTIONS,
  getTimezoneOffsetInfo,
  type CityPreset,
} from '../../lib/location';
import {
  fetchActiveAdhanVoices,
  subscribeToAdhanVoices,
  subscribeToAdhanPlaybackState,
  getAdhanPlaybackState,
  type AdhanVoiceRow,
} from '../../lib/adhanAudio';
import { notifyPrayerSettingsUpdated } from '../../components/AdhanSchedulerOverlay';
import { PushNotificationsPanel } from '../../components/PushNotificationsPanel';
import { AdhanReliabilityCheck } from '../../components/AdhanReliabilityCheck';
import { useAuth } from '../../context/AuthContext';

import { PrayerHeader } from './PrayerHeader';
import { PrayerSettingsPanel } from './PrayerSettingsPanel';
import { AdhanVoiceSelector } from './AdhanVoiceSelector';
import { DailyPrayerList } from './DailyPrayerList';
import { WeeklyPrayerGrid } from './WeeklyPrayerGrid';
import { MonthlyPrayerGrid } from './MonthlyPrayerGrid';

export const PRAYER_NAMES = [
  { key: 'fajr', english: 'Fajr', arabic: 'الفجر', description: 'Dawn to Sunrise', icon: Sunrise },
  { key: 'sunrise', english: 'Sunrise', arabic: 'الشروق', description: 'Solar Disk Appears', icon: Sun },
  { key: 'dhuhr', english: 'Dhuhr', arabic: 'الظهر', description: 'After Solar Noon', icon: Sun },
  { key: 'asr', english: 'Asr', arabic: 'العصر', description: 'Late Afternoon', icon: Sun },
  { key: 'maghrib', english: 'Maghrib', arabic: 'المغرب', description: 'Immediate Sunset', icon: Sunset },
  { key: 'isha', english: 'Isha', arabic: 'العشاء', description: 'Complete Nightfall', icon: Moon },
];

export function PrayerTimesView() {
  const { user } = useAuth();
  const isPremiumUser = Boolean((user as any)?.is_premium || (user as any)?.isPremium);
  const {
    location,
    isRequestingGps,
    gpsError,
    showPrePrompt,
    isSearchingCities,
    requestLocation,
    confirmPrePrompt,
    dismissPrePrompt,
    selectCityPreset,
    searchCities,
    searchCitiesGlobal,
  } = useLocationService();

  const [settings, setSettings] = useState<PrayerSettings>(() => {
    try {
      const saved = localStorage.getItem('nooraya_prayer_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
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
          prayerVoices: {
            ...(DEFAULT_PRAYER_SETTINGS.prayerVoices || {}),
            ...(parsed.prayerVoices || {}),
          },
          prayerReminderOffsets: {
            ...(DEFAULT_PRAYER_SETTINGS.prayerReminderOffsets || {}),
            ...(parsed.prayerReminderOffsets || {}),
          },
          prayerVolumes: {
            ...(DEFAULT_PRAYER_SETTINGS.prayerVolumes || {}),
            ...(parsed.prayerVolumes || {}),
          },
          prayerVibrate: {
            ...(DEFAULT_PRAYER_SETTINGS.prayerVibrate || {}),
            ...(parsed.prayerVibrate || {}),
          },
        };
      }
    } catch {
      // Ignored
    }
    return DEFAULT_PRAYER_SETTINGS;
  });

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [searchCityQuery, setSearchCityQuery] = useState('');
  const [filteredCities, setFilteredCities] = useState<CityPreset[]>(() => searchCities(''));
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [adhanVoices, setAdhanVoices] = useState<AdhanVoiceRow[]>([]);
  const [adhanPlayback, setAdhanPlayback] = useState(getAdhanPlaybackState);

  // Subscribe to Admin-managed Adhan voices via Supabase Realtime
  useEffect(() => {
    fetchActiveAdhanVoices().then((list) => {
      setAdhanVoices(list);
      const defaultRow = list.find((v) => v.is_default) || list[0];
      if (defaultRow) {
        setSettings((prev) => {
          if (prev.activeAdhanVoiceId && list.some((v) => v.id === prev.activeAdhanVoiceId)) {
            return prev;
          }
          return { ...prev, activeAdhanVoiceId: defaultRow.id };
        });
      }
    }).catch(() => {});
    return subscribeToAdhanVoices(setAdhanVoices);
  }, []);

  // Subscribe to Adhan playback state
  useEffect(() => {
    return subscribeToAdhanPlaybackState(setAdhanPlayback);
  }, []);

  const recommendedMethod = useMemo(() => {
    return getDefaultCalculationMethod(location.countryCode, location.country);
  }, [location.countryCode, location.country]);

  const tzInfo = useMemo(() => {
    return getTimezoneOffsetInfo(location.timezone, currentTime);
  }, [location.timezone, currentTime]);

  useEffect(() => {
    let cancelled = false;
    const local = searchCities(searchCityQuery);
    setFilteredCities(local);

    if (searchCityQuery.trim().length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      const results = await searchCitiesGlobal(searchCityQuery);
      if (!cancelled) {
        setFilteredCities(results);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchCityQuery, searchCities, searchCitiesGlobal]);

  useEffect(() => {
    try {
      localStorage.setItem('nooraya_prayer_settings', JSON.stringify(settings));
      notifyPrayerSettingsUpdated();
    } catch {
      // Ignored
    }
  }, [settings]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const targetCalendarDateKey = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: location.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(currentTime);
    } catch {
      return currentTime.toDateString();
    }
  }, [currentTime, location.timezone]);

  const todayPrayers = useMemo(() => {
    return calculatePrayerTimes(
      location.latitude,
      location.longitude,
      currentTime,
      settings.method || recommendedMethod,
      settings.madhab,
      settings.highLatitudeRule,
      settings.adjustments,
      location.timezone
    );
  }, [
    location.latitude,
    location.longitude,
    location.timezone,
    targetCalendarDateKey,
    settings.method,
    recommendedMethod,
    settings.madhab,
    settings.highLatitudeRule,
    settings.adjustments,
  ]);

  const tomorrowPrayers = useMemo(() => {
    const tomorrow = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
    return calculatePrayerTimes(
      location.latitude,
      location.longitude,
      tomorrow,
      settings.method || recommendedMethod,
      settings.madhab,
      settings.highLatitudeRule,
      settings.adjustments,
      location.timezone
    );
  }, [
    location.latitude,
    location.longitude,
    location.timezone,
    targetCalendarDateKey,
    settings.method,
    recommendedMethod,
    settings.madhab,
    settings.highLatitudeRule,
    settings.adjustments,
  ]);

  const { currentPrayerKey, nextPrayerKey, nextPrayerTime, timeRemainingMs } = useMemo(() => {
    const times = [
      { key: 'fajr', time: todayPrayers.fajr },
      { key: 'sunrise', time: todayPrayers.sunrise },
      { key: 'dhuhr', time: todayPrayers.dhuhr },
      { key: 'asr', time: todayPrayers.asr },
      { key: 'maghrib', time: todayPrayers.maghrib },
      { key: 'isha', time: todayPrayers.isha },
    ];

    const nowMs = currentTime.getTime();
    let currentKey = 'isha';
    let nextKey = 'fajr';
    let nextTime = tomorrowPrayers.fajr;

    if (nowMs < times[0].time.getTime()) {
      currentKey = 'night';
      nextKey = 'fajr';
      nextTime = times[0].time;
    } else {
      for (let i = 0; i < times.length; i++) {
        if (nowMs >= times[i].time.getTime()) {
          currentKey = times[i].key;
          if (i < times.length - 1) {
            nextKey = times[i + 1].key;
            nextTime = times[i + 1].time;
          } else {
            nextKey = 'fajr';
            nextTime = tomorrowPrayers.fajr;
          }
        }
      }
    }

    const remaining = Math.max(0, nextTime.getTime() - nowMs);
    return {
      currentPrayerKey: currentKey,
      nextPrayerKey: nextKey,
      nextPrayerTime: nextTime,
      timeRemainingMs: remaining,
    };
  }, [currentTime, todayPrayers, tomorrowPrayers]);

  const countdownFormatted = useMemo(() => {
    const totalSecs = Math.floor(timeRemainingMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    };
  }, [timeRemainingMs]);

  const nextPrayerMeta = PRAYER_NAMES.find((p) => p.key === nextPrayerKey);
  const hijri = useMemo(() => getHijriDate(currentTime), [currentTime]);

  const weekPrayerTimes = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(currentTime.getTime() + i * 24 * 60 * 60 * 1000);
      return {
        date: dayDate,
        dayName: dayDate.toLocaleDateString(undefined, { weekday: 'short', timeZone: location.timezone }),
        dateFormatted: dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: location.timezone }),
        prayers: calculatePrayerTimes(
          location.latitude,
          location.longitude,
          dayDate,
          settings.method || recommendedMethod,
          settings.madhab,
          settings.highLatitudeRule,
          settings.adjustments,
          location.timezone
        ),
      };
    });
  }, [currentTime, location, settings, recommendedMethod]);

  const monthPrayerTimes = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const dayDate = new Date(currentTime.getTime() + i * 24 * 60 * 60 * 1000);
      return {
        date: dayDate,
        dayName: dayDate.toLocaleDateString(undefined, { weekday: 'short', timeZone: location.timezone }),
        dateFormatted: dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: location.timezone }),
        prayers: calculatePrayerTimes(
          location.latitude,
          location.longitude,
          dayDate,
          settings.method || recommendedMethod,
          settings.madhab,
          settings.highLatitudeRule,
          settings.adjustments,
          location.timezone
        ),
      };
    });
  }, [currentTime, location, settings, recommendedMethod]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28 text-[#F6F1E4] px-4 sm:px-6">
      {/* Offline Status Pill */}
      {!isOnline && (
        <div className="bg-amber-950/60 border border-amber-500/30 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <WifiOff size={15} className="text-amber-400" />
            <span>Operating offline with on-device astronomical calculation engine.</span>
          </div>
          <span className="font-semibold text-[11px] text-amber-300">Offline Ready</span>
        </div>
      )}

      {/* GPS Error Alert */}
      {gpsError && (
        <div className="bg-red-950/50 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between text-xs text-red-200">
          <span>{gpsError}</span>
          <button
            type="button"
            onClick={() => setShowCityPicker(true)}
            className="underline font-bold text-white hover:text-red-300 cursor-pointer"
          >
            Choose City Manually
          </button>
        </div>
      )}

      {/* Header Info Banner & City Picker */}
      <PrayerHeader
        hijri={hijri}
        currentTime={currentTime}
        location={location}
        tzInfo={tzInfo}
        settings={settings}
        setSettings={setSettings}
        recommendedMethod={recommendedMethod}
        isRequestingGps={isRequestingGps}
        requestLocation={requestLocation}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        showCityPicker={showCityPicker}
        setShowCityPicker={setShowCityPicker}
        searchCityQuery={searchCityQuery}
        setSearchCityQuery={setSearchCityQuery}
        filteredCities={filteredCities}
        isSearchingCities={isSearchingCities}
        selectCityPreset={selectCityPreset}
      />

      {/* Settings Panel */}
      <PrayerSettingsPanel
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        settings={settings}
        setSettings={setSettings}
        recommendedMethod={recommendedMethod}
        country={location.country}
      />

      {/* Adhan Voice Selector */}
      <AdhanVoiceSelector
        adhanVoices={adhanVoices}
        settings={settings}
        setSettings={setSettings}
        adhanPlayback={adhanPlayback}
        isPremiumUser={isPremiumUser}
        prayerNames={PRAYER_NAMES}
      />

      {/* Closed-App Web Push Notifications */}
      <PushNotificationsPanel
        location={location}
        settings={settings}
        voices={adhanVoices}
        onUpdateSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
      />

      {/* Native Offline Schedule & Reliability Check */}
      <AdhanReliabilityCheck
        location={location}
        settings={settings}
        voices={adhanVoices}
      />

      {/* Daily Prayer List (when activeTab is daily) */}
      <DailyPrayerList
        todayPrayers={todayPrayers}
        nextPrayerTime={nextPrayerTime}
        nextPrayerMeta={nextPrayerMeta}
        countdownFormatted={countdownFormatted}
        currentPrayerKey={currentPrayerKey}
        nextPrayerKey={nextPrayerKey}
        currentTime={currentTime}
        settings={settings}
        setSettings={setSettings}
        timezone={location.timezone}
        prayerNames={PRAYER_NAMES}
        adhanPlayback={adhanPlayback}
      />

      {/* Schedule Tabs (Weekly vs Monthly Forecast) */}
      <div className="bg-[#05150F] border border-emerald-500/20 rounded-3xl p-6 lg:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-emerald-900/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Astronomical Prayer Schedule</h3>
              <p className="text-xs text-emerald-300/60">
                Complete forward timetable for {location.cityName} ({location.timezone})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#020B07] p-1 rounded-2xl border border-emerald-900/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('weekly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'monthly'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {activeTab === 'daily' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {PRAYER_NAMES.map((prayer) => {
              const tmrwTime: Date = (tomorrowPrayers as any)[prayer.key];
              const Icon = prayer.icon;
              return (
                <div
                  key={prayer.key}
                  className="bg-[#020B07]/80 border border-emerald-950 p-4 rounded-2xl flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-300">{prayer.english}</span>
                    <Icon size={14} className="text-emerald-500" />
                  </div>
                  <div className="text-lg font-bold font-mono text-white">
                    {formatPrayerTime(tmrwTime, settings.is24Hour, location.timezone)}
                  </div>
                  <span className="text-[10px] text-emerald-400/50 mt-1">{prayer.arabic}</span>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'weekly' && (
          <WeeklyPrayerGrid
            weekPrayerTimes={weekPrayerTimes}
            is24Hour={settings.is24Hour}
            timezone={location.timezone}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlyPrayerGrid
            monthPrayerTimes={monthPrayerTimes}
            is24Hour={settings.is24Hour}
            timezone={location.timezone}
          />
        )}
      </div>

      {/* Location & Prayer Privacy Policy Disclosure */}
      <div className="bg-[#04120C] border border-emerald-900/50 rounded-3xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <span>Privacy Policy — Location &amp; Prayer Calculations</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRIVACY_POLICY_SECTIONS.map((sec) => (
            <div key={sec.title} className="bg-[#020B07]/70 border border-emerald-950/80 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-white mb-1">{sec.title}</h4>
              <p className="text-[11px] text-emerald-200/70 leading-relaxed">{sec.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Location Permission Modal */}
      {showPrePrompt && (
        <LocationPermissionModal
          onAllow={confirmPrePrompt}
          onDeny={dismissPrePrompt}
          onManual={() => {
            dismissPrePrompt();
            setShowCityPicker(true);
          }}
        />
      )}
    </div>
  );
}
