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
}

export interface AmbientTrack {
  id: string;
  name: string;
  url: string;
  icon: any; 
}

export interface CustomVideo {
  id: string;
  name: string;
  /** Optional longer label for the admin background library. */
  description?: string;
  sizeBytes?: number;
  createdAt?: number;
}
