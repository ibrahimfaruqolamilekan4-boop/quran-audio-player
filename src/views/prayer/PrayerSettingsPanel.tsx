import React from 'react';
import { Settings2 } from 'lucide-react';
import { CALCULATION_METHODS, PrayerSettings } from '../../lib/prayer';

interface PrayerSettingsPanelProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  settings: PrayerSettings;
  setSettings: React.Dispatch<React.SetStateAction<PrayerSettings>>;
  recommendedMethod: string;
  country: string;
}

export function PrayerSettingsPanel({
  showSettings,
  setShowSettings,
  settings,
  setSettings,
  recommendedMethod,
  country,
}: PrayerSettingsPanelProps) {
  if (!showSettings) return null;

  const handleAdjustmentChange = (key: keyof PrayerSettings['adjustments'], delta: number) => {
    setSettings((s) => ({
      ...s,
      adjustments: {
        ...s.adjustments,
        [key]: Math.max(-30, Math.min(30, (s.adjustments[key] || 0) + delta)),
      },
    }));
  };

  return (
    <div className="bg-[#05150F] border border-emerald-500/30 rounded-3xl p-6 lg:p-7 shadow-2xl animate-in fade-in duration-200 space-y-6">
      <div className="flex items-center justify-between border-b border-emerald-900/80 pb-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2.5">
          <Settings2 size={18} className="text-emerald-400" />
          <span>Calculation Authority, Juristic &amp; Fine-Tuning Settings</span>
        </h2>
        <button
          type="button"
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
            className="text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 block mb-4 cursor-pointer"
          >
            Reset to Recommended for {country || 'Current Region'} (
            {CALCULATION_METHODS.find((m) => m.id === recommendedMethod)?.shortName})
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
            High-Latitude Rule (Polar &amp; Extreme North)
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
            Display Format &amp; Mode
          </label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, is24Hour: false }))}
              className={`py-2 rounded-xl text-xs font-medium border cursor-pointer ${
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
              className={`py-2 rounded-xl text-xs font-medium border cursor-pointer ${
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
              className="text-[11px] text-emerald-400 hover:text-white cursor-pointer"
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
                      className="w-6 h-6 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 flex items-center justify-center font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono min-w-[34px] text-center font-bold text-emerald-300">
                      {val > 0 ? `+${val}` : val}m
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdjustmentChange(key, 1)}
                      className="w-6 h-6 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 flex items-center justify-center font-bold cursor-pointer"
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
  );
}
