import { CloudRain, Flame, Waves, Bird, Wind, CloudLightning } from 'lucide-react';
import { AmbientTrack, Reciter } from '../types';

export const AMBIENT_TRACKS: AmbientTrack[] = [
  { id: 'rain', name: 'Light Rain', url: 'https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg', icon: CloudRain },
  { id: 'fire', name: 'Fireplace', url: 'https://actions.google.com/sounds/v1/ambiences/fire.ogg', icon: Flame },
  { id: 'waves', name: 'Ocean Waves', url: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg', icon: Waves },
  { id: 'birds', name: 'Forest Birds', url: 'https://actions.google.com/sounds/v1/animals/birds_in_forest.ogg', icon: Bird },
  { id: 'wind', name: 'Desert Wind', url: 'https://actions.google.com/sounds/v1/weather/strong_wind.ogg', icon: Wind },
  { id: 'storm', name: 'Thunderstorm', url: 'https://actions.google.com/sounds/v1/weather/thunderstorm.ogg', icon: CloudLightning },
];

export const CURATED_RECITERS: Reciter[] = [
  { id: 'afs', name: 'Mishary Rashid Alafasy', style: 'Murattal', location: 'Kuwait', serverUrl: 'https://server8.mp3quran.net/afs/' },
  { id: 'sds', name: 'Abdul Rahman Al-Sudais', style: 'Murattal', location: 'Mecca (Grand Mosque)', serverUrl: 'https://server11.mp3quran.net/sds/' },
  { id: 'shrm', name: 'Saud Al-Shuraim', style: 'Murattal', location: 'Mecca (Grand Mosque)', serverUrl: 'https://server7.mp3quran.net/shrm/' },
  { id: 'maher', name: 'Maher Al-Muaiqly', style: 'Murattal', location: 'Mecca (Grand Mosque)', serverUrl: 'https://server12.mp3quran.net/maher/' },
  { id: 'yasser', name: 'Yasser Al-Dosari', style: 'Murattal', location: 'Mecca (Grand Mosque)', serverUrl: 'https://server11.mp3quran.net/yasser/' },
  { id: 'balila', name: 'Bandar Baleela', style: 'Murattal', location: 'Mecca (Grand Mosque)', serverUrl: 'https://server6.mp3quran.net/balila/' },
  { id: 'hthfi', name: 'Ali Alhuthaifi', style: 'Murattal', location: 'Medina (Prophet\'s Mosque)', serverUrl: 'https://server9.mp3quran.net/hthfi/' },
  { id: 'qasm', name: 'Abdulmohsen Al Qasim', style: 'Murattal', location: 'Medina (Prophet\'s Mosque)', serverUrl: 'https://server8.mp3quran.net/qasm/' },
  { id: 'basit', name: 'Abdulbasit Abdulsamad', style: 'Mujawwad', location: 'Egypt', serverUrl: 'https://server7.mp3quran.net/basit/' },
];

export const DEFAULT_RECITER_ID = 'afs';
