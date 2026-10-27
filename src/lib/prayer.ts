import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Qibla,
  Madhab,
  HighLatitudeRule,
} from 'adhan';
import {
  UserLocation,
  POPULAR_GLOBAL_CITIES,
  DEFAULT_LOCATION,
  getDefaultCalculationMethod,
  calculateDistanceKm,
} from './location';

export {
  UserLocation,
  POPULAR_GLOBAL_CITIES,
  DEFAULT_LOCATION,
  getDefaultCalculationMethod,
  calculateDistanceKm,
};

// Backward-compatible type and list for existing consumers
export interface CityLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export const POPULAR_CITIES: CityLocation[] = POPULAR_GLOBAL_CITIES.map((c) => ({
  name: c.name,
  country: c.country,
  latitude: c.latitude,
  longitude: c.longitude,
}));

export interface CalculationMethodOption {
  id: string;
  name: string;
  shortName: string;
  fajrAngle: number;
  ishaAngle: number | string;
  description: string;
  recommendedRegions: string[];
}

export const CALCULATION_METHODS: CalculationMethodOption[] = [
  {
    id: 'MuslimWorldLeague',
    name: 'Muslim World League (MWL)',
    shortName: 'MWL',
    fajrAngle: 18,
    ishaAngle: 17,
    description: 'Standard for Europe, the Far East, and international regions.',
    recommendedRegions: ['Europe', 'East Asia', 'Global'],
  },
  {
    id: 'Egyptian',
    name: 'Egyptian General Authority of Survey',
    shortName: 'Egyptian',
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    description: 'Standard across Egypt, Africa, Nigeria, Sudan, and parts of the Levant.',
    recommendedRegions: ['Egypt', 'Nigeria', 'Africa', 'Levant'],
  },
  {
    id: 'Karachi',
    name: 'University of Islamic Sciences, Karachi',
    shortName: 'Karachi',
    fajrAngle: 18,
    ishaAngle: 18,
    description: 'Standard across Pakistan, India, Bangladesh, and Afghanistan.',
    recommendedRegions: ['Pakistan', 'India', 'Bangladesh'],
  },
  {
    id: 'UmmAlQura',
    name: 'Umm al-Qura University, Makkah',
    shortName: 'Umm Al-Qura',
    fajrAngle: 18.5,
    ishaAngle: '90 min',
    description: 'Official standard for the Kingdom of Saudi Arabia and the Arabian Peninsula.',
    recommendedRegions: ['Saudi Arabia', 'Gulf'],
  },
  {
    id: 'Dubai',
    name: 'Dubai (UAE Islamic Affairs)',
    shortName: 'Dubai',
    fajrAngle: 18.2,
    ishaAngle: 18.2,
    description: 'Official authority for Dubai and the United Arab Emirates.',
    recommendedRegions: ['UAE'],
  },
  {
    id: 'Qatar',
    name: 'Ministry of Awqaf & Islamic Affairs, Qatar',
    shortName: 'Qatar',
    fajrAngle: 18,
    ishaAngle: '90 min',
    description: 'Official authority for the State of Qatar.',
    recommendedRegions: ['Qatar'],
  },
  {
    id: 'Kuwait',
    name: 'Ministry of Awqaf & Islamic Affairs, Kuwait',
    shortName: 'Kuwait',
    fajrAngle: 18,
    ishaAngle: 17.5,
    description: 'Official standard for the State of Kuwait.',
    recommendedRegions: ['Kuwait'],
  },
  {
    id: 'Singapore',
    name: 'MUIS (Islamic Religious Council of Singapore)',
    shortName: 'MUIS',
    fajrAngle: 20,
    ishaAngle: 18,
    description: 'Official standard for Singapore, Malaysia, and Indonesia.',
    recommendedRegions: ['Singapore', 'Malaysia', 'Indonesia'],
  },
  {
    id: 'NorthAmerica',
    name: 'ISNA (Islamic Society of North America)',
    shortName: 'ISNA',
    fajrAngle: 15,
    ishaAngle: 15,
    description: 'Widely used in the United States and Canada.',
    recommendedRegions: ['United States', 'Canada'],
  },
  {
    id: 'Turkey',
    name: 'Diyanet İşleri Başkanlığı (Turkey)',
    shortName: 'Diyanet',
    fajrAngle: 18,
    ishaAngle: 17,
    description: 'Official standard for Turkey and Turkish communities.',
    recommendedRegions: ['Turkey'],
  },
  {
    id: 'MoonsightingCommittee',
    name: 'Moonsighting Committee Worldwide',
    shortName: 'Moonsighting',
    fajrAngle: 18,
    ishaAngle: 18,
    description: 'Based on astronomical calculations verified by visual sightings.',
    recommendedRegions: ['International'],
  },
  {
    id: 'Tehran',
    name: 'Institute of Geophysics, University of Tehran',
    shortName: 'Tehran',
    fajrAngle: 17.7,
    ishaAngle: 14,
    description: 'Standard computation for Iran and Shia jurisprudence.',
    recommendedRegions: ['Iran'],
  },
];

