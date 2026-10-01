import type { Reciter } from '../types';

/**
 * Row shape returned by /api/reciters (the admin-managed `global_reciters` table).
 * `serverUrl` is optional there because a row may exist purely to carry a portrait for a
 * curated sheikh, whose audio mirror is already defined in code.
 */
export interface GlobalReciterRow {
  id: string;
  name: string;
  style?: string | null;
  serverUrl?: string | null;
  imageUrl?: string | null;
}

/** A curated sheikh with the Arabic spelling of his name from his mp3quran.net listing. */
export interface CuratedReciter extends Reciter {
  nameArabic?: string;
}

/**
 * Sheikhs added after the original curated list in src/lib/constants.ts.
 *
 * Audio: mp3quran.net mirrors, Rewayat Hafs A'n Assem - Murattal, all 114 surahs
 * (mirror paths verified against the mp3quran.net reciters listing).
 * Photos: no Commons image with a verified free licence yet, so ReciterAvatar falls back
 * to the gradient monogram; admins can upload portraits in the admin portrait editor.
 *
 * Abdullah Al-Juhany leads the list as a featured sheikh; the Madinah entries below are
 * the imams of the Prophet's Mosque per the official Haramain schedule (prh.gov.sa).
 */
export const EXTRA_CURATED_RECITERS: CuratedReciter[] = [
  {
    id: 'jhn',
    name: 'Abdullah Al-Juhany',
    nameArabic: 'عبدالله عواد الجهني',
    style: 'Murattal',
    location: 'Makkah',
    region: 'Saudi Arabia',
    serverUrl: 'https://server13.mp3quran.net/jhn/',
    bio: 'Saudi qari who serves as an imam of Masjid al-Haram in Makkah; recites in a calm, measured murattal.',
  },
  {
    id: 's_bud',
    name: 'Salah Al-Budair',
    nameArabic: 'صلاح البدير',
    style: 'Murattal',
    location: 'Medina',
    region: 'Saudi Arabia',
    serverUrl: 'https://server6.mp3quran.net/s_bud/',
    bio: 'Saudi qari and judge who serves as an imam at the Prophet’s Mosque in Madinah.',
  },
  {
    id: 'thubti',
    name: 'Abdulbari Ath-Thubaity',
    nameArabic: 'عبدالبارئ الثبيتي',
    style: 'Murattal',
    location: 'Medina',
    region: 'Saudi Arabia',
    serverUrl: 'https://server6.mp3quran.net/thubti/',
    bio: 'Saudi qari; imam at the Prophet’s Mosque in Madinah.',
  },
  {
    id: 'buajan',
    name: 'Abdullah Al-Buayjan',
    nameArabic: 'عبدالله البعيجان',
    style: 'Murattal',
    location: 'Medina',
    region: 'Saudi Arabia',
    serverUrl: 'https://server8.mp3quran.net/buajan/',
    bio: 'Saudi qari; imam at the Prophet’s Mosque in Madinah.',
  },
  {
    id: 'ahmad_huth',
    name: 'Ahmad Al-Hudhaify',
    nameArabic: 'أحمد الحذيفي',
    style: 'Murattal',
    location: 'Medina',
    region: 'Saudi Arabia',
    serverUrl: 'https://server8.mp3quran.net/ahmad_huth/',
    bio: 'Saudi qari, son of Sheikh Ali Al-Hudhaify; serves as an imam at the Prophet’s Mosque in Madinah.',
  },
  {
    id: 'mohna',
    name: 'Khalid Al-Muhanna',
    nameArabic: 'خالد المهنا',
    style: 'Murattal',
    location: 'Medina',
    region: 'Saudi Arabia',
    serverUrl: 'https://server11.mp3quran.net/mohna/',
    bio: 'Saudi qari and khatib; imam at the Prophet’s Mosque in Madinah.',
  },
  {
    id: 'm_burhaji',
    name: 'Muhammad Barhaji',
    nameArabic: 'محمد برهجي',
    style: 'Murattal',
    location: 'Medina',
    region: 'Saudi Arabia',
    serverUrl: 'https://server16.mp3quran.net/M_Burhaji/Rewayat-Hafs-A-n-Assem/',
    bio: 'Saudi qari; serves as an imam at the Prophet’s Mosque in Madinah.',
  },
  {
    id: 'a_alqrafi',
    name: 'Abdullah Al-Qarafi',
    nameArabic: 'عبدالله القرافي',
    style: 'Murattal',
    location: 'Saudi Arabia',
    region: 'Saudi Arabia',
    serverUrl: 'https://server16.mp3quran.net/a_alqrafi/Rewayat-Hafs-A-n-Assem/',
    bio: 'Saudi qari known for a clear, engaging murattal.',
  },
  {
    id: 'husr',
    name: 'Mahmoud Khalil Al-Husary',
    nameArabic: 'محمود خليل الحصري',
    style: 'Murattal',
    location: 'Cairo',
    region: 'Egypt',
    serverUrl: 'https://server13.mp3quran.net/husr/',
    bio: 'Egyptian reciter (1917–1980) celebrated for precise tajwid; a leading voice of Egyptian qira’ah radio and masajid.',
  },
  {
    id: 'mustafa',
    name: 'Mustafa Ismail',
    nameArabic: 'مصطفى إسماعيل',
    style: 'Murattal',
    location: 'Cairo',
    region: 'Egypt',
    serverUrl: 'https://server8.mp3quran.net/mustafa/',
    bio: 'Egyptian reciter (1905–1978) renowned for a powerful, deeply emotional recitation.',
  },
  {
    id: 'shatri',
    name: 'Abu Bakr Ash-Shatri',
    nameArabic: 'أبو بكر الشاطري',
    style: 'Murattal',
    location: 'Jeddah',
    region: 'Saudi Arabia',
    serverUrl: 'https://server11.mp3quran.net/shatri/',
    bio: 'Saudi reciter known for a serene murattal.',
  },
  {
    id: 's_gmd',
    name: 'Saad Al-Ghamdi',
    nameArabic: 'سعد الغامدي',
    style: 'Murattal',
    location: 'Saudi Arabia',
    region: 'Saudi Arabia',
    serverUrl: 'https://server7.mp3quran.net/s_gmd/',
    bio: 'Saudi reciter known for both murattal and mujawwad recordings.',
  },
  {
    id: 'qtm',
    name: 'Nasser Al-Qatami',
    nameArabic: 'ناصر القطامي',
    style: 'Murattal',
    location: 'Riyadh',
    region: 'Saudi Arabia',
    serverUrl: 'https://server6.mp3quran.net/qtm/',
    bio: 'Saudi qari, imam of a masjid in Riyadh; among the most widely heard Saudi murattal reciters.',
  },
  {
    id: 'wdee3',
    name: 'Wadee Hammadi Al-Yamani',
    nameArabic: 'وديع اليماني',
    style: 'Murattal',
    location: 'Saudi Arabia',
    region: 'Yemen',
    serverUrl: 'https://server6.mp3quran.net/wdee3/',
    bio: 'Yemeni qari resident in Saudi Arabia, known for leading prayers and a sweet murattal.',
  },
  {
    id: 'hazza',
    name: 'Hazza Al-Balushi',
    nameArabic: 'هزاع البلوشي',
    style: 'Murattal',
    location: 'Oman',
    region: 'Oman',
    serverUrl: 'https://server11.mp3quran.net/hazza/',
    bio: 'Omani qari known for a soft, sweet murattal.',
  },
  {
    id: 'dgsh',
    name: 'Yusuf Edghouch',
    nameArabic: 'يوسف الدغوش',
    style: 'Murattal',
    location: 'Morocco',
    region: 'Morocco',
    serverUrl: 'https://server7.mp3quran.net/dgsh/',
    bio: 'Moroccan qari known for hifz mastery and a clear murattal.',
  },
];

