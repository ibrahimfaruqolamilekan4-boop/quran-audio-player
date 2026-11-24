import React from 'react';
import {
  Clock,
  Sparkles,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Play,
  Square,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { formatPrayerTime, PrayerSettings, PrayerAdhanMode } from '../../lib/prayer';
import { playAdhanPreview, stopAdhanPlayback } from '../../lib/adhanAudio';

interface DailyPrayerListProps {
  todayPrayers: any;
  nextPrayerTime: Date;
  nextPrayerMeta: { english: string; arabic: string; description: string } | undefined;
  countdownFormatted: { hours: string; minutes: string; seconds: string };
  currentPrayerKey: string;
  nextPrayerKey: string;
  currentTime: Date;
  settings: PrayerSettings;
  setSettings: React.Dispatch<React.SetStateAction<PrayerSettings>>;
  timezone: string;
  prayerNames: Array<{
    key: string;
    english: string;
    arabic: string;
    description: string;
    icon: any;
  }>;
  adhanPlayback: { isPlaying: boolean; currentVoiceId: string | null };
}

export function DailyPrayerList({
  todayPrayers,
  nextPrayerTime,
  nextPrayerMeta,
  countdownFormatted,
  currentPrayerKey,
  nextPrayerKey,
  currentTime,
  settings,
  setSettings,
  timezone,
  prayerNames,
  adhanPlayback,
}: DailyPrayerListProps) {
  const togglePrayerMode = (key: string) => {
    const currentMode = settings.prayerAdhanModes[key] || 'full';
    let nextMode: PrayerAdhanMode = 'full';
    if (currentMode === 'full') nextMode = 'takbir';
    else if (currentMode === 'takbir') nextMode = 'silent';
    else nextMode = 'full';

    setSettings((s) => ({
      ...s,
      prayerAdhanModes: {
        ...s.prayerAdhanModes,
        [key]: nextMode,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Hero Next Prayer Countdown Card */}
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
                {formatPrayerTime(nextPrayerTime, settings.is24Hour, timezone)}
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
        {prayerNames.map((prayer) => {
          const prayerTime: Date = todayPrayers[prayer.key];
          const isCurrent = currentPrayerKey === prayer.key;
          const isNext = nextPrayerKey === prayer.key;
          const isPassed = currentTime.getTime() > prayerTime.getTime() && !isCurrent;
          const Icon = prayer.icon;
          const mode = settings.prayerAdhanModes[prayer.key] || 'full';
          const reminderEnabled = settings.prayerReminders?.[prayer.key] ?? (prayer.key !== 'sunrise');

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
                    <Icon size={18} />
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Prayer Mode Quick Toggle (Full -> Takbir -> Silent) */}
                    <button
                      type="button"
                      onClick={() => togglePrayerMode(prayer.key)}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        mode === 'full'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : mode === 'takbir'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-900/80 text-slate-500 border-slate-800'
                      }`}
                      title={`Mode: ${mode.toUpperCase()} (Click to toggle)`}
                    >
                      {mode === 'full' ? (
                        <Volume2 size={13} />
                      ) : mode === 'takbir' ? (
                        <VolumeX size={13} />
                      ) : (
                        <BellOff size={13} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{prayer.english}</span>
                  <span className="text-sm font-serif text-emerald-400/80">{prayer.arabic}</span>
                </div>

                <div className="mt-2 text-2xl font-extrabold font-mono text-white tracking-tight">
                  {formatPrayerTime(prayerTime, settings.is24Hour, timezone)}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-950/80 flex items-center justify-between text-[11px]">
                <span
                  className={
                    isCurrent
                      ? 'text-emerald-300 font-bold'
                      : isNext
                      ? 'text-amber-400 font-semibold'
                      : 'text-emerald-400/60'
                  }
                >
                  {isCurrent ? 'Current' : isNext ? 'Upcoming' : isPassed ? 'Concluded' : 'Pending'}
                </span>

                {/* Quick Audition Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (adhanPlayback.isPlaying) {
                      stopAdhanPlayback();
                    } else {
                      void playAdhanPreview({
                        voice: settings.activeAdhanVoiceId ? { id: settings.activeAdhanVoiceId } as any : undefined,
                        variant: prayer.key === 'fajr' && settings.useFajrAdhan !== false ? 'fajr' : 'standard',
                      });
                    }
                  }}
                  className="text-emerald-400/80 hover:text-white p-1 rounded-lg"
                  title="Test Adhan for this prayer"
                >
                  {adhanPlayback.isPlaying ? <Square size={12} className="text-red-400" /> : <Play size={12} />}
                </button>
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
              {formatPrayerTime(todayPrayers.duha, settings.is24Hour, timezone)}
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
              {formatPrayerTime(todayPrayers.midnight, settings.is24Hour, timezone)}
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
              {formatPrayerTime(todayPrayers.tahajjud, settings.is24Hour, timezone)}
            </div>
            <span className="text-[10px] text-emerald-400/60">Final 1/3 Night</span>
          </div>
        </div>
      </div>
    </div>
  );
}
