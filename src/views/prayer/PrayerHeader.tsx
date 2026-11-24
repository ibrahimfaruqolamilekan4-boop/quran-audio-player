import React from 'react';
import {
  Sparkle,
  MapPin,
  LocateFixed,
  Settings2,
  Globe,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { CALCULATION_METHODS, PrayerSettings } from '../../lib/prayer';
import {
  LOCATION_PRIVACY_NOTICE,
  type CityPreset,
} from '../../lib/location';

interface PrayerHeaderProps {
  hijri: { full: string };
  currentTime: Date;
  location: {
    cityName: string;
    country: string;
    countryCode?: string;
    timezone: string;
    isGps?: boolean;
    latitude: number;
    longitude: number;
  };
  tzInfo: { offsetLabel: string; isDst: boolean };
  settings: PrayerSettings;
  setSettings: React.Dispatch<React.SetStateAction<PrayerSettings>>;
  recommendedMethod: string;
  isRequestingGps: boolean;
  requestLocation: () => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showCityPicker: boolean;
  setShowCityPicker: (show: boolean) => void;
  searchCityQuery: string;
  setSearchCityQuery: (q: string) => void;
  filteredCities: CityPreset[];
  isSearchingCities: boolean;
  selectCityPreset: (city: CityPreset) => void;
}

export function PrayerHeader({
  hijri,
  currentTime,
  location,
  tzInfo,
  settings,
  setSettings,
  recommendedMethod,
  isRequestingGps,
  requestLocation,
  showSettings,
  setShowSettings,
  showCityPicker,
  setShowCityPicker,
  searchCityQuery,
  setSearchCityQuery,
  filteredCities,
  isSearchingCities,
  selectCityPreset,
}: PrayerHeaderProps) {
  return (
    <>
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
                  timeZone: location.timezone,
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

              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                {location.timezone} ({tzInfo.offsetLabel}{tzInfo.isDst ? ' • DST' : ''})
              </span>
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
              <span>Search Any City Worldwide (Geocoding + Timezone Lookup)</span>
              {isSearchingCities && (
                <span className="text-[11px] font-normal text-emerald-400 animate-pulse ml-2">
                  Searching global coordinates...
                </span>
              )}
            </h3>
            <button
              type="button"
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
              placeholder="Type any city or town worldwide (e.g., Cairo, London, Kano, Dearborn, Jakarta, Makkah)..."
              value={searchCityQuery}
              onChange={(e) => setSearchCityQuery(e.target.value)}
              className="w-full bg-[#020B07] border border-emerald-900/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-emerald-700 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {filteredCities.map((c, idx) => (
              <button
                key={`${c.name}-${c.country}-${c.latitude}-${idx}`}
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
                <div className="text-[10px] font-mono text-emerald-500/60 truncate mt-0.5">{c.timezone}</div>
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
    </>
  );
}
