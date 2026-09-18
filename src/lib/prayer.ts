import { Coordinates, CalculationMethod, PrayerTimes, Qibla, Madhab } from 'adhan';

export interface CityLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export const POPULAR_CITIES: CityLocation[] = [
  { name: 'Makkah', country: 'Saudi Arabia', latitude: 21.422487, longitude: 39.826206 },
  { name: 'Madinah', country: 'Saudi Arabia', latitude: 24.4672, longitude: 39.6111 },
  { name: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357 },
  { name: 'Istanbul', country: 'Turkey', latitude: 41.0082, longitude: 28.9784 },
  { name: 'Dubai', country: 'UAE', latitude: 25.2048, longitude: 55.2708 },
  { name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278 },
  { name: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.0060 },
  { name: 'Los Angeles', country: 'USA', latitude: 34.0522, longitude: -118.2437 },
  { name: 'Toronto', country: 'Canada', latitude: 43.6532, longitude: -79.3832 },
  { name: 'Jakarta', country: 'Indonesia', latitude: -6.2088, longitude: 106.8456 },
  { name: 'Kuala Lumpur', country: 'Malaysia', latitude: 3.1390, longitude: 101.6869 },
  { name: 'Karachi', country: 'Pakistan', latitude: 24.8607, longitude: 67.0011 },
  { name: 'Dhaka', country: 'Bangladesh', latitude: 23.8103, longitude: 90.4125 },
  { name: 'Lagos', country: 'Nigeria', latitude: 6.5244, longitude: 3.3792 },
  { name: 'Abuja', country: 'Nigeria', latitude: 9.0765, longitude: 7.3986 },
  { name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 },
  { name: 'Berlin', country: 'Germany', latitude: 52.5200, longitude: 13.4050 },
  { name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093 },
  { name: 'Singapore', country: 'Singapore', latitude: 1.3521, longitude: 103.8198 },
  { name: 'Cape Town', country: 'South Africa', latitude: -33.9249, longitude: 18.4241 },
];

export const CALCULATION_METHODS = [
  { id: 'MuslimWorldLeague', name: 'Muslim World League (MWL)' },
  { id: 'Egyptian', name: 'Egyptian General Authority' },
  { id: 'Karachi', name: 'Univ. of Islamic Sciences, Karachi' },
  { id: 'UmmAlQura', name: 'Umm al-Qura University, Makkah' },
  { id: 'NorthAmerica', name: 'ISNA (North America)' },
  { id: 'Dubai', name: 'Dubai (UAE)' },
  { id: 'Qatar', name: 'Qatar' },
  { id: 'Kuwait', name: 'Kuwait' },
  { id: 'Singapore', name: 'MUIS (Singapore)' },
];

export interface PrayerSettings {
  cityName: string;
  latitude: number;
  longitude: number;
  isGps: boolean;
  method: string;
  madhab: 'shafi' | 'hanafi';
  is24Hour: boolean;
  notificationsEnabled: boolean;
  prayerReminders: Record<string, boolean>;
}

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  cityName: 'Makkah',
  latitude: 21.422487,
  longitude: 39.826206,
  isGps: false,
  method: 'MuslimWorldLeague',
  madhab: 'shafi',
  is24Hour: false,
  notificationsEnabled: true,
  prayerReminders: {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
};

export function getCalculationParameters(method: string, madhab: 'shafi' | 'hanafi') {
  let params;
  switch (method) {
    case 'Egyptian':
      params = CalculationMethod.Egyptian();
      break;
    case 'Karachi':
      params = CalculationMethod.Karachi();
      break;
    case 'UmmAlQura':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'NorthAmerica':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'Dubai':
      params = CalculationMethod.Dubai();
      break;
    case 'Qatar':
      params = CalculationMethod.Qatar();
      break;
    case 'Kuwait':
      params = CalculationMethod.Kuwait();
      break;
    case 'Singapore':
      params = CalculationMethod.Singapore();
      break;
    case 'MuslimWorldLeague':
    default:
      params = CalculationMethod.MuslimWorldLeague();
      break;
  }

  if (madhab === 'hanafi') {
    params.madhab = Madhab.Hanafi;
  } else {
    params.madhab = Madhab.Shafi;
  }

  return params;
}

export function calculatePrayerTimes(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
  method: string = 'MuslimWorldLeague',
  madhab: 'shafi' | 'hanafi' = 'shafi'
) {
  const coords = new Coordinates(latitude, longitude);
  const params = getCalculationParameters(method, madhab);
  return new PrayerTimes(coords, date, params);
}

export function calculateQiblaDirection(latitude: number, longitude: number): number {
  const coords = new Coordinates(latitude, longitude);
  return Qibla(coords);
}

/**
 * Calculates great-circle distance between user's coordinates and Kaaba in kilometers
 */
export function calculateDistanceToKaaba(lat1: number, lon1: number): number {
  const lat2 = 21.422487;
  const lon2 = 39.826206;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatPrayerTime(date: Date, is24Hour: boolean = false): string {
  if (!date || isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !is24Hour,
  });
}

export function getHijriDate(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return formatter.format(date) + ' AH';
  } catch {
    // Fallback if islamic calendar is not supported in the host JS engine
    return '1448 AH';
  }
}
