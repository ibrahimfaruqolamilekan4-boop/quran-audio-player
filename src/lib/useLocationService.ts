import { useState, useEffect, useCallback } from 'react';
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
} from './location';

export function useLocationService() {
  const [location, setLocation] = useState<UserLocation>(getSavedLocation);
  const [isRequestingGps, setIsRequestingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showPrePrompt, setShowPrePrompt] = useState(false);

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
  const executeGeolocationRequest = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsRequestingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timezone = getSystemTimezone();

        // Perform reverse geocoding to resolve real city and country names
        const geoInfo = await reverseGeocodeCoords(latitude, longitude);

        const newLocation: UserLocation = {
          latitude,
          longitude,
          cityName: geoInfo.cityName,
          country: geoInfo.country,
          countryCode: geoInfo.countryCode,
          timezone,
          isGps: true,
          accuracy: Math.round(accuracy),
          updatedAt: Date.now(),
        };

        saveLocation(newLocation);
        setLocation(newLocation);
        setIsRequestingGps(false);
        setShowPrePrompt(false);
      },
      (err) => {
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
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      }
    );
  }, []);

  /**
   * Trigger this when user clicks "Use My GPS" or "Auto Detect Location".
   * If browser permissions API reports 'granted', fetches directly.
   * If 'prompt' or unknown, shows the polite educational pre-permission modal first.
   */
  const requestLocation = useCallback(async (bypassPrePrompt = false) => {
    if (bypassPrePrompt) {
      executeGeolocationRequest();
      return;
    }

    // Check if permission was already granted previously
    if ('permissions' in navigator && navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (status.state === 'granted') {
          executeGeolocationRequest();
          return;
        }
      } catch {
        // Ignored
      }
    }

    // Show educational modal first before triggering browser prompt
    setShowPrePrompt(true);
  }, [executeGeolocationRequest]);

  /**
   * User confirms in the educational pre-prompt modal
   */
  const confirmPrePrompt = useCallback(() => {
    setShowPrePrompt(false);
    executeGeolocationRequest();
  }, [executeGeolocationRequest]);

  /**
   * User dismisses educational pre-prompt modal
   */
  const dismissPrePrompt = useCallback(() => {
    setShowPrePrompt(false);
  }, []);

  /**
   * Select a city manually from the global catalog
   */
  const selectCityPreset = useCallback((preset: CityPreset) => {
    const newLocation: UserLocation = {
      latitude: preset.latitude,
      longitude: preset.longitude,
      cityName: preset.name,
      country: preset.country,
      countryCode: preset.countryCode,
      timezone: preset.timezone,
      isGps: false,
      updatedAt: Date.now(),
    };
    saveLocation(newLocation);
    setLocation(newLocation);
    setGpsError(null);
  }, []);

  /**
   * Search through available preset cities
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

  return {
    location,
    isRequestingGps,
    gpsError,
    showPrePrompt,
    requestLocation,
    confirmPrePrompt,
    dismissPrePrompt,
    selectCityPreset,
    searchCities,
    defaultLocation: DEFAULT_LOCATION,
  };
}
