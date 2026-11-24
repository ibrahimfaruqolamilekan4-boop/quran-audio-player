import React, { useState } from 'react';
import {
  Volume2,
  Square,
  Play,
  Sunrise,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { PrayerSettings } from '../../lib/prayer';
import {
  type AdhanVoiceRow,
  playAdhanPreview,
  stopAdhanPlayback,
} from '../../lib/adhanAudio';

interface AdhanVoiceSelectorProps {
  adhanVoices: AdhanVoiceRow[];
  settings: PrayerSettings;
  setSettings: React.Dispatch<React.SetStateAction<PrayerSettings>>;
  adhanPlayback: { isPlaying: boolean; currentVoiceId: string | null };
  isPremiumUser: boolean;
  prayerNames: Array<{ key: string; english: string; arabic: string }>;
}

export function AdhanVoiceSelector({
  adhanVoices,
  settings,
  setSettings,
  adhanPlayback,
  isPremiumUser,
  prayerNames,
}: AdhanVoiceSelectorProps) {
  const [showPerPrayerControls, setShowPerPrayerControls] = useState(false);

  const selectedMuezzin = adhanVoices.find((v) => v.id === settings.activeAdhanVoiceId) || adhanVoices[0];

  return (
    <div className="bg-[#05150F] border border-emerald-500/20 rounded-3xl p-6 lg:p-7 shadow-xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left: Global Muezzin Picker */}
        <div>
          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
            <Volume2 size={14} className="text-emerald-400" />
            <span>Select Global Adhan Reciter / Muezzin</span>
          </label>
          <select
            value={settings.activeAdhanVoiceId || ''}
            onChange={(e) => setSettings((s) => ({ ...s, activeAdhanVoiceId: e.target.value }))}
            className="w-full bg-[#020B07] border border-emerald-800/80 rounded-2xl px-3.5 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-400 mb-2"
          >
            {adhanVoices.map((v) => {
              const locked = Boolean(v.is_premium) && !isPremiumUser;
              return (
                <option key={v.id} value={v.id} disabled={locked}>
                  {v.muezzin_name_en} ({v.muezzin_name_ar}) • {v.sanctuary_name_en} {locked ? '— [Premium]' : ''}
                </option>
              );
            })}
          </select>
          <div className="text-[11px] text-emerald-400/70">
            Plays fully on Android, iOS Safari, PWA, and desktop computers when the prayer enters.
          </div>
        </div>

        {/* Right: Quick Adhan Voice Audition & Fajr switch */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">
            Adhan Audio Preview &amp; Variant
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                if (adhanPlayback.isPlaying) {
                  stopAdhanPlayback();
                } else {
                  void playAdhanPreview({ voice: selectedMuezzin || undefined, variant: 'standard' });
                }
              }}
              className="px-3 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              {adhanPlayback.isPlaying ? (
                <>
                  <Square size={13} className="text-red-400 fill-red-400" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play size={13} className="text-emerald-400 fill-emerald-400" />
                  <span>Test Adhan</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void playAdhanPreview({ voice: selectedMuezzin || undefined, variant: 'fajr' })}
              className="px-3 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Sunrise size={13} />
              <span>Test Fajr</span>
            </button>

            <button
              type="button"
              onClick={() => void playAdhanPreview({ voice: selectedMuezzin || undefined, variant: 'takbir' })}
              className="px-3 py-2.5 rounded-2xl bg-[#020B07] hover:bg-emerald-950/70 border border-emerald-900/80 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play size={12} className="text-teal-400" />
              <span>Short Takbir</span>
            </button>
          </div>

          {/* Separate Fajr Adhan Toggle */}
          <label className="flex items-center justify-between bg-[#020B07]/90 border border-emerald-900/70 rounded-2xl p-3.5 cursor-pointer">
            <div className="pr-3">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sunrise size={13} className="text-amber-400" />
                <span>Use Fajr Adhan at Dawn</span>
              </div>
              <div className="text-[11px] text-emerald-300/60 mt-0.5">
                Includes &ldquo;As-salatu khayrun min an-nawm&rdquo; (الصلاة خير من النوم)
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.useFajrAdhan !== false}
              onChange={(e) => setSettings((s) => ({ ...s, useFajrAdhan: e.target.checked }))}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0"
            />
          </label>
        </div>
      </div>

      {/* Per-Prayer Fine Controls */}
      <div className="pt-4 border-t border-emerald-900/70">
        <button
          type="button"
          onClick={() => setShowPerPrayerControls(!showPerPrayerControls)}
          data-testid="toggle-per-prayer-controls-btn"
          className="w-full flex items-center justify-between text-xs font-bold text-emerald-300 hover:text-white cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sliders size={14} className="text-amber-400" />
            <span>Per-Prayer Customization (Voice, Reminder Before, Volume &amp; Vibrate)</span>
          </span>
          <ChevronDown
            size={15}
            className={`transition-transform ${showPerPrayerControls ? 'rotate-180' : ''}`}
          />
        </button>

        {showPerPrayerControls && (
          <div
            data-testid="per-prayer-controls-grid"
            className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {prayerNames.map((prayer) => {
              const enabled = settings.prayerReminders?.[prayer.key] ?? (prayer.key !== 'sunrise');
              const voiceOverride = settings.prayerVoices?.[prayer.key] || '';
              const offsetVal =
                settings.prayerReminderOffsets?.[prayer.key] ?? (settings.reminderMinutesBefore || 0);
              const volVal = Math.round((settings.prayerVolumes?.[prayer.key] ?? 1) * 100);
              const vibrateVal = settings.prayerVibrate?.[prayer.key] ?? (prayer.key !== 'sunrise');

              return (
                <div
                  key={prayer.key}
                  className="bg-[#020B07]/90 border border-emerald-900/70 rounded-2xl p-3.5 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      {prayer.english}{' '}
                      <span className="text-emerald-400/75 font-serif font-normal">{prayer.arabic}</span>
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-emerald-200 cursor-pointer">
                      <input
                        type="checkbox"
                        aria-label={`Enable ${prayer.english} alert`}
                        checked={enabled}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            prayerReminders: {
                              ...s.prayerReminders,
                              [prayer.key]: e.target.checked,
                            },
                          }))
                        }
                        className="accent-emerald-500 rounded cursor-pointer"
                      />
                      <span>{enabled ? 'On' : 'Off'}</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-emerald-400/70 block mb-1">
                      Voice Override
                    </label>
                    <select
                      aria-label={`${prayer.english} Voice`}
                      value={voiceOverride}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          prayerVoices: {
                            ...(s.prayerVoices || {}),
                            [prayer.key]: e.target.value,
                          },
                        }))
                      }
                      className="w-full bg-[#04140D] border border-emerald-900 rounded-xl px-2.5 py-1.5 text-[11px] text-white"
                    >
                      <option value="">Default ({selectedMuezzin?.muezzin_name_en || 'Global'})</option>
                      {adhanVoices.map((v) => {
                        const locked = Boolean(v.is_premium) && !isPremiumUser;
                        return (
                          <option key={v.id} value={v.id} disabled={locked}>
                            {v.muezzin_name_en} {locked ? '(Premium)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-emerald-400/70 block mb-1">
                        Remind Before
                      </label>
                      <select
                        aria-label={`${prayer.english} Reminder Offset`}
                        value={offsetVal}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            prayerReminderOffsets: {
                              ...(s.prayerReminderOffsets || {}),
                              [prayer.key]: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full bg-[#04140D] border border-emerald-900 rounded-xl px-2 py-1.5 text-[11px] text-white"
                      >
                        <option value={0}>At time (0m)</option>
                        <option value={5}>5 min before</option>
                        <option value={10}>10 min before</option>
                        <option value={15}>15 min before</option>
                        <option value={30}>30 min before</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-emerald-400/70 block mb-1">
                        Volume ({volVal}%)
                      </label>
                      <input
                        type="range"
                        aria-label={`${prayer.english} Volume`}
                        min={10}
                        max={100}
                        step={5}
                        value={volVal}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            prayerVolumes: {
                              ...(s.prayerVolumes || {}),
                              [prayer.key]: Number(e.target.value) / 100,
                            },
                          }))
                        }
                        className="w-full accent-emerald-500 mt-1.5"
                      />
                    </div>
                  </div>

                  <label className="flex items-center justify-between text-[11px] text-emerald-200/80 pt-1 cursor-pointer">
                    <span>Vibrate on alert</span>
                    <input
                      type="checkbox"
                      aria-label={`${prayer.english} Vibrate`}
                      checked={vibrateVal}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          prayerVibrate: {
                            ...(s.prayerVibrate || {}),
                            [prayer.key]: e.target.checked,
                          },
                        }))
                      }
                      className="accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
