import { CloudRain, Flame, Waves, Bird, Wind, CloudLightning, Trees, Droplets, AudioWaveform, Zap, Train } from 'lucide-react';
import { AmbientTrack, Reciter } from '../types';

export const AMBIENT_TRACKS: AmbientTrack[] = [
  { id: 'rain', name: 'Light Rain', url: 'https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg', icon: CloudRain },
  { id: 'thunder', name: 'Thunder', url: 'https://actions.google.com/sounds/v1/weather/thunderstorm.ogg', icon: CloudLightning },
  { id: 'birds', name: 'Forest Birds', url: 'https://actions.google.com/sounds/v1/animals/birds_in_forest.ogg', icon: Bird },
  { id: 'fire', name: 'Fireplace', url: 'https://actions.google.com/sounds/v1/ambiences/fire.ogg', icon: Flame },
  { id: 'waves', name: 'Ocean Waves', url: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg', icon: Waves },
  { id: 'wind', name: 'Desert Wind', url: 'https://actions.google.com/sounds/v1/weather/strong_wind.ogg', icon: Wind },
  { id: 'owl', name: 'Night Owl', url: 'https://actions.google.com/sounds/v1/animals/owl_hoot.ogg', icon: Trees },
  { id: 'river', name: 'Flowing River', url: 'https://actions.google.com/sounds/v1/water/river_stream.ogg', icon: Droplets },
  { id: 'whale', name: 'Whale Song', url: 'https://actions.google.com/sounds/v1/animals/whale_song.ogg', icon: AudioWaveform },
  { id: 'crickets', name: 'Crickets', url: 'https://actions.google.com/sounds/v1/animals/crickets_and_night_insects.ogg', icon: Trees },
  { id: 'storm', name: 'Thunderstorm', url: 'https://actions.google.com/sounds/v1/weather/thunderstorm.ogg', icon: Zap },
  { id: 'train', name: 'Train Ride', url: 'https://actions.google.com/sounds/v1/transportation/train_pass_by.ogg', icon: Train },
];

/**
 * Curated reciters.
 *
 * Portraits are free-licensed photographs hosted on Wikimedia Commons and are
 * served through the `upload.wikimedia.org` thumbnail CDN (500px renders).
 * Reciters without a freely licensed portrait fall back to a gilded monogram
 * in <ReciterAvatar />, so profiles never look broken.
 */
export const CURATED_RECITERS: Reciter[] = [
  {
    id: 'afs',
    name: 'Mishary Rashid Alafasy',
    name_arabic: 'مشاري راشد العفاسي',
    style: 'Murattal',
    location: 'Kuwait City',
    region: 'Kuwait',
    serverUrl: 'https://server8.mp3quran.net/afs/',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/%D0%9C%D0%B8%D1%88%D0%B0%D1%80%D0%B8_%D0%A0%D0%B0%D1%88%D0%B8%D0%B4.jpg/500px-%D0%9C%D0%B8%D1%88%D0%B0%D1%80%D0%B8_%D0%A0%D0%B0%D1%88%D0%B8%D0%B4.jpg',
    title: 'Imam & broadcaster · Kuwait',
    tone: 'Bright, meticulously articulated tenor',
    activeSince: '1990s',
    distinction: 'Imam, Grand Mosque of Kuwait',
    signatureSurahs: [1, 2, 18, 36, 55, 67, 78],
    bio: 'Born in Kuwait in 1976, Mishary Rashid Alafasy memorised the Quran young and went on to study at the Islamic University of Madinah, earning ijazah in the readings of Hafs, Warsh and Qalʿun. He leads prayers at the Grand Mosque of Kuwait during Ramadan and his television programmes have made him one of the most listened-to voices in the Muslim world.',
  },
  {
    id: 'sds',
    name: 'Abdul Rahman Al-Sudais',
    name_arabic: 'عبد الرحمن السديس',
    style: 'Murattal',
    location: 'Mecca',
    region: 'Saudi Arabia',
    serverUrl: 'https://server11.mp3quran.net/sds/',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Abdul-Rahman_Al-Sudais_%28Cropped%2C_2011%29.jpg/500px-Abdul-Rahman_Al-Sudais_%28Cropped%2C_2011%29.jpg',
    title: 'Imam of the Sacred Mosque',
    tone: 'Soaring, emotionally expansive delivery',
    activeSince: '1984',
    distinction: 'Imam, Masjid al-Haram',
    signatureSurahs: [2, 3, 12, 18, 32, 36, 56],
    bio: 'Appointed imam of Masjid al-Haram in Mecca in 1984 at the age of 22, Abdul Rahman Al-Sudais holds a doctorate in the Quranic sciences from the Umm al-Qura University. His Tarawih recitations are broadcast worldwide each Ramadan, and he also serves as president of the General Authority for the Care of the Affairs of the Sacred Mosque and the Prophet’s Mosque.',
  },
  {
    id: 'shrm',
    name: 'Saud Al-Shuraim',
    name_arabic: 'سعود الشريم',
    style: 'Murattal',
    location: 'Mecca',
    region: 'Saudi Arabia',
    serverUrl: 'https://server7.mp3quran.net/shrm/',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Saud_Shuraim_doing_the_Khutbah.png/500px-Saud_Shuraim_doing_the_Khutbah.png',
    title: 'Imam & khatib of the Sacred Mosque',
    tone: 'Measured, solemn and deeply steady',
    activeSince: '1992',
    distinction: 'Imam, Masjid al-Haram',
    signatureSurahs: [2, 18, 32, 48, 67, 76],
    bio: 'A scholar of the Hanbali tradition and professor at Umm al-Qura University, Saud Al-Shuraim has led prayers in Masjid al-Haram since the early 1990s and delivers the Friday sermon there alongside Abdul Rahman Al-Sudais. His recitation is prized for its restraint, clarity and unhurried cadence.',
  },
  {
    id: 'maher',
    name: 'Maher Al-Muaiqly',
    name_arabic: 'ماهر المعيقلي',
    style: 'Murattal',
    location: 'Mecca',
    region: 'Saudi Arabia',
    serverUrl: 'https://server12.mp3quran.net/maher/',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Maher_Al_Mueaqly.jpg/500px-Maher_Al_Mueaqly.jpg',
    title: 'Imam of the Sacred Mosque',
    tone: 'Rich baritone with long, melismatic phrasing',
    activeSince: '2006',
    distinction: 'Imam, Masjid al-Haram',
    signatureSurahs: [1, 2, 18, 24, 31, 55, 67],
    bio: 'Maher Muaiqly, an engineer by training and a Quran teacher by calling, joined the imams of Masjid al-Haram in 2006. He is widely remembered for the evening he recited in Makkah during the 2014 fire at the Kaaba’s curtains. His style blends a warm baritone with long, meditative peaks.',
  },
  {
    id: 'yasser',
    name: 'Yasser Al-Dosari',
    name_arabic: 'ياسر الدوسري',
    style: 'Murattal',
    location: 'Mecca',
    region: 'Saudi Arabia',
    serverUrl: 'https://server11.mp3quran.net/yasser/',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Yasser_Al-dosari.jpg/500px-Yasser_Al-dosari.jpg',
    title: 'Imam of the Sacred Mosque',
    tone: 'Velvety, contemporary and deeply expressive',
    activeSince: '2007',
    distinction: 'Imam, Masjid al-Haram',
    signatureSurahs: [2, 12, 18, 25, 32, 39, 55, 78],
    bio: 'Yasser Al-Dosari leads prayers at Masjid al-Haram and teaches Quran at a secondary school in Riyadh. His recitations circulate widely for their tenderness and modern accessibility — a voice many listeners first meet through Ramadan Tarawih broadcasts.',
  },
  {
    id: 'balila',
    name: 'Bandar Baleela',
    name_arabic: 'بندر بليلة',
    style: 'Murattal',
    location: 'Mecca',
    region: 'Saudi Arabia',
    serverUrl: 'https://server6.mp3quran.net/balila/',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Bandar_Baleela.jpg/500px-Bandar_Baleela.jpg',
    title: 'Imam & Quran teacher, Sacred Mosque',
    tone: 'Gentle, luminous and calm',
    activeSince: '2010s',
    distinction: 'Imam, Masjid al-Haram',
    signatureSurahs: [1, 18, 36, 55, 67, 78],
    bio: 'Bandar Baleela is among the younger imams of Masjid al-Haram and teaches the sciences of Quranic recitation in Jeddah. His reading of Hafs an Asim is noted for its softness, precision of makhraj and quiet, contemplative pace.',
  },
  {
    id: 'hthfi',
    name: 'Ali Alhuthaifi',
    name_arabic: 'علي الحذيفي',
    style: 'Murattal',
    location: 'Medina',
    region: 'Saudi Arabia',
    serverUrl: 'https://server9.mp3quran.net/hthfi/',
    title: 'Imam of the Prophet’s Mosque',
    tone: 'Classical Hijazi restraint, unhurried and precise',
    activeSince: '1957',
    distinction: 'Imam, Masjid an-Nabawi',
    signatureSurahs: [2, 18, 33, 55, 67],
    bio: "Ali Ahmed Al-Hudhaify (1926–2024) memorised the Quran before the age of ten and served in Madinah's learned circles for six decades, teaching Quran and Hadith and leading prayers at Masjid an-Nabawi for many years. His recitation carries the classical Hijazi school: exact, dignified and without ornament.",
  },
  {
    id: 'qasm',
    name: 'Abdulmohsen Al Qasim',
    name_arabic: 'عبد المحسن القاسم',
    style: 'Murattal',
    location: 'Medina',
    region: 'Saudi Arabia',
    serverUrl: 'https://server8.mp3quran.net/qasm/',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Abdul_Mohsin_Al-Qasim.jpg/500px-Abdul_Mohsin_Al-Qasim.jpg',
    title: 'Imam & qadi of Madinah',
    tone: 'Dignified, flowing and deeply melodic',
    activeSince: '1986',
    distinction: 'Imam, Masjid an-Nabawi',
    signatureSurahs: [2, 18, 32, 36, 47, 56, 67],
    bio: 'Abdulmohsen Al-Qasim has led prayers at Masjid an-Nabawi since 1986 and serves as a judge in Madinah. He is also a member of Saudi Arabia’s senior scholars’ council; his Ramadan prayers in the Prophet’s Mosque are broadcast around the world.',
  },
  {
    id: 'basit',
    name: 'Abdulbasit Abdulsamad',
    name_arabic: 'عبد الباسط عبد الصمد',
    style: 'Mujawwad',
    location: 'Egypt',
    region: 'Egypt',
    serverUrl: 'https://server7.mp3quran.net/basit/',
    title: 'The Voice of Mecca · Egypt, 1927–1988',
    tone: 'Unrivalled breath control, golden tarab phrasing',
    activeSince: '1949',
    distinction: 'Master of the Egyptian school',
    signatureSurahs: [2, 12, 19, 26, 36, 50, 55, 56, 78],
    bio: 'Abdulbasit Abdulsamad (1927–1988) memorised the Quran in his hometown of Armanta, Upper Egypt, and by his twenties had become the pre-eminent reciter of the Egyptian school. Honoured with the title "the Voice of Mecca", his mujawwad recordings remain the benchmark against which beauty of recitation is measured.',
  },
];

export const DEFAULT_RECITER_ID = 'afs';

/** Two-letter monogram used when a reciter has no portrait. */
export function reciterInitials(name: string): string {
  const clean = name.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
  if (clean.length === 0) return 'NR';
  if (clean.length === 1) return clean[0].slice(0, 2).toUpperCase();
  return (clean[0][0] + clean[clean.length - 1][0]).toUpperCase();
}

/** Deterministic accent hue per reciter so monograms and cards feel bespoke. */
export function reciterHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}