export interface PrayerMinuteAdjustments {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface PrayerSettings {
  cityName: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  isGps: boolean;
  method: string;
  madhab: 'shafi' | 'hanafi';
  highLatitudeRule: 'MiddleOfTheNight' | 'SeventhOfTheNight' | 'TwilightAngle';
  adjustments: PrayerMinuteAdjustments;
  is24Hour: boolean;
  notificationsEnabled: boolean;
  prayerReminders: Record<string, boolean>;
  reminderMinutesBefore?: number;
  activeAdhanVoiceId?: string;
}

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  cityName: 'Makkah',
  country: 'Saudi Arabia',
  countryCode: 'SA',
  latitude: 21.422487,
  longitude: 39.826206,
  isGps: false,
  method: 'UmmAlQura',
  madhab: 'shafi',
  highLatitudeRule: 'MiddleOfTheNight',
  adjustments: {
    fajr: 0,
    sunrise: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: 0,
    isha: 0,
  },
  is24Hour: false,
  notificationsEnabled: true,
  prayerReminders: {
    fajr: true,
    sunrise: false,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
  reminderMinutesBefore: 0,
  activeAdhanVoiceId: 'medina-standard',
};

/**
 * Returns configured calculation parameters from the adhan library
 */
export function getCalculationParameters(
  method: string,
  madhab: 'shafi' | 'hanafi' = 'shafi',
  highLatitudeRule: 'MiddleOfTheNight' | 'SeventhOfTheNight' | 'TwilightAngle' = 'MiddleOfTheNight'
) {
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
    case 'NorthAmerica':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'MoonsightingCommittee':
      params = CalculationMethod.MoonsightingCommittee();
      break;
    case 'Tehran':
      params = CalculationMethod.Tehran();
      break;
    case 'Turkey':
      params = CalculationMethod.Turkey ? CalculationMethod.Turkey() : CalculationMethod.MuslimWorldLeague();
      break;
    case 'MuslimWorldLeague':
    default:
      params = CalculationMethod.MuslimWorldLeague();
      break;
  }

  // Madhab (Asr shadow factor)
  if (madhab === 'hanafi') {
    params.madhab = Madhab.Hanafi;
  } else {
    params.madhab = Madhab.Shafi;
  }

  // High Latitude Rule
  if (highLatitudeRule === 'SeventhOfTheNight') {
    params.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;
  } else if (highLatitudeRule === 'TwilightAngle') {
    params.highLatitudeRule = HighLatitudeRule.TwilightAngle;
  } else {
    params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;
  }

  return params;
}

export interface ComputedPrayersWithAuxiliary {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
  // Auxiliary times
  duha: Date;
  midnight: Date;
  tahajjud: Date;
  raw: PrayerTimes;
}

/**
 * Calculates primary prayer times and auxiliary Islamic astronomical times
 * with custom minute adjustments and high latitude support.
 */
export function calculatePrayerTimes(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
  method: string = 'MuslimWorldLeague',
  madhab: 'shafi' | 'hanafi' = 'shafi',
  highLatitudeRule: 'MiddleOfTheNight' | 'SeventhOfTheNight' | 'TwilightAngle' = 'MiddleOfTheNight',
  adjustments: PrayerMinuteAdjustments = DEFAULT_PRAYER_SETTINGS.adjustments
): ComputedPrayersWithAuxiliary {
  const coords = new Coordinates(latitude, longitude);
  const params = getCalculationParameters(method, madhab, highLatitudeRule);
  const pt = new PrayerTimes(coords, date, params);

  // Apply minute adjustments
  const applyAdj = (d: Date, minutes: number = 0): Date => {
    return new Date(d.getTime() + (minutes || 0) * 60 * 1000);
  };

  const fajr = applyAdj(pt.fajr, adjustments?.fajr);
  const sunrise = applyAdj(pt.sunrise, adjustments?.sunrise);
  const dhuhr = applyAdj(pt.dhuhr, adjustments?.dhuhr);
  const asr = applyAdj(pt.asr, adjustments?.asr);
  const maghrib = applyAdj(pt.maghrib, adjustments?.maghrib);
  const isha = applyAdj(pt.isha, adjustments?.isha);

  // Duha: approx 15 minutes after sunrise
  const duha = new Date(sunrise.getTime() + 15 * 60 * 1000);

  // Next day's Fajr for nocturnal division
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowPt = new PrayerTimes(coords, tomorrow, params);
  const nextFajr = applyAdj(tomorrowPt.fajr, adjustments?.fajr);

  // Night duration between Maghrib and Next Fajr
  const nightDurationMs = Math.max(0, nextFajr.getTime() - maghrib.getTime());

  // Islamic Midnight: exactly halfway between Maghrib and Fajr
  const midnight = new Date(maghrib.getTime() + nightDurationMs / 2);

  // Tahajjud (Last third of the night): beginning of the final 1/3 before Fajr
  const tahajjud = new Date(maghrib.getTime() + (nightDurationMs * 2) / 3);

  return {
    fajr,
    sunrise,
    dhuhr,
    asr,
    maghrib,
    isha,
    duha,
    midnight,
    tahajjud,
    raw: pt,
  };
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
  return Math.round(calculateDistanceKm(lat1, lon1, lat2, lon2));
}

export function formatPrayerTime(date: Date, is24Hour: boolean = false): string {
  if (!date || isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !is24Hour,
  });
}

/**
 * Robust Hijri date calculator with English and Arabic month names
 */
export function getHijriDate(date: Date = new Date()): { english: string; arabic: string; full: string } {
  try {
    const enFormatter = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const arFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const enStr = enFormatter.format(date);
    const arStr = arFormatter.format(date);

    return {
      english: `${enStr} AH`,
      arabic: arStr,
      full: `${enStr} AH • ${arStr}`,
    };
  } catch {
    return {
      english: '1448 AH',
      arabic: '١٤٤٨ هـ',
      full: '1448 AH',
    };
  }
}
