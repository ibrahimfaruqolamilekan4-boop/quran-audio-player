import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  Search,
  RotateCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  LocateFixed,
  Sliders,
} from 'lucide-react';
import {
  calculateQiblaDirection,
  calculateDistanceToKaaba,
} from '../lib/prayer';
import { useLocationService } from '../lib/useLocationService';
import { LocationPermissionModal } from '../components/LocationPermissionModal';

export function QiblaView() {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [showCityPicker, setShowCityPicker] = useState<boolean>(false);

  // Compass angles (in degrees 0-360)
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const [hasCompassSensor, setHasCompassSensor] = useState<boolean>(false);
  const [sensorPermissionNeeded, setSensorPermissionNeeded] = useState<boolean>(false);
  const [manualOffset, setManualOffset] = useState<number>(0);

  // Calculate Qibla bearing from current coordinates (clockwise from North, 0-360)
  const qiblaAngle = Math.round(calculateQiblaDirection(location.latitude, location.longitude));
  const distanceKm = calculateDistanceToKaaba(location.latitude, location.longitude);
  const distanceMiles = Math.round(distanceKm * 0.621371);

  // Effective compass heading combines sensor heading or manual offset
  const currentHeading = (deviceHeading + manualOffset) % 360;

  // Relative needle angle: where the needle should point relative to the top of the phone/dial
  // When heading == qiblaAngle, relativeNeedleAngle == 0 (points straight up!)
  const relativeNeedleAngle = (qiblaAngle - currentHeading + 360) % 360;

  // Is user facing Qibla within ±4 degrees
  const isFacingQibla = Math.abs(relativeNeedleAngle) <= 4 || Math.abs(relativeNeedleAngle - 360) <= 4;

  // Trigger light haptic feedback when facing Qibla
  useEffect(() => {
    if (isFacingQibla && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(50);
      } catch {
        // Ignored if browser restricts vibration
      }
    }
  }, [isFacingQibla]);

  // Device orientation / Compass sensor handler
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any)?.requestPermission === 'function'
    ) {
      setSensorPermissionNeeded(true);
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // iOS Safari provides webkitCompassHeading directly
      if ('webkitCompassHeading' in e && typeof (e as any).webkitCompassHeading === 'number') {
        heading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Android Chrome absolute orientation
        heading = 360 - e.alpha;
      }

      if (heading !== null && !isNaN(heading)) {
        setDeviceHeading(Math.round(heading));
        setHasCompassSensor(true);
      }
    };

    window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const requestOrientationPermission = async () => {
    if (
      typeof (DeviceOrientationEvent as any)?.requestPermission === 'function'
    ) {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          setSensorPermissionNeeded(false);
          setHasCompassSensor(true);
        }
      } catch (err) {
        console.error('Error requesting orientation permission:', err);
      }
    }
  };

  const filteredCities = searchCities(searchQuery);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Educational Location Pre-Prompt Modal */}
      <LocationPermissionModal
        isOpen={showPrePrompt}
        onConfirm={confirmPrePrompt}
        onDismiss={dismissPrePrompt}
        onSelectManual={() => setShowCityPicker(true)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.15)]">
            <Compass size={26} className="text-teal-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Qibla Compass
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-normal">
                اتجاه القبلة
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5">
              <MapPin size={14} className="text-teal-400" />
              <span>{location.cityName}</span>
              <span className="text-slate-600">•</span>
              <span>{location.country}</span>
              {location.isGps && (
                <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded font-semibold ml-1">
                  GPS Active
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => requestLocation()}
            disabled={isRequestingGps}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              location.isGps
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <LocateFixed size={14} className={isRequestingGps ? 'animate-spin text-teal-400' : ''} />
            {isRequestingGps ? 'Detecting...' : location.isGps ? 'GPS Location' : 'Use GPS'}
          </button>
          <button
            onClick={() => setShowCityPicker(!showCityPicker)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Search size={14} />
            Change City
          </button>
        </div>
      </div>

      {gpsError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-amber-400" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* City Selector Dropdown / Modal */}
      {showCityPicker && (
        <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 shadow-2xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Select Location</h3>
            <button
              onClick={() => setShowCityPicker(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search world cities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131722] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredCities.map((c) => (
              <button
                key={c.name + c.country}
                onClick={() => {
                  selectCityPreset(c);
                  setShowCityPicker(false);
                }}
                className={`text-left p-2.5 rounded-xl text-xs transition-all border cursor-pointer ${
                  location.cityName === c.name
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    : 'bg-[#131722]/60 hover:bg-slate-800 text-slate-300 border-slate-800/60'
                }`}
              >
                <div className="font-semibold">{c.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{c.country}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Interactive Compass Display */}
      <div className="relative bg-gradient-to-b from-[#0A0F1C] to-[#040810] border border-slate-800/80 rounded-3xl p-8 sm:p-12 shadow-2xl flex flex-col items-center justify-center overflow-hidden min-h-[460px]">
        {/* Subtle radial glow when facing Qibla */}
        <div
          className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
            isFacingQibla
              ? 'bg-radial-gradient from-teal-500/20 via-teal-950/10 to-transparent opacity-100'
              : 'opacity-0'
          }`}
        />

        {/* Status Indicator Pill */}
        <div className="mb-6 z-10">
          {isFacingQibla ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/20 border border-teal-500/50 text-teal-300 text-xs font-semibold shadow-[0_0_20px_rgba(45,212,191,0.3)] animate-pulse">
              <CheckCircle2 size={14} className="text-teal-400" />
              <span>You are facing the Kaaba!</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-400 text-xs font-medium">
              <RotateCw size={13} className="animate-spin text-slate-500" style={{ animationDuration: '8s' }} />
              <span>Rotate device to align with the needle</span>
            </div>
          )}
        </div>

        {/* The Outer Compass Dial & Rotating Mechanism */}
        <div className="relative w-72 h-72 sm:w-84 sm:h-84 flex items-center justify-center select-none">
          {/* Static outer ring with degree ticks */}
          <div className="absolute inset-0 rounded-full border-2 border-slate-800/80 shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]" />
          <div className="absolute inset-2 rounded-full border border-teal-500/20" />
          <div className="absolute inset-5 rounded-full border border-slate-800/40" />

          {/* Cardinal Directions (Fixed on Phone Outer Bezel) */}
          <div className="absolute top-2 text-[11px] font-black tracking-widest text-slate-400">N</div>
          <div className="absolute bottom-2 text-[11px] font-black tracking-widest text-slate-600">S</div>
          <div className="absolute right-2 text-[11px] font-black tracking-widest text-slate-600">E</div>
          <div className="absolute left-2 text-[11px] font-black tracking-widest text-slate-600">W</div>

          {/* Kaaba Marker on the outer dial at the exact Qibla angle */}
          <div
            className="absolute inset-0 flex items-start justify-center pointer-events-none transition-transform duration-300 ease-out"
            style={{ transform: `rotate(${qiblaAngle}deg)` }}
          >
            <div className="flex flex-col items-center -mt-3.5">
              <div className="w-6 h-6 rounded-md bg-[#0F172A] border border-amber-400/80 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                {/* Kaaba Silhouette / Cube */}
                <div className="w-3.5 h-3.5 bg-amber-400 rounded-xs flex items-center justify-center">
                  <div className="w-full h-0.5 bg-black/40" />
                </div>
              </div>
              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-tighter mt-0.5">
                Kaaba
              </span>
            </div>
          </div>

          {/* Pointing Needle (Top is pointing to Qibla) */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-300 ease-out"
            style={{ transform: `rotate(${relativeNeedleAngle}deg)` }}
          >
            {/* The Compass Needle */}
            <div className="relative w-8 h-64 flex flex-col items-center justify-between">
              {/* North / Qibla arrow tip */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[40px] drop-shadow-[0_0_10px_rgba(45,212,191,0.5)] ${
                    isFacingQibla ? 'border-b-teal-400' : 'border-b-teal-500'
                  }`}
                />
                <div className="w-1.5 h-16 bg-gradient-to-b from-teal-500 to-teal-800 -mt-1" />
              </div>

              {/* South / Opposite arrow tip */}
              <div className="flex flex-col items-center">
                <div className="w-1.5 h-16 bg-gradient-to-t from-slate-600 to-slate-800 -mb-1" />
                <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[40px] border-t-slate-700" />
              </div>
            </div>
          </div>

          {/* Center Hub Pivot */}
          <div className="relative z-20 w-16 h-16 rounded-full bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-teal-500/40 flex flex-col items-center justify-center shadow-2xl">
            <span className="text-[11px] font-black text-white">{qiblaAngle}°</span>
            <span className="text-[9px] text-teal-400 font-semibold uppercase">Qibla</span>
          </div>
        </div>

        {/* Calibration / Manual Tuning Fallback */}
        <div className="mt-8 text-center max-w-sm">
          {!hasCompassSensor && (
            <div className="bg-[#131722]/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 mb-4">
              <div className="flex items-center gap-2 font-medium text-amber-400 mb-1">
                <AlertTriangle size={15} /> Compass sensor not active
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Your browser does not report device compass heading. Use the manual alignment slider below or rotate device.
              </p>
              <div className="flex items-center gap-3">
                <Sliders size={14} className="text-slate-400 shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={manualOffset}
                  onChange={(e) => setManualOffset(Number(e.target.value))}
                  className="w-full accent-teal-500 h-1 bg-slate-700 rounded-lg"
                />
                <span className="font-mono text-xs text-white min-w-[32px]">{manualOffset}°</span>
              </div>
              <button
                onClick={() => setManualOffset(qiblaAngle - deviceHeading)}
                className="mt-2 text-[11px] text-teal-400 hover:underline"
              >
                Align ({qiblaAngle}°)
              </button>
            </div>
          )}

          {sensorPermissionNeeded && (
            <button
              onClick={requestOrientationPermission}
              className="mt-2 w-full py-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCw size={14} />
              Enable Mobile Compass Sensor
            </button>
          )}
        </div>
      </div>

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Qibla Direction Angle */}
        <div className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Qibla Angle
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">{qiblaAngle}°</span>
            <span className="text-xs text-teal-400 font-medium">from True North</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Calculated precisely from {location.cityName} towards the Kaaba (21.42° N, 39.83° E).
          </p>
        </div>

        {/* Distance to Makkah */}
        <div className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Distance to Kaaba
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400 tracking-tight">
              {distanceKm.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">km ({distanceMiles.toLocaleString()} mi)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Great-circle distance across the Earth's surface to the holy sanctuary.
          </p>
        </div>

        {/* Accuracy & Sensor Status */}
        <div className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Accuracy Level
          </div>
          <div className="flex items-center gap-2">
            {location.accuracy ? (
              <span className="text-lg font-bold text-teal-400">
                ±{location.accuracy} meters
              </span>
            ) : location.isGps ? (
              <span className="text-lg font-bold text-teal-400">High (GPS)</span>
            ) : (
              <span className="text-lg font-bold text-slate-300">City Coordinates</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <Info size={12} className="text-teal-400 shrink-0" />
            <span>
              {hasCompassSensor
                ? 'Device magnetometer sensor active.'
                : 'Rotate phone or use manual slider above.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
