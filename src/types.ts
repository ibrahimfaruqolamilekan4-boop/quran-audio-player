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
  serverUrl: string;
}

export interface AmbientTrack {
  id: string;
  name: string;
  url: string;
  icon: any; 
}

