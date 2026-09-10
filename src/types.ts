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
  style: string;
  location?: string;
  region?: string;
  serverUrl: string;

  /* ---- profile / editorial fields (optional: custom reciters may omit them) ---- */
  /** Portrait. Free-licensed photos hosted on Wikimedia Commons. */
  image?: string;
  name_arabic?: string;
  /** One-line label shown under the name, e.g. "Imam, Masjid al-Haram". */
  title?: string;
  /** Biographical paragraph for the reciter profile page. */
  bio?: string;
  /** Short characterisation of the voice. */
  tone?: string;
  /** Year the reciter became widely known (approximate for historical figures). */
  activeSince?: string;
  /** "Masjid al-Haram", "Radio & TV", ... shown as a distinction pill. */
  distinction?: string;
  /** Surah numbers this reciter is best known for. */
  signatureSurahs?: number[];
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
}
