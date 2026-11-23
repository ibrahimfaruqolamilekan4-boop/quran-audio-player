import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserLocation,
  DEFAULT_LOCATION,
  POPULAR_GLOBAL_CITIES,
  CityPreset,
  getSavedLocation,
  saveLocation,
  reverseGeocodeCoords,
  hasSignificantLocationChange,
  getSystemTimezone,
  searchGlobalCitiesGeocode,
} from './location';

export function useLocationService() {
  const [location, setLocation] = useState<UserLocation>(getSavedLocation);
  const [isRequestingGps, setIsRequestingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showPrePrompt, setShowPrePrompt] = useState(false);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const locationRef = useRef<UserLocation>(location);
  locationRef.current = location;

  // Synchronize across multiple components/tabs
  useEffect(() => {
    const handleLocationChanged = (e: Event) => {
      const customEvent = e as CustomEvent<UserLocation>;
      if (customEvent.detail) {
        setLocation(customEvent.detail);
      }
    };

    window.addEventListener('nooraya-location-changed', handleLocationChanged);
    return () => {
      window.removeEventListener('nooraya-location-changed', handleLocationChanged);
    };
  }, []);

  /**
   * Internal function that calls native navigator.geolocation
   */
  const executeGeolocationRequest = useCallback(async (silentMovementCheck = false) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (!silentMovementCheck) {
        setGpsError('Geolocation is not supported by your browser.');
      }
      return;
    }

    if (!silentMovementCheck) {
      setIsRequestingGps(true);
      setGpsError(null);
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const sysTimezone = getSystemTimezone();
        const prev = locationRef.current;

        // If this is a background movement/timezone check, only recompute if user moved >= 10 km
        // or the system timezone changed
        if (
          silentMovementCheck &&
          prev.isGps &&
          !hasSignificantLocationChange(prev, latitude, longitude, 10) &&
          prev.timezone === sysTimezone
        ) {
          return;
        }

        // Perform reverse geocoding to resolve real city and country names
        const geoInfo = await reverseGeocodeCoords(latitude, longitude);

        const newLocation: UserLocation = {
          latitude,
          longitude,
          cityName: geoInfo.cityName,
          country: geoInfo.country,
          countryCode: geoInfo.countryCode,
          timezone: sysTimezone,
          isGps: true,
          accuracy: Math.round(accuracy),
          updatedAt: Date.now(),
        };

        saveLocation(newLocation);
        setLocation(newLocation);
        if (!silentMovementCheck) {
          setIsRequestingGps(false);
          setShowPrePrompt(false);
        }
      },
      (err) => {
        if (silentMovementCheck) return;
        let msg = 'Could not retrieve your location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission was denied. You can select your city manually.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out.';
        }
        setGpsError(msg);
        setIsRequestingGps(false);
        setShowPrePrompt(false);
      },
      {
        enableHighAccuracy: !silentMovementCheck,
        timeout: 12000,
        maximumAge: silentMovementCheck ? 300000 : 60000,
      }
    );
  }, []);

  /**
   * Automatic >10 km movement and timezone change detector when GPS mode is active
   */
  useEffect(() => {
    const checkMovementOrTimezone = async () => {
      const current = locationRef.current;
      if (!current.isGps) return;

      // Immediately update if device system timezone changed while in GPS mode
      const currentSysTz = getSystemTimezone();
      if (currentSysTz && currentSysTz !== current.timezone) {
        const updated: UserLocation = {
          ...current,
          timezone: currentSysTz,
          updatedAt: Date.now(),
        };
        saveLocation(updated);
        setLocation(updated);
      }

      if ('permissions' in navigator && navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (status.state === 'granted') {
            executeGeolocationRequest(true);
          }
        } catch {
          // Ignore permissions query errors
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkMovementOrTimezone();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(() => {
      void checkMovementOrTimezone();
    }, 10 * 60 * 1000); // Re-check every 10 minutes while open

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [executeGeolocationRequest]);

  /**
   * Trigger this when user clicks "Use My GPS" or "Auto Detect Location".
   * If browser permissions API reports 'granted', fetches directly.
   * If 'prompt' or unknown, shows the polite educational pre-permission modal first.
   */
  const requestLocation = useCallback(
    async (bypassPrePrompt = false) => {
      if (bypassPrePrompt) {
        executeGeolocationRequest(false);
        return;
      }

      // Check if permission was already granted previously
      if ('permissions' in navigator && navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (status.state === 'granted') {
            executeGeolocationRequest(false);
            return;
          }
        } catch {
          // Ignored
        }
      }

      // Show educational modal first before triggering browser prompt
      setShowPrePrompt(true);
    },
    [executeGeolocationRequest]
  );

  /**
   * User confirms in the educational pre-prompt modal
   */
  const confirmPrePrompt = useCallback(() => {
    setShowPrePrompt(false);
    executeGeolocationRequest(false);
  }, [executeGeolocationRequest]);

  /**
   * User dismisses educational pre-prompt modal
   */
  const dismissPrePrompt = useCallback(() => {
    setShowPrePrompt(false);
  }, []);

  /**
   * Select a city manually from the global catalog or geocoding search
   */
  const selectCityPreset = useCallback((preset: CityPreset) => {
    const newLocation: UserLocation = {
      latitude: preset.latitude,
      longitude: preset.longitude,
      cityName: preset.name,
      country: preset.country,
      countryCode: preset.countryCode,
      timezone: preset.timezone || getSystemTimezone(),
      isGps: false,
      updatedAt: Date.now(),
    };
    saveLocation(newLocation);
    setLocation(newLocation);
    setGpsError(null);
  }, []);

  /**
   * Synchronous search through offline preset cities
   */
  const searchCities = useCallback((query: string): CityPreset[] => {
    const q = query.trim().toLowerCase();
    if (!q) return POPULAR_GLOBAL_CITIES;
    return POPULAR_GLOBAL_CITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q)
    );
  }, []);

  /**
   * Asynchronous global city search with geocoding + timezone lookup & offline fallback
   */
  const searchCitiesGlobal = useCallback(async (query: string): Promise<CityPreset[]> => {
    setIsSearchingCities(true);
    try {
      return await searchGlobalCitiesGeocode(query);
    } finally {
      setIsSearchingCities(false);
    }
  }, []);

  return {
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
    defaultLocation: DEFAULT_LOCATION,
  };
}
