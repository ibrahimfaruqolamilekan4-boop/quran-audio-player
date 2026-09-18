import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Navigation,
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
  POPULAR_CITIES,
  CityLocation,
  calculateQiblaDirection,
  calculateDistanceToKaaba,
} from '../lib/prayer';

export function QiblaView() {
  const [selectedCity, setSelectedCity] = useState<CityLocation>(POPULAR_CITIES[0]); // Makkah default
  const [searchQuery, setSearchQuery] = useState('');
  const [isUsingGps, setIsUsingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: POPULAR_CITIES[0].latitude,
    lng: POPULAR_CITIES[0].longitude,
  });

  // Compass angles (in degrees 0-360)
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const [hasCompassSensor, setHasCompassSensor] = useState<boolean>(false);
  const [sensorPermissionNeeded, setSensorPermissionNeeded] = useState<boolean>(false);
  const [manualOffset, setManualOffset] = useState<number>(0);
  const [showCityPicker, setShowCityPicker] = useState<boolean>(false);

  // Calculate Qibla bearing from current coordinates (clockwise from North, 0-360)
  const qiblaAngle = Math.round(calculateQiblaDirection(coords.lat, coords.lng));
  const distanceKm = calculateDistanceToKaaba(coords.lat, coords.lng);
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

  // Request GPS position
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setGpsAccuracy(Math.round(accuracy));
        setIsUsingGps(true);
        setSelectedCity({
          name: 'My Exact Location',
          country: 'GPS Position',
          latitude,
          longitude,
        });
      },
      (err) => {
        console.warn('GPS location error:', err.message);
        setIsUsingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Try GPS on initial mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Device orientation / Compass sensor handler
  useEffect(() => {
    // Check if iOS DeviceOrientation permission is required
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

  const filteredCities = POPULAR_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCity = (city: CityLocation) => {
    setSelectedCity(city);
    setCoords({ lat: city.latitude, lng: city.longitude });
    setIsUsingGps(false);
    setGpsAccuracy(null);
    setShowCityPicker(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
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
              <span>{selectedCity.name}</span>
              <span className="text-slate-600">•</span>
              <span>{selectedCity.country}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={requestLocation}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              isUsingGps
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <LocateFixed size={14} className={isUsingGps ? 'animate-pulse text-teal-400' : ''} />
            {isUsingGps ? 'GPS Active' : 'Use GPS'}
          </button>
          <button
            onClick={() => setShowCityPicker(!showCityPicker)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-all"
          >
            <Search size={14} />
            Change City
          </button>
        </div>
      </div>

      {/* City Selector Dropdown / Modal */}
      {showCityPicker && (
        <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 shadow-2xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Select Location</h3>
            <button
              onClick={() => setShowCityPicker(false)}
              className="text-xs text-slate-400 hover:text-white"
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
                onClick={() => handleSelectCity(c)}
                className={`text-left p-2.5 rounded-xl text-xs transition-all border ${
                  selectedCity.name === c.name
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    : 'bg-[#131722]/60 hover:bg-slate-800 text-slate-300 border-slate-800/60'
                }`}
              >
                <div className="font-semibold text-white truncate">{c.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{c.country}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Compass Stage */}
      <div className="relative bg-[#0A0F1C]/90 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-center overflow-hidden shadow-2xl">
        {/* Subtle radial glow when facing Qibla */}
        <div
          className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
            isFacingQibla
              ? 'opacity-100 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-500/20 via-transparent to-transparent'
              : 'opacity-0'
          }`}
        />

        {/* Alignment Indicator Badge */}
        <div className="mb-6 z-10">
          {isFacingQibla ? (
            <div className="px-5 py-2 rounded-full bg-teal-500/20 border border-teal-500/50 text-teal-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_25px_rgba(45,212,191,0.4)] animate-pulse">
              <CheckCircle2 size={16} className="text-teal-400" />
              Facing Holy Kaaba in Makkah!
            </div>
          ) : (
            <div className="px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-400 text-xs font-medium flex items-center gap-2">
              <Navigation size={13} className="text-amber-400" />
              Align arrow with Kaaba symbol
            </div>
          )}
        </div>

        {/* Circular Compass Dial */}
        <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center">
          {/* Outer ring with degree marks */}
          <div
            className="absolute inset-0 rounded-full border-2 border-slate-800/90 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-center transition-transform duration-300"
            style={{ transform: `rotate(${-currentHeading}deg)` }}
          >
            {/* Cardinal points */}
            <span className="absolute top-2 text-xs font-bold text-red-400">N</span>
            <span className="absolute right-3 text-xs font-bold text-slate-400">E</span>
            <span className="absolute bottom-2 text-xs font-bold text-slate-400">S</span>
            <span className="absolute left-3 text-xs font-bold text-slate-400">W</span>

            {/* Minor degree tick marks */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <div
                key={deg}
                className="absolute w-full h-full flex justify-center items-start pt-1 pointer-events-none"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div
                  className={`w-0.5 ${
                    deg % 90 === 0 ? 'h-3 bg-slate-500' : 'h-1.5 bg-slate-700'
                  }`}
                />
              </div>
            ))}

            {/* Kaaba Marker on the outer dial at the exact Qibla angle */}
            <div
              className="absolute w-full h-full flex justify-center items-start pointer-events-none"
              style={{ transform: `rotate(${qiblaAngle}deg)` }}
            >
              <div className="flex flex-col items-center -mt-3.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300 flex items-center justify-center text-[#020617] text-[10px] font-black shadow-[0_0_15px_rgba(245,158,11,0.6)]">
                  🕋
                </div>
                <div className="w-0.5 h-3 bg-amber-400 mt-1" />
              </div>
            </div>
          </div>

          {/* Central Animated Compass Needle */}
          <div
            className="absolute w-full h-full flex items-center justify-center pointer-events-none transition-transform duration-500 ease-out"
            style={{ transform: `rotate(${relativeNeedleAngle}deg)` }}
          >
            {/* Pointing Needle (Top is pointing to Qibla) */}
            <div className="relative w-8 h-64 sm:h-80 flex flex-col items-center justify-between">
              {/* North / Qibla arrow tip */}
              <div className="flex flex-col items-center">
                <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[28px] border-b-teal-400 drop-shadow-[0_0_12px_rgba(45,212,191,0.8)]" />
                <div className="w-2.5 h-20 sm:h-28 bg-gradient-to-b from-teal-400 to-teal-700 rounded-t-sm" />
              </div>

              {/* South arrow tail */}
              <div className="flex flex-col items-center">
                <div className="w-2 h-16 sm:h-24 bg-gradient-to-t from-slate-700 to-slate-800" />
                <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[20px] border-t-slate-700" />
              </div>
            </div>
          </div>

          {/* Center Hub */}
          <div className="z-20 w-16 h-16 rounded-full bg-[#030712] border-2 border-teal-500/60 shadow-[0_0_20px_rgba(45,212,191,0.4)] flex flex-col items-center justify-center">
            <span className="text-[11px] font-black text-white">{qiblaAngle}°</span>
            <span className="text-[9px] text-teal-400 font-semibold uppercase">Qibla</span>
          </div>
        </div>

        {/* Sensor / Manual Rotation Controls for Desktop */}
        <div className="mt-8 w-full max-w-md bg-[#131722]/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Sliders size={14} className="text-teal-400" />
              <span>Orientation Adjustment</span>
            </span>
            <span className="text-white font-mono">{currentHeading}°</span>
          </div>

          <input
            type="range"
            min="0"
            max="359"
            value={currentHeading}
            onChange={(e) => setManualOffset(Number(e.target.value) - deviceHeading)}
            className="w-full accent-teal-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-semibold px-1">
            <button onClick={() => setManualOffset(0 - deviceHeading)} className="hover:text-teal-400">0° (N)</button>
            <button onClick={() => setManualOffset(90 - deviceHeading)} className="hover:text-teal-400">90° (E)</button>
            <button onClick={() => setManualOffset(180 - deviceHeading)} className="hover:text-teal-400">180° (S)</button>
            <button onClick={() => setManualOffset(270 - deviceHeading)} className="hover:text-teal-400">270° (W)</button>
            <button
              onClick={() => setManualOffset(qiblaAngle - deviceHeading)}
              className="text-amber-400 hover:text-amber-300 font-bold"
            >
              Align ({qiblaAngle}°)
            </button>
          </div>

          {sensorPermissionNeeded && (
            <button
              onClick={requestOrientationPermission}
              className="mt-2 w-full py-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-semibold flex items-center justify-center gap-2"
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
            Calculated precisely from {selectedCity.name} towards the Kaaba (21.42° N, 39.83° E).
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
            {gpsAccuracy !== null ? (
              <span className="text-lg font-bold text-teal-400">
                ±{gpsAccuracy} meters
              </span>
            ) : isUsingGps ? (
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
