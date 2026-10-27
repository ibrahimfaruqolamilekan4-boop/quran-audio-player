/**
 * Unified Location Service for Nooraya
 * 
 * Shared between Prayer Times, Qibla Compass, and future features.
 * Privacy-first: Coordinates stay on the device in localStorage by default.
 * Server transmission is only performed if user opts in to push notifications.
 */

export interface UserLocation {
  latitude: number;
  longitude: number;
  cityName: string;
  country: string;
  countryCode?: string;
  timezone: string;
  isGps: boolean;
  accuracy?: number;
  updatedAt: number;
}

export interface CityPreset {
  name: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  defaultMethod: string;
}

export const POPULAR_GLOBAL_CITIES: CityPreset[] = [
  // Middle East & Gulf
  { name: 'Makkah', country: 'Saudi Arabia', countryCode: 'SA', latitude: 21.422487, longitude: 39.826206, timezone: 'Asia/Riyadh', defaultMethod: 'UmmAlQura' },
  { name: 'Madinah', country: 'Saudi Arabia', countryCode: 'SA', latitude: 24.4672, longitude: 39.6111, timezone: 'Asia/Riyadh', defaultMethod: 'UmmAlQura' },
  { name: 'Riyadh', country: 'Saudi Arabia', countryCode: 'SA', latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh', defaultMethod: 'UmmAlQura' },
  { name: 'Jeddah', country: 'Saudi Arabia', countryCode: 'SA', latitude: 21.4858, longitude: 39.1925, timezone: 'Asia/Riyadh', defaultMethod: 'UmmAlQura' },
  { name: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai', defaultMethod: 'Dubai' },
  { name: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE', latitude: 24.4539, longitude: 54.3773, timezone: 'Asia/Dubai', defaultMethod: 'Dubai' },
  { name: 'Doha', country: 'Qatar', countryCode: 'QA', latitude: 25.2854, longitude: 51.5310, timezone: 'Asia/Qatar', defaultMethod: 'Qatar' },
  { name: 'Kuwait City', country: 'Kuwait', countryCode: 'KW', latitude: 29.3759, longitude: 47.9774, timezone: 'Asia/Kuwait', defaultMethod: 'Kuwait' },
  { name: 'Manama', country: 'Bahrain', countryCode: 'BH', latitude: 26.2285, longitude: 50.5860, timezone: 'Asia/Bahrain', defaultMethod: 'UmmAlQura' },
  { name: 'Muscat', country: 'Oman', countryCode: 'OM', latitude: 23.5880, longitude: 58.3829, timezone: 'Asia/Muscat', defaultMethod: 'UmmAlQura' },
  { name: 'Amman', country: 'Jordan', countryCode: 'JO', latitude: 31.9454, longitude: 35.9284, timezone: 'Asia/Amman', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Beirut', country: 'Lebanon', countryCode: 'LB', latitude: 33.8938, longitude: 35.5018, timezone: 'Asia/Beirut', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Jerusalem (Al-Quds)', country: 'Palestine', countryCode: 'PS', latitude: 31.7683, longitude: 35.2137, timezone: 'Asia/Jerusalem', defaultMethod: 'MuslimWorldLeague' },

  // Africa
  { name: 'Cairo', country: 'Egypt', countryCode: 'EG', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', defaultMethod: 'Egyptian' },
  { name: 'Alexandria', country: 'Egypt', countryCode: 'EG', latitude: 31.2001, longitude: 29.9187, timezone: 'Africa/Cairo', defaultMethod: 'Egyptian' },
  { name: 'Lagos', country: 'Nigeria', countryCode: 'NG', latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos', defaultMethod: 'Egyptian' },
  { name: 'Abuja', country: 'Nigeria', countryCode: 'NG', latitude: 9.0765, longitude: 7.3986, timezone: 'Africa/Lagos', defaultMethod: 'Egyptian' },
  { name: 'Kano', country: 'Nigeria', countryCode: 'NG', latitude: 12.0022, longitude: 8.5920, timezone: 'Africa/Lagos', defaultMethod: 'Egyptian' },
  { name: 'Ibadan', country: 'Nigeria', countryCode: 'NG', latitude: 7.3775, longitude: 3.9470, timezone: 'Africa/Lagos', defaultMethod: 'Egyptian' },
  { name: 'Casablanca', country: 'Morocco', countryCode: 'MA', latitude: 33.5731, longitude: -7.5898, timezone: 'Africa/Casablanca', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Rabat', country: 'Morocco', countryCode: 'MA', latitude: 34.0209, longitude: -6.8416, timezone: 'Africa/Casablanca', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Algiers', country: 'Algeria', countryCode: 'DZ', latitude: 36.7538, longitude: 3.0588, timezone: 'Africa/Algiers', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Tunis', country: 'Tunisia', countryCode: 'TN', latitude: 36.8065, longitude: 10.1815, timezone: 'Africa/Tunis', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Khartoum', country: 'Sudan', countryCode: 'SD', latitude: 15.5007, longitude: 32.5599, timezone: 'Africa/Khartoum', defaultMethod: 'Egyptian' },
  { name: 'Cape Town', country: 'South Africa', countryCode: 'ZA', latitude: -33.9249, longitude: 18.4241, timezone: 'Africa/Johannesburg', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Johannesburg', country: 'South Africa', countryCode: 'ZA', latitude: -26.2041, longitude: 28.0473, timezone: 'Africa/Johannesburg', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Nairobi', country: 'Kenya', countryCode: 'KE', latitude: -1.2921, longitude: 36.8219, timezone: 'Africa/Nairobi', defaultMethod: 'MuslimWorldLeague' },

  // South Asia
  { name: 'Karachi', country: 'Pakistan', countryCode: 'PK', latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi', defaultMethod: 'Karachi' },
  { name: 'Lahore', country: 'Pakistan', countryCode: 'PK', latitude: 31.5204, longitude: 74.3587, timezone: 'Asia/Karachi', defaultMethod: 'Karachi' },
  { name: 'Islamabad', country: 'Pakistan', countryCode: 'PK', latitude: 33.6844, longitude: 73.0479, timezone: 'Asia/Karachi', defaultMethod: 'Karachi' },
  { name: 'Dhaka', country: 'Bangladesh', countryCode: 'BD', latitude: 23.8103, longitude: 90.4125, timezone: 'Asia/Dhaka', defaultMethod: 'Karachi' },
  { name: 'Chittagong', country: 'Bangladesh', countryCode: 'BD', latitude: 22.3569, longitude: 91.7832, timezone: 'Asia/Dhaka', defaultMethod: 'Karachi' },
  { name: 'Mumbai', country: 'India', countryCode: 'IN', latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata', defaultMethod: 'Karachi' },
  { name: 'Delhi', country: 'India', countryCode: 'IN', latitude: 28.7041, longitude: 77.1025, timezone: 'Asia/Kolkata', defaultMethod: 'Karachi' },
  { name: 'Hyderabad', country: 'India', countryCode: 'IN', latitude: 17.3850, longitude: 78.4867, timezone: 'Asia/Kolkata', defaultMethod: 'Karachi' },

  // Southeast & East Asia
  { name: 'Jakarta', country: 'Indonesia', countryCode: 'ID', latitude: -6.2088, longitude: 106.8456, timezone: 'Asia/Jakarta', defaultMethod: 'Singapore' },
  { name: 'Surabaya', country: 'Indonesia', countryCode: 'ID', latitude: -7.2575, longitude: 112.7521, timezone: 'Asia/Jakarta', defaultMethod: 'Singapore' },
  { name: 'Kuala Lumpur', country: 'Malaysia', countryCode: 'MY', latitude: 3.1390, longitude: 101.6869, timezone: 'Asia/Kuala_Lumpur', defaultMethod: 'Singapore' },
  { name: 'Singapore', country: 'Singapore', countryCode: 'SG', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore', defaultMethod: 'Singapore' },
  { name: 'Bandar Seri Begawan', country: 'Brunei', countryCode: 'BN', latitude: 4.9031, longitude: 114.9398, timezone: 'Asia/Brunei', defaultMethod: 'Singapore' },
  { name: 'Bangkok', country: 'Thailand', countryCode: 'TH', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Tokyo', country: 'Japan', countryCode: 'JP', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo', defaultMethod: 'MuslimWorldLeague' },

  // Europe & Turkey
  { name: 'Istanbul', country: 'Turkey', countryCode: 'TR', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul', defaultMethod: 'Turkey' },
  { name: 'Ankara', country: 'Turkey', countryCode: 'TR', latitude: 39.9334, longitude: 32.8597, timezone: 'Europe/Istanbul', defaultMethod: 'Turkey' },
  { name: 'London', country: 'United Kingdom', countryCode: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Birmingham', country: 'United Kingdom', countryCode: 'GB', latitude: 52.4862, longitude: -1.8904, timezone: 'Europe/London', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Manchester', country: 'United Kingdom', countryCode: 'GB', latitude: 53.4808, longitude: -2.2426, timezone: 'Europe/London', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Paris', country: 'France', countryCode: 'FR', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Berlin', country: 'Germany', countryCode: 'DE', latitude: 52.5200, longitude: 13.4050, timezone: 'Europe/Berlin', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Frankfurt', country: 'Germany', countryCode: 'DE', latitude: 50.1109, longitude: 8.6821, timezone: 'Europe/Berlin', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', latitude: 52.3676, longitude: 4.9041, timezone: 'Europe/Amsterdam', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Brussels', country: 'Belgium', countryCode: 'BE', latitude: 50.8503, longitude: 4.3517, timezone: 'Europe/Brussels', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Vienna', country: 'Austria', countryCode: 'AT', latitude: 48.2082, longitude: 16.3738, timezone: 'Europe/Vienna', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Stockholm', country: 'Sweden', countryCode: 'SE', latitude: 59.3293, longitude: 18.0686, timezone: 'Europe/Stockholm', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Oslo', country: 'Norway', countryCode: 'NO', latitude: 59.9139, longitude: 10.7522, timezone: 'Europe/Oslo', defaultMethod: 'MuslimWorldLeague' },

  // North America
  { name: 'New York', country: 'United States', countryCode: 'US', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York', defaultMethod: 'NorthAmerica' },
  { name: 'Chicago', country: 'United States', countryCode: 'US', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago', defaultMethod: 'NorthAmerica' },
  { name: 'Houston', country: 'United States', countryCode: 'US', latitude: 29.7604, longitude: -95.3698, timezone: 'America/Chicago', defaultMethod: 'NorthAmerica' },
  { name: 'Los Angeles', country: 'United States', countryCode: 'US', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles', defaultMethod: 'NorthAmerica' },
  { name: 'Toronto', country: 'Canada', countryCode: 'CA', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto', defaultMethod: 'NorthAmerica' },
  { name: 'Montreal', country: 'Canada', countryCode: 'CA', latitude: 45.5017, longitude: -73.5673, timezone: 'America/Toronto', defaultMethod: 'NorthAmerica' },
  { name: 'Vancouver', country: 'Canada', countryCode: 'CA', latitude: 49.2827, longitude: -123.1207, timezone: 'America/Vancouver', defaultMethod: 'NorthAmerica' },

  // Australia & Pacific
  { name: 'Sydney', country: 'Australia', countryCode: 'AU', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Melbourne', country: 'Australia', countryCode: 'AU', latitude: -37.8136, longitude: 144.9631, timezone: 'Australia/Melbourne', defaultMethod: 'MuslimWorldLeague' },
  { name: 'Auckland', country: 'New Zealand', countryCode: 'NZ', latitude: -36.8485, longitude: 174.7633, timezone: 'Pacific/Auckland', defaultMethod: 'MuslimWorldLeague' },
];

export const DEFAULT_LOCATION: UserLocation = {
  latitude: 21.422487,
  longitude: 39.826206,
  cityName: 'Makkah',
  country: 'Saudi Arabia',
  countryCode: 'SA',
  timezone: 'Asia/Riyadh',
  isGps: false,
  updatedAt: Date.now(),
};

export const LOCATION_STORAGE_KEY = 'nooraya_shared_location';

/**
 * Calculates great-circle distance between two geographic points in kilometers
 * using the Haversine formula.
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if user has moved significantly (> thresholdKm) compared to previous location.
 */
export function hasSignificantLocationChange(
  current: UserLocation,
  newLat: number,
  newLng: number,
  thresholdKm = 10
): boolean {
  const dist = calculateDistanceKm(current.latitude, current.longitude, newLat, newLng);
  return dist >= thresholdKm;
}

/**
 * Auto-detects the recommended calculation method based on country code or country name.
 */
export function getDefaultCalculationMethod(countryCode?: string, countryName?: string): string {
  const code = (countryCode || '').toUpperCase().trim();
  const name = (countryName || '').toLowerCase().trim();

  // Saudi Arabia & Arabian Peninsula
  if (code === 'SA' || code === 'BH' || code === 'YE' || name.includes('saudi') || name.includes('bahrain') || name.includes('yemen')) {
    return 'UmmAlQura';
  }
  // UAE
  if (code === 'AE' || name.includes('emirates') || name.includes('dubai')) {
    return 'Dubai';
  }
  // Qatar
  if (code === 'QA' || name.includes('qatar')) {
    return 'Qatar';
  }
  // Kuwait
  if (code === 'KW' || name.includes('kuwait')) {
    return 'Kuwait';
  }
  // Egypt, Nigeria, Sudan, North/West Africa
  if (
    code === 'EG' || code === 'NG' || code === 'SD' || code === 'LY' || code === 'TD' ||
    name.includes('egypt') || name.includes('nigeria') || name.includes('sudan')
  ) {
    return 'Egyptian';
  }
  // Pakistan, Bangladesh, India, Afghanistan
  if (
    code === 'PK' || code === 'BD' || code === 'IN' || code === 'AF' ||
    name.includes('pakistan') || name.includes('bangladesh') || name.includes('india')
  ) {
    return 'Karachi';
  }
  // Turkey
  if (code === 'TR' || name.includes('turkey') || name.includes('türkiye')) {
    return 'Turkey';
  }
  // Southeast Asia (MUIS Singapore / Malaysia / Indonesia / Brunei)
  if (
    code === 'SG' || code === 'MY' || code === 'ID' || code === 'BN' ||
    name.includes('singapore') || name.includes('malaysia') || name.includes('indonesia') || name.includes('brunei')
  ) {
    return 'Singapore';
  }
  // North America (ISNA)
  if (code === 'US' || code === 'CA' || name.includes('united states') || name.includes('canada') || name.includes('america')) {
    return 'NorthAmerica';
  }
  // Default to Muslim World League (MWL) for Europe, Far East, and rest of world
  return 'MuslimWorldLeague';
}

/**
 * Safe client-side reverse geocoding to resolve friendly city/country names
 * from GPS coordinates. Uses BigDataCloud reverse geocode client API with
 * graceful offline fallback.
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<{ cityName: string; country: string; countryCode: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const cityName = data.city || data.locality || data.principalSubdivision || 'Detected Location';
      const country = data.countryName || 'Unknown Country';
      const countryCode = data.countryCode || '';
      return { cityName, country, countryCode };
    }
  } catch {
    // Non-blocking fallback
  }

  // Fallback: match closest known city preset within 50km
  let closest: CityPreset | null = null;
  let minDistance = Infinity;
  for (const city of POPULAR_GLOBAL_CITIES) {
    const d = calculateDistanceKm(lat, lng, city.latitude, city.longitude);
    if (d < minDistance) {
      minDistance = d;
      closest = city;
    }
  }

  if (closest && minDistance <= 60) {
    return { cityName: closest.name, country: closest.country, countryCode: closest.countryCode };
  }

  return {
    cityName: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
    country: 'GPS Location',
    countryCode: '',
  };
}

/**
 * Reads cached location from localStorage
 */
export function getSavedLocation(): UserLocation {
  if (typeof window === 'undefined') return DEFAULT_LOCATION;
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  return DEFAULT_LOCATION;
}

/**
 * Saves location to localStorage
 */
export function saveLocation(loc: UserLocation): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
    // Broadcast event so other tabs and components update synchronously
    window.dispatchEvent(new CustomEvent('nooraya-location-changed', { detail: loc }));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Detects system timezone reliably
 */
export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const LOCATION_PRIVACY_NOTICE = 
  "Your location is processed directly on your device to calculate accurate astronomical prayer times and align the Qibla compass. Coordinates are never saved on our servers unless you explicitly activate server-sent Push Notifications.";
