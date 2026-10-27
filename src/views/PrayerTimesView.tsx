import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  MapPin,
  Calendar,
  Settings2,
  Bell,
  BellOff,
  Volume2,
  ChevronRight,
  Sparkles,
  Search,
  LocateFixed,
  Sun,
  Sunset,
  Moon,
  Sunrise,
  Check,
  ShieldCheck,
  Sliders,
  Plus,
  Minus,
  Info,
  ChevronDown,
  RotateCcw,
  Sparkle,
  Globe,
  WifiOff,
} from 'lucide-react';
import {
  CALCULATION_METHODS,
  DEFAULT_PRAYER_SETTINGS,
  PrayerSettings,
  calculatePrayerTimes,
  formatPrayerTime,
  getHijriDate,
  getDefaultCalculationMethod,
} from '../lib/prayer';
import { useLocationService } from '../lib/useLocationService';
import { LocationPermissionModal } from '../components/LocationPermissionModal';
import { LOCATION_PRIVACY_NOTICE } from '../lib/location';

const PRAYER_NAMES = [
  { key: 'fajr', english: 'Fajr', arabic: 'الفجر', description: 'Dawn to Sunrise', icon: Sunrise },
  { key: 'sunrise', english: 'Sunrise', arabic: 'الشروق', description: 'Solar Disk Appears', icon: Sun },
  { key: 'dhuhr', english: 'Dhuhr', arabic: 'الظهر', description: 'After Solar Noon', icon: Sun },
  { key: 'asr', english: 'Asr', arabic: 'العصر', description: 'Late Afternoon', icon: Sun },
  { key: 'maghrib', english: 'Maghrib', arabic: 'المغرب', description: 'Immediate Sunset', icon: Sunset },
  { key: 'isha', english: 'Isha', arabic: 'العشاء', description: 'Complete Nightfall', icon: Moon },
];

