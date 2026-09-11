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
  /** Portrait photo URL shown on reciter cards. Optional — falls back to a monogram. */
  imageUrl?: string;
  /** Attribution link for the photo (e.g. the Wikimedia Commons file page). */
  imageCredit?: string;
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
