export interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name: { name: string };
  verses_count: number;
}

export interface Reciter {
  id: string;
  name: string;
  nameArabic?: string;
  style: string;
  location?: string;
  region?: string;
  category?: string;
  serverUrl?: string;
  /**
   * File extensions to try when building a surah URL, in order of preference.
   * Defaults to AUDIO_FORMATS (mp4 first, then mp3) — see lib/constants.ts.
   */
  formats?: string[];
  /** Portrait photo URL shown on reciter cards. Optional — falls back to a monogram. */
  imageUrl?: string;
  /** Attribution link for the photo (e.g. the Wikimedia Commons file page). */
  imageCredit?: string;
  /** License of the photo (e.g. CC BY-SA 4.0, Public domain). */
  imageLicense?: string;
  /** Short biography managed in the admin panel. Optional. */
  bio?: string;
  /** Whether this reciter is featured on the home screen. */
  featured?: boolean;
  /** Available surahs for this reciter (1-114). If omitted, reciter has all 114 surahs. */
  availableSurahs?: number[];
  /** Fallback servers to try in order if serverUrl fails */
  fallbackServerUrls?: string[];
  /** Moshaf recitation style/narration name */
  moshafName?: string;
}

export interface AmbientTrack {
  id: string;
  name: string;
  url: string;
  icon: any; 
}

export interface AmbientPreset {
  id: string;
  name: string;
  nameArabic?: string;
  description: string;
  soundId: string;
  audioUrl: string;
  videoUrl: string;
  defaultVolume: number;
}

export interface Background {
  id: string;
  name: string;
  videoUrl: string;
  ambientUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  category?: string;
  sizeBytes?: number;
  createdAt?: number;
}

export interface CustomVideo {
  id: string;
  name: string;
  videoUrl?: string;
  videoUrl720p?: string;
  videoUrl480p?: string;
  posterUrl?: string;
  poster_url?: string;
  category?: string;
  isDefault?: boolean;
  isPremium?: boolean;
  isDraft?: boolean;
  isActive?: boolean;
  durationSeconds?: number;
  renditions?: Array<{
    resolution: string;
    url: string;
    size_bytes?: number;
    width?: number;
    height?: number;
    bitrate_bps?: number;
  }>;
  storagePaths?: string[];
  attribution?: string;
  sourceUrl?: string;
  creator?: string;
  licenseName?: string;
  licenseUrl?: string;
  dateChecked?: string;
  attributionRequired?: boolean;
  /** Optional longer label for the admin background library. */
  description?: string;
  sizeBytes?: number;
  createdAt?: number;
}