export function PrayerTimesView() {
  const {
    location,
    isRequestingGps,
    gpsError,
    showPrePrompt,
    requestLocation,
    confirmPrePrompt,
    dismissPrePrompt,
    selectCityPreset,
    searchCities,
  } = useLocationService();

  // Load and persist settings
  const [settings, setSettings] = useState<PrayerSettings>(() => {
    try {
      const saved = localStorage.getItem('nooraya_prayer_settings');
      if (saved) return JSON.parse(saved);
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
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Auto-adapt calculation method when user country changes if user hasn't explicitly locked one
  const recommendedMethod = useMemo(() => {
    return getDefaultCalculationMethod(location.countryCode, location.country);
  }, [location.countryCode, location.country]);

  // Keep settings synced to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nooraya_prayer_settings', JSON.stringify(settings));
    } catch {
      // Ignored
    }
  }, [settings]);

  // Network online/offline monitor
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

  // Live clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's Computed Prayers
  const todayPrayers = useMemo(() => {
    return calculatePrayerTimes(
      location.latitude,
      location.longitude,
      currentTime,
      settings.method || recommendedMethod,
      settings.madhab,
      settings.highLatitudeRule,
      settings.adjustments
    );
  }, [
    location.latitude,
    location.longitude,
    currentTime,
    settings.method,
    recommendedMethod,
    settings.madhab,
    settings.highLatitudeRule,
    settings.adjustments,
  ]);

  // Tomorrow's Computed Prayers
  const tomorrowPrayers = useMemo(() => {
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return calculatePrayerTimes(
      location.latitude,
      location.longitude,
      tomorrow,
      settings.method || recommendedMethod,
      settings.madhab,
      settings.highLatitudeRule,
      settings.adjustments
    );
  }, [
    location.latitude,
    location.longitude,
    currentTime,
    settings.method,
    recommendedMethod,
    settings.madhab,
    settings.highLatitudeRule,
    settings.adjustments,
  ]);

  // Determine current & next prayer + live remaining time
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

    const diff = Math.max(0, nextTime.getTime() - nowMs);
    return {
      currentPrayerKey: currentKey,
      nextPrayerKey: nextKey,
      nextPrayerTime: nextTime,
      timeRemainingMs: diff,
    };
  }, [todayPrayers, tomorrowPrayers, currentTime]);

  // Format countdown string
  const countdownFormatted = useMemo(() => {
    const totalSeconds = Math.floor(timeRemainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    };
  }, [timeRemainingMs]);

  // Next 7 Days (Weekly Schedule)
  const weekPrayerTimes = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentTime);
      d.setDate(d.getDate() + i);
      const pt = calculatePrayerTimes(
        location.latitude,
        location.longitude,
        d,
        settings.method || recommendedMethod,
        settings.madhab,
        settings.highLatitudeRule,
        settings.adjustments
      );
      days.push({
        date: d,
        dayName: d.toLocaleDateString([], { weekday: 'short' }),
        dateFormatted: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        prayers: pt,
      });
    }
    return days;
  }, [
    location.latitude,
    location.longitude,
    currentTime,
    settings.method,
    recommendedMethod,
    settings.madhab,
    settings.highLatitudeRule,
    settings.adjustments,
  ]);

  // Next 30 Days (Monthly Schedule)
  const monthPrayerTimes = useMemo(() => {
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(currentTime);
      d.setDate(d.getDate() + i);
      const pt = calculatePrayerTimes(
        location.latitude,
        location.longitude,
        d,
        settings.method || recommendedMethod,
        settings.madhab,
        settings.highLatitudeRule,
        settings.adjustments
      );
      days.push({
        date: d,
        dayName: d.toLocaleDateString([], { weekday: 'short' }),
        dateFormatted: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        prayers: pt,
      });
    }
    return days;
  }, [
    location.latitude,
    location.longitude,
    currentTime,
    settings.method,
    recommendedMethod,
    settings.madhab,
    settings.highLatitudeRule,
    settings.adjustments,
  ]);

  const hijri = useMemo(() => getHijriDate(currentTime), [currentTime]);

  const filteredCities = searchCities(searchCityQuery);

  // Per-prayer minute adjustments handler
  const handleAdjustmentChange = (prayerKey: keyof typeof settings.adjustments, delta: number) => {
    setSettings((s) => ({
      ...s,
      adjustments: {
        ...s.adjustments,
        [prayerKey]: Math.max(-30, Math.min(30, (s.adjustments[prayerKey] || 0) + delta)),
      },
    }));
  };

  const nextPrayerMeta = PRAYER_NAMES.find((p) => p.key === nextPrayerKey);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Educational Location Pre-Prompt Modal */}
      <LocationPermissionModal
        isOpen={showPrePrompt}
        onConfirm={confirmPrePrompt}
        onDismiss={dismissPrePrompt}
        onSelectManual={() => setShowCityPicker(true)}
      />

      {/* Offline Status Badge (when user is offline) */}
      {!isOnline && (
        <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-600/40 text-emerald-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <WifiOff size={15} className="text-emerald-400 shrink-0" />
            <span>
              <strong>Offline Mode Active</strong> — All astronomical prayer times are computed directly on your device.
            </span>
          </div>
          <span className="text-[11px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
            Autonomous
          </span>
        </div>
      )}

      {/* Header Info Banner — Medina Emerald styling */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#061811] via-[#082218] to-[#04120D] border border-emerald-500/20 p-6 md:p-7 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                <Sparkle size={12} className="text-emerald-400" />
                <span>{hijri.full}</span>
              </span>

              <span className="text-xs text-emerald-200/60 font-medium">
                {currentTime.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>

              {location.isGps ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GPS Active
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  Manual City
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-3">
              <span>Prayer Times</span>
              <span className="text-lg font-normal text-emerald-400/80 font-serif">مواقيت الصلاة</span>
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-200/70 mt-1.5">
              <button
                type="button"
                onClick={() => setShowCityPicker(true)}
                className="flex items-center gap-1.5 text-white hover:text-emerald-300 transition-colors font-medium cursor-pointer"
              >
                <MapPin size={14} className="text-emerald-400 shrink-0" />
                <span className="underline decoration-emerald-500/40 decoration-dotted underline-offset-4">
                  {location.cityName}, {location.country}
                </span>
              </button>

              <span className="text-emerald-800">•</span>

              <span className="text-emerald-300/80">
                Method: <strong className="text-white font-semibold">
                  {CALCULATION_METHODS.find((m) => m.id === (settings.method || recommendedMethod))?.shortName}
                </strong>
                {settings.method === recommendedMethod && (
                  <span className="ml-1.5 text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-normal">
                    Auto
                  </span>
                )}
              </span>

              <span className="text-emerald-800">•</span>

              <span className="text-emerald-300/80 capitalize">
                Madhab: <strong className="text-white font-semibold">{settings.madhab}</strong>
              </span>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => requestLocation()}
              disabled={isRequestingGps}
              className="px-3.5 py-2.5 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <LocateFixed size={14} className={isRequestingGps ? 'animate-spin text-emerald-400' : 'text-emerald-400'} />
              <span>{isRequestingGps ? 'Locating...' : 'Auto GPS'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, is24Hour: !s.is24Hour }))}
              className="px-3 py-2.5 rounded-2xl bg-[#030E09] hover:bg-emerald-950/80 border border-emerald-800/60 text-xs font-semibold text-emerald-200 transition-all cursor-pointer font-mono"
            >
              {settings.is24Hour ? '24h' : '12h'}
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all border cursor-pointer ${
                showSettings
                  ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                  : 'bg-[#030E09] hover:bg-emerald-950/80 text-emerald-200 border-emerald-800/60'
              }`}
            >
              <Settings2 size={15} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* City Selector Modal / Dropdown */}
      {showCityPicker && (
        <div className="bg-[#05150F] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-900/60">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe size={16} className="text-emerald-400" />
              Select City from Global Catalog
            </h3>
            <button
              onClick={() => setShowCityPicker(false)}
              className="text-xs text-emerald-400 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-3 text-emerald-500/70" size={16} />
            <input
              type="text"
              placeholder="Search major cities (e.g., Cairo, London, Lagos, New York, Makkah)..."
              value={searchCityQuery}
              onChange={(e) => setSearchCityQuery(e.target.value)}
              className="w-full bg-[#020B07] border border-emerald-900/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-emerald-700 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {filteredCities.map((c) => (
              <button
                key={c.name + c.country}
                type="button"
                onClick={() => {
                  selectCityPreset(c);
                  setSettings((s) => ({
                    ...s,
                    cityName: c.name,
                    country: c.country,
                    countryCode: c.countryCode,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    isGps: false,
                    method: c.defaultMethod || s.method,
                  }));
                  setShowCityPicker(false);
                }}
                className={`text-left p-3 rounded-2xl text-xs transition-all border cursor-pointer ${
                  location.cityName === c.name
                    ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/60 font-semibold shadow-md'
                    : 'bg-[#030E09]/80 hover:bg-emerald-950/60 text-emerald-100/90 border-emerald-950 hover:border-emerald-800'
                }`}
              >
                <div className="font-semibold text-white truncate">{c.name}</div>
                <div className="text-[11px] text-emerald-400/70 truncate">{c.country}</div>
              </button>
            ))}
          </div>

          {/* Privacy Note */}
          <div className="mt-4 pt-3 border-t border-emerald-900/50 flex items-center gap-2 text-[11px] text-emerald-400/80">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span>{LOCATION_PRIVACY_NOTICE}</span>
          </div>
        </div>
      )}

      {/* Settings Drawer / Accordion */}
      {showSettings && (
        <div className="bg-[#05150F] border border-emerald-500/30 rounded-3xl p-6 lg:p-7 shadow-2xl animate-in fade-in duration-200 space-y-6">
          <div className="flex items-center justify-between border-b border-emerald-900/80 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2.5">
              <Settings2 size={18} className="text-emerald-400" />
              Calculation Authority, Juristic & Fine-Tuning Settings
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs text-emerald-400 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Authority Selection */}
            <div>
              <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block mb-2">
                Calculation Authority
              </label>
              <select
                value={settings.method}
                onChange={(e) => setSettings((s) => ({ ...s, method: e.target.value }))}
                className="w-full bg-[#020B07] border border-emerald-800/80 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 mb-2.5"
              >
                {CALCULATION_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Fajr {m.fajrAngle}°, Isha {m.ishaAngle}°)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, method: recommendedMethod }))}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 block mb-4"
              >
                Reset to Recommended for {location.country || 'Current Region'} ({CALCULATION_METHODS.find((m) => m.id === recommendedMethod)?.shortName})
              </button>

              <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block mb-2">
                Asr Juristic Method (Madhab)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, madhab: 'shafi' }))}
                  className={`py-2.5 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
                    settings.madhab === 'shafi'
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/60 shadow-md'
                      : 'bg-[#020B07] text-emerald-400/60 border-emerald-950 hover:border-emerald-800'
                  }`}
                >
                  Standard (Shafi/Maliki)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, madhab: 'hanafi' }))}
                  className={`py-2.5 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
                    settings.madhab === 'hanafi'
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/60 shadow-md'
                      : 'bg-[#020B07] text-emerald-400/60 border-emerald-950 hover:border-emerald-800'
                  }`}
                >
                  Hanafi (Shadow 2x)
                </button>
              </div>
            </div>

            {/* Column 2: High Latitude Rules */}
            <div>
              <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block mb-2">
                High-Latitude Rule (Polar & Extreme North)
              </label>
              <select
                value={settings.highLatitudeRule}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    highLatitudeRule: e.target.value as any,
                  }))
                }
                className="w-full bg-[#020B07] border border-emerald-800/80 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 mb-4"
              >
                <option value="MiddleOfTheNight">Middle of the Night (Default)</option>
                <option value="SeventhOfTheNight">Seventh of the Night</option>
                <option value="TwilightAngle">Twilight Angle Proportion</option>
              </select>

              <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block mb-2">
                Display Format & Mode
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, is24Hour: false }))}
                  className={`py-2 rounded-xl text-xs font-medium border ${
                    !settings.is24Hour
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/60'
                      : 'bg-[#020B07] text-emerald-400/60 border-emerald-950'
                  }`}
                >
                  12-Hour (AM/PM)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, is24Hour: true }))}
                  className={`py-2 rounded-xl text-xs font-medium border ${
                    settings.is24Hour
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/60'
                      : 'bg-[#020B07] text-emerald-400/60 border-emerald-950'
                  }`}
                >
                  24-Hour Military
                </button>
              </div>
            </div>

            {/* Column 3: Fine-Tuning Adjustments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Minute Fine-Tuning
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
                    }))
                  }
                  className="text-[11px] text-emerald-400 hover:text-white"
                >
                  Reset All to 0
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((key) => {
                  const val = settings.adjustments[key] || 0;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-[#020B07] border border-emerald-950 p-2 rounded-xl text-xs"
                    >
                      <span className="font-semibold text-white capitalize">{key}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAdjustmentChange(key, -1)}
                          className="w-6 h-6 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="font-mono min-w-[34px] text-center font-bold text-emerald-300">
                          {val > 0 ? `+${val}` : val}m
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustmentChange(key, 1)}
                          className="w-6 h-6 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Next Prayer Countdown Card — Medina Emerald Theme */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#061C14] via-[#051710] to-[#020B07] border border-emerald-500/40 rounded-3xl p-7 md:p-10 shadow-[0_10px_40px_rgba(4,24,17,0.8)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold mb-3.5 shadow-sm">
              <Sparkles size={13} className="text-emerald-400" />
              <span>Next Upcoming Prayer</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight flex items-baseline gap-4">
              <span>{nextPrayerMeta?.english}</span>
              <span className="text-2xl md:text-3xl font-normal text-emerald-400 font-serif">
                {nextPrayerMeta?.arabic}
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-emerald-200/70 mt-2 flex items-center gap-2">
              <span>Scheduled at</span>
              <span className="text-white font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80">
                {formatPrayerTime(nextPrayerTime, settings.is24Hour)}
              </span>
              <span>•</span>
              <span className="text-emerald-300/80">{nextPrayerMeta?.description}</span>
            </p>
          </div>

          {/* Live Countdown Clock */}
          <div className="flex flex-col md:items-end">
            <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-bold mb-1.5 flex items-center gap-1.5">
              <Clock size={12} className="text-emerald-400" />
              <span>Time Remaining</span>
            </span>

            <div className="flex items-center gap-1.5 sm:gap-2 font-mono">
              <div className="flex flex-col items-center p-2.5 sm:p-3 bg-[#020B07]/90 border border-emerald-500/30 rounded-2xl min-w-[54px] sm:min-w-[64px]">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">{countdownFormatted.hours}</span>
                <span className="text-[9px] uppercase tracking-wider text-emerald-400/80">Hours</span>
              </div>
              <span className="text-2xl font-bold text-emerald-500">:</span>
              <div className="flex flex-col items-center p-2.5 sm:p-3 bg-[#020B07]/90 border border-emerald-500/30 rounded-2xl min-w-[54px] sm:min-w-[64px]">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300">{countdownFormatted.minutes}</span>
                <span className="text-[9px] uppercase tracking-wider text-emerald-400/80">Mins</span>
              </div>
              <span className="text-2xl font-bold text-emerald-500">:</span>
              <div className="flex flex-col items-center p-2.5 sm:p-3 bg-[#020B07]/90 border border-emerald-500/30 rounded-2xl min-w-[54px] sm:min-w-[64px]">
                <span className="text-2xl sm:text-3xl font-extrabold text-teal-400">{countdownFormatted.seconds}</span>
                <span className="text-[9px] uppercase tracking-wider text-emerald-400/80">Secs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Daily Prayer Times Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {PRAYER_NAMES.map((prayer) => {
          const prayerTime: Date = (todayPrayers as any)[prayer.key];
          const isCurrent = currentPrayerKey === prayer.key;
          const isNext = nextPrayerKey === prayer.key;
          const isPassed = currentTime.getTime() > prayerTime.getTime() && !isCurrent;
          const Icon = prayer.icon;

          return (
            <div
              key={prayer.key}
              className={`relative rounded-3xl p-5 transition-all duration-300 flex flex-col justify-between border ${
                isCurrent
                  ? 'bg-gradient-to-b from-emerald-900/60 to-emerald-950/80 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.25)] scale-[1.02]'
                  : isNext
                  ? 'bg-gradient-to-b from-[#092218]/90 to-[#04120D]/90 border-emerald-500/50 hover:border-emerald-400'
                  : isPassed
                  ? 'bg-[#030E09]/60 border-emerald-950/60 opacity-70'
                  : 'bg-[#051710]/80 border-emerald-900/60 hover:border-emerald-700/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/40 font-bold'
                        : isNext
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-emerald-950/60 text-emerald-400/70 border border-emerald-900/60'
                    }`}
                  >
                    <Icon size={19} />
                  </div>
                  <span className="text-xs font-serif text-emerald-300/80">{prayer.arabic}</span>
                </div>

                <div className="text-base font-bold text-white tracking-tight">{prayer.english}</div>
                <div className="text-[11px] text-emerald-300/60 mb-4">{prayer.description}</div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-white tracking-tight mb-2.5">
                  {formatPrayerTime(prayerTime, settings.is24Hour)}
                </div>

                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-950 bg-emerald-400 px-2.5 py-0.5 rounded-full shadow-sm">
                    Current Prayer
                  </span>
                ) : isNext ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                    Next Up
                  </span>
                ) : isPassed ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/50">
                    <Check size={11} /> Passed
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-300/60">Upcoming</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Auxiliary Astronomical Times (Duha, Islamic Midnight, Tahajjud) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Duha Card */}
        <div className="bg-[#051710]/60 border border-emerald-900/60 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-1">
              <Sun size={14} className="text-amber-400" />
              <span>Salat al-Duha (ضحى)</span>
            </div>
            <div className="text-xs text-emerald-300/70">From sunrise +15m to before noon</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-mono text-white">
              {formatPrayerTime(todayPrayers.duha, settings.is24Hour)}
            </div>
            <span className="text-[10px] text-emerald-400/60">Begins</span>
          </div>
        </div>

        {/* Islamic Midnight Card */}
        <div className="bg-[#051710]/60 border border-emerald-900/60 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5 mb-1">
              <Moon size={14} className="text-teal-400" />
              <span>Islamic Midnight (نصف الليل)</span>
            </div>
            <div className="text-xs text-emerald-300/70">Halfway between Maghrib and Fajr</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-mono text-white">
              {formatPrayerTime(todayPrayers.midnight, settings.is24Hour)}
            </div>
            <span className="text-[10px] text-emerald-400/60">Isha end benchmark</span>
          </div>
        </div>

        {/* Tahajjud Card */}
        <div className="bg-[#051710]/60 border border-emerald-900/60 rounded-3xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 mb-1">
              <Sparkles size={14} className="text-emerald-400" />
              <span>Tahajjud / Last Third (التهجد)</span>
            </div>
            <div className="text-xs text-emerald-300/70">Prime time for Qiyam al-Layl</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-mono text-white">
              {formatPrayerTime(todayPrayers.tahajjud, settings.is24Hour)}
            </div>
            <span className="text-[10px] text-emerald-400/60">Final 1/3 Night</span>
          </div>
        </div>
      </div>

      {/* Schedule Tabs (Weekly vs Monthly Forecast) */}
      <div className="bg-[#05150F] border border-emerald-500/20 rounded-3xl p-6 lg:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-emerald-900/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Astronomical Prayer Schedule</h3>
              <p className="text-xs text-emerald-300/60">Complete forward timetable for your exact coordinates</p>
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

        {/* View 1: Tomorrow Preview */}
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
                    {formatPrayerTime(tmrwTime, settings.is24Hour)}
                  </div>
                  <span className="text-[10px] text-emerald-400/50 mt-1">{prayer.arabic}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* View 2 & 3: Weekly / Monthly Table */}
        {(activeTab === 'weekly' || activeTab === 'monthly') && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-emerald-900/80 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <th className="pb-3 px-3">Date</th>
                  <th className="pb-3 px-3">Fajr</th>
                  <th className="pb-3 px-3 text-emerald-400/60">Sunrise</th>
                  <th className="pb-3 px-3">Dhuhr</th>
                  <th className="pb-3 px-3">Asr</th>
                  <th className="pb-3 px-3">Maghrib</th>
                  <th className="pb-3 px-3">Isha</th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm divide-y divide-emerald-950/60 font-mono">
                {(activeTab === 'weekly' ? weekPrayerTimes : monthPrayerTimes).map((day, idx) => {
                  const isToday = idx === 0;
                  return (
                    <tr
                      key={day.dayName + idx}
                      className={
                        isToday
                          ? 'bg-emerald-500/15 text-emerald-200 font-semibold'
                          : 'text-emerald-100/90 hover:bg-emerald-950/30'
                      }
                    >
                      <td className="py-3 px-3 font-sans font-medium flex items-center gap-2">
                        <span>{day.dayName}</span>
                        <span className="text-xs text-emerald-400/60">({day.dateFormatted})</span>
                        {isToday && (
                          <span className="text-[9px] uppercase font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-md">
                            Today
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">{formatPrayerTime(day.prayers.fajr, settings.is24Hour)}</td>
                      <td className="py-3 px-3 text-emerald-400/50">{formatPrayerTime(day.prayers.sunrise, settings.is24Hour)}</td>
                      <td className="py-3 px-3">{formatPrayerTime(day.prayers.dhuhr, settings.is24Hour)}</td>
                      <td className="py-3 px-3">{formatPrayerTime(day.prayers.asr, settings.is24Hour)}</td>
                      <td className="py-3 px-3">{formatPrayerTime(day.prayers.maghrib, settings.is24Hour)}</td>
                      <td className="py-3 px-3">{formatPrayerTime(day.prayers.isha, settings.is24Hour)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