/**
 * Merge admin-managed global rows over the reciters defined in code.
 *
 * The curated pool is CURATED_RECITERS (src/lib/constants.ts) plus EXTRA_CURATED_RECITERS.
 *
 * - Same id with a photo -> that sheikh's portrait is replaced (admin control).
 * - Same id without a photo -> left untouched, so an empty global row cannot wipe a curated image.
 * - Unknown id with a server URL -> treated as a new global sheikh and appended.
 */
export function resolveReciters<T extends Reciter>(base: T[], globals: GlobalReciterRow[]): T[] {
  const pool: Reciter[] = [...EXTRA_CURATED_RECITERS, ...base];

  if (!globals.length) return pool as T[];

  const merged = pool.map(reciter => {
    const override = globals.find(g => g.id === reciter.id);
    if (!override?.imageUrl) return reciter;
    return { ...reciter, imageUrl: override.imageUrl, imageCredit: undefined };
  });

  const appended = globals
    .filter(g => g.serverUrl && !pool.some(r => r.id === g.id))
    .map(g => ({
      id: g.id,
      name: g.name,
      style: g.style || 'Murattal',
      region: 'Global',
      serverUrl: g.serverUrl as string,
      ...(g.imageUrl ? { imageUrl: g.imageUrl } : {}),
    }));

  return appended.length ? ([...merged, ...appended] as unknown as T[]) : (merged as T[]);
}
