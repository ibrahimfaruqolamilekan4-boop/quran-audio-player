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
} from 'lucide-react';
import {
  POPULAR_CITIES,
  CALCULATION_METHODS,
  DEFAULT_PRAYER_SETTINGS,
  PrayerSettings,
  CityLocation,
  calculatePrayerTimes,
  formatPrayerTime,
  getHijriDate,
} from '../lib/prayer';

const PRAYER_NAMES = [
  { key: 'fajr', english: 'Fajr', arabic: 'الفجر', description: 'Dawn', icon: Sunrise },
  { key: 'sunrise', english: 'Sunrise', arabic: 'الشروق', description: 'Sunrise', icon: Sun },
  { key: 'dhuhr', english: 'Dhuhr', arabic: 'الظهر', description: 'Midday', icon: Sun },
  { key: 'asr', english: 'Asr', arabic: 'العصر', description: 'Afternoon', icon: Sun },
  { key: 'maghrib', english: 'Maghrib', arabic: 'المغرب', description: 'Sunset', icon: Sunset },
  { key: 'isha', english: 'Isha', arabic: 'العشاء', description: 'Night', icon: Moon },
];

export function PrayerTimesView() {
  // Load settings from localStorage or defaults
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchCityQuery, setSearchCityQuery] = useState('');
  const [playedReminder, setPlayedReminder] = useState<string | null>(null);

  // Save settings changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nooraya_prayer_settings', JSON.stringify(settings));
    } catch {
      // Ignored
    }
  }, [settings]);

  // Live clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Request GPS
  const handleUseGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings((prev) => ({
          ...prev,
          cityName: 'My Location',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          isGps: true,
        }));
      },
      (err) => {
        alert('Could not retrieve GPS location: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Calculate Today's Prayer Times
  const todayPrayers = useMemo(() => {
    return calculatePrayerTimes(
      settings.latitude,
      settings.longitude,
      currentTime,
      settings.method,
      settings.madhab
    );
  }, [settings.latitude, settings.longitude, currentTime, settings.method, settings.madhab]);

  // Calculate Next Day's Prayer Times (to compute countdown if current time is after Isha)
  const tomorrowPrayers = useMemo(() => {
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return calculatePrayerTimes(
      settings.latitude,
      settings.longitude,
      tomorrow,
      settings.method,
      settings.madhab
    );
  }, [settings.latitude, settings.longitude, currentTime, settings.method, settings.madhab]);

  // Determine current & next prayer
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

  // Play gentle Islamic chime / alert sound
  const playReminderSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  // Convert time remaining to HH:MM:SS
  const countdownFormatted = useMemo(() => {
    const totalSeconds = Math.floor(timeRemainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [timeRemainingMs]);

  // Weekly Prayer Times (Next 7 days)
  const weekPrayerTimes = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentTime);
      d.setDate(d.getDate() + i);
      const pt = calculatePrayerTimes(
        settings.latitude,
        settings.longitude,
        d,
        settings.method,
        settings.madhab
      );
      days.push({
        date: d,
        dayName: d.toLocaleDateString([], { weekday: 'short' }),
        dateFormatted: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        prayers: pt,
      });
    }
    return days;
  }, [settings.latitude, settings.longitude, currentTime, settings.method, settings.madhab]);

  const filteredCities = POPULAR_CITIES.filter((c) =>
    c.name.toLowerCase().includes(searchCityQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header Info Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
              {getHijriDate(currentTime)}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {currentTime.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            Prayer Times
            <span className="text-sm font-normal text-slate-400 font-serif">مواقيت الصلاة</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <MapPin size={14} className="text-teal-400" />
            <span className="text-white font-medium">{settings.cityName}</span>
            <span className="text-slate-600">•</span>
            <span>{CALCULATION_METHODS.find((m) => m.id === settings.method)?.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettings((s) => ({ ...s, is24Hour: !s.is24Hour }))}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all"
          >
            {settings.is24Hour ? '24h' : '12h'} Mode
          </button>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              showCalendar
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Calendar size={14} />
            Weekly View
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              showSettings
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Settings2 size={14} />
            Settings
          </button>
        </div>
      </div>

      {/* Settings Panel Modal / Accordion */}
      {showSettings && (
        <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 shadow-2xl animate-in fade-in duration-200 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Settings2 size={18} className="text-teal-400" />
              Prayer Times Calculation & Notification Settings
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Location selector */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Location & GPS
              </label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleUseGps}
                  className="flex-1 py-2 px-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <LocateFixed size={14} /> Use Device GPS
                </button>
              </div>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Select city..."
                  value={searchCityQuery}
                  onChange={(e) => setSearchCityQuery(e.target.value)}
                  className="w-full bg-[#131722] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {filteredCities.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      setSettings((s) => ({
                        ...s,
                        cityName: c.name,
                        latitude: c.latitude,
                        longitude: c.longitude,
                        isGps: false,
                      }));
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex justify-between items-center ${
                      settings.cityName === c.name
                        ? 'bg-teal-500/20 text-teal-300'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] text-slate-500">{c.country}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Calculation Method */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Calculation Authority
              </label>
              <select
                value={settings.method}
                onChange={(e) => setSettings((s) => ({ ...s, method: e.target.value }))}
                className="w-full bg-[#131722] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 mb-4"
              >
                {CALCULATION_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Asr Juristic Method (Madhab)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettings((s) => ({ ...s, madhab: 'shafi' }))}
                  className={`py-2 rounded-xl text-xs font-medium border ${
                    settings.madhab === 'shafi'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Standard (Shafi/Maliki)
                </button>
                <button
                  onClick={() => setSettings((s) => ({ ...s, madhab: 'hanafi' }))}
                  className={`py-2 rounded-xl text-xs font-medium border ${
                    settings.madhab === 'hanafi'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Hanafi (Later Asr)
                </button>
              </div>
            </div>

            {/* Notification Chime */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Reminders & Audio Chime
              </label>
              <div className="space-y-3">
                <button
                  onClick={() =>
                    setSettings((s) => ({ ...s, notificationsEnabled: !s.notificationsEnabled }))
                  }
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                    settings.notificationsEnabled
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {settings.notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                    Prayer Reminders
                  </span>
                  <span>{settings.notificationsEnabled ? 'Enabled' : 'Disabled'}</span>
                </button>

                <button
                  onClick={playReminderSound}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Volume2 size={14} className="text-teal-400" />
                  Test Audio Chime
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Next Prayer Countdown Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A]/90 via-[#0A0F1C]/90 to-[#020617] border border-teal-500/30 rounded-3xl p-8 md:p-10 shadow-[0_0_50px_rgba(45,212,191,0.08)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-semibold mb-3">
              <Sparkles size={13} className="text-teal-400" />
              <span>Next Prayer</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight flex items-baseline gap-3">
              {PRAYER_NAMES.find((p) => p.key === nextPrayerKey)?.english}
              <span className="text-2xl font-normal text-teal-400 font-serif">
                {PRAYER_NAMES.find((p) => p.key === nextPrayerKey)?.arabic}
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Scheduled at{' '}
              <span className="text-white font-semibold">
                {formatPrayerTime(nextPrayerTime, settings.is24Hour)}
              </span>
            </p>
          </div>

          <div className="flex flex-col md:items-end">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Time Remaining
            </span>
            <div className="text-4xl md:text-5xl font-mono font-bold text-teal-400 tracking-wider drop-shadow-[0_0_20px_rgba(45,212,191,0.3)]">
              {countdownFormatted}
            </div>
          </div>
        </div>
      </div>

      {/* 5 Daily Prayers Grid */}
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
              className={`relative rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between border ${
                isCurrent
                  ? 'bg-teal-500/15 border-teal-500/50 shadow-[0_0_25px_rgba(45,212,191,0.2)] scale-[1.02]'
                  : isNext
                  ? 'bg-[#131722]/90 border-teal-500/30 hover:border-teal-500/50'
                  : isPassed
                  ? 'bg-[#0A0F1C]/60 border-slate-800/60 opacity-70'
                  : 'bg-[#0A0F1C]/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isCurrent
                        ? 'bg-teal-500 text-[#020617] shadow-lg'
                        : isNext
                        ? 'bg-teal-500/20 text-teal-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <span className="text-xs font-serif text-slate-400">{prayer.arabic}</span>
                </div>

                <div className="text-sm font-bold text-white tracking-tight">{prayer.english}</div>
                <div className="text-[11px] text-slate-400 mb-4">{prayer.description}</div>
              </div>

              <div>
                <div className="text-xl font-bold font-mono text-white tracking-tight mb-2">
                  {formatPrayerTime(prayerTime, settings.is24Hour)}
                </div>

                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md">
                    Current Prayer
                  </span>
                ) : isNext ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    Next Up
                  </span>
                ) : isPassed ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                    <Check size={10} /> Completed
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-500">Upcoming</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Schedule View */}
      {showCalendar && (
        <div className="bg-[#0A0F1C]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-2xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar size={20} className="text-teal-400" />
              7-Day Prayer Schedule
            </h3>
            <span className="text-xs text-slate-400">Weekly Forecast</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-4">Day</th>
                  <th className="pb-3 px-4">Fajr</th>
                  <th className="pb-3 px-4">Sunrise</th>
                  <th className="pb-3 px-4">Dhuhr</th>
                  <th className="pb-3 px-4">Asr</th>
                  <th className="pb-3 px-4">Maghrib</th>
                  <th className="pb-3 px-4">Isha</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/60 font-mono">
                {weekPrayerTimes.map((day, idx) => {
                  const isToday = idx === 0;
                  return (
                    <tr
                      key={day.dayName + idx}
                      className={isToday ? 'bg-teal-500/10 text-teal-200 font-semibold' : 'text-slate-300 hover:bg-slate-800/30'}
                    >
                      <td className="py-3.5 px-4 font-sans font-medium flex items-center gap-2">
                        <span>{day.dayName}</span>
                        <span className="text-xs text-slate-500">({day.dateFormatted})</span>
                        {isToday && (
                          <span className="text-[10px] uppercase font-bold bg-teal-500 text-slate-900 px-1.5 py-0.5 rounded">
                            Today
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{formatPrayerTime(day.prayers.fajr, settings.is24Hour)}</td>
                      <td className="py-3.5 px-4 text-slate-500">{formatPrayerTime(day.prayers.sunrise, settings.is24Hour)}</td>
                      <td className="py-3.5 px-4">{formatPrayerTime(day.prayers.dhuhr, settings.is24Hour)}</td>
                      <td className="py-3.5 px-4">{formatPrayerTime(day.prayers.asr, settings.is24Hour)}</td>
                      <td className="py-3.5 px-4">{formatPrayerTime(day.prayers.maghrib, settings.is24Hour)}</td>
                      <td className="py-3.5 px-4">{formatPrayerTime(day.prayers.isha, settings.is24Hour)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
