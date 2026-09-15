/**
 * Per-ayah CDN audio (islamic.network / Quran.com media server).
 *
 * The mp3quran mirrors we use for full-surah playback publish one file per
 * surah only — they cannot address individual ayahs. Quran.com's CDN
 * (`cdn.islamic.network`) does publish ayah-level audio, identified by the
 * global ayah index (1..6236, Al-Fatihah is 1-7, Al-Baqarah starts at 8).
 *
 * NOTE: a voice only resolves at its exact bitrate — e.g.
 * /audio/128/ar.alafasy/ returns 200 but /audio/64/ar.alafasy/ returns 403.
 * Each entry below was verified live (HTTP 200) against this CDN on 2026-06-16.
 */

export interface AyahVoice {
  /** islamic.network identifier, e.g. "ar.alafasy" */
  voice: string;
  /** the one bitrate this identifier serves */
  bitrate: 64 | 96 | 128 | 192;
}

/**
 * Our curated sheikh ids → ayah-CDN voice. Only sheikhs listed here can
 * stream per-ayah; everyone else keeps full-surah playback (ayah mode UI
 * is disabled for them).
 */
export const CDN_VOICES: Record<string, AyahVoice> = {
  afs: { voice: 'ar.alafasy', bitrate: 128 },
  sds: { voice: 'ar.abdurrahmaansudais', bitrate: 64 },
  shrm: { voice: 'ar.saoodshuraym', bitrate: 64 },
  maher: { voice: 'ar.mahermuaiqly', bitrate: 128 },
  hthfi: { voice: 'ar.hudhaify', bitrate: 128 },
  basit: { voice: 'ar.abdulbasitmurattal', bitrate: 64 },
};

/**
 * Fallback lookup by (lowercase) display name so admin-added global
 * reciters of these same voices also get ayah mode. Deliberately excludes
 * names with no verified CDN presence (Baleela, Al-Qasim, Ad-Dosari…).
 */
const VOICES_BY_NAME: Record<string, AyahVoice> = {
  'mishary alafasy': CDN_VOICES.afs,
  'mishary rashid alafasy': CDN_VOICES.afs,
  'mishary rashid al-afasy': CDN_VOICES.afs,
  'abdurrahman sudais': CDN_VOICES.sds,
  'abdurrahmaan as-sudais': CDN_VOICES.sds,
  'saood shuraim': CDN_VOICES.shrm,
  'saood al-shuraim': CDN_VOICES.shrm,
  'maher al-muaiqly': CDN_VOICES.maher,
  'maher muaiqly': CDN_VOICES.maher,
  'ali alhuthaifi': CDN_VOICES.hthfi,
  'ali hudhaify': CDN_VOICES.hthfi,
  'abdul basit': CDN_VOICES.basit,
  'abdul basit abdulsamad': CDN_VOICES.basit,
};

/** Verses per surah (1-indexed), from the Quran.com chapters API (sum = 6236). */
const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45,
  83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 19, 5, 8, 7, 3, 9, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export function versesInSurah(surah: number): number {
  return SURAH_AYAH_COUNTS[surah - 1] ?? 0;
}

export function clampAyah(surah: number, ayah: number): number {
  const max = versesInSurah(surah);
  return Math.min(Math.max(1, ayah), max || ayah);
}

/** Global ayah number (1..6236) for a surah/ayah pair. */
export function globalAyahNumber(surah: number, ayah: number): number {
  let n = clampAyah(surah, ayah);
  for (let s = 1; s < surah && s <= 114; s++) n += versesInSurah(s);
  return n;
}

export function cdnVoiceFor(
  reciter: { id?: string; name?: string } | null
): AyahVoice | null {
  if (!reciter) return null;
  if (reciter.id && CDN_VOICES[reciter.id]) return CDN_VOICES[reciter.id];
  const key = (reciter.name || '').toLowerCase().trim();
  return VOICES_BY_NAME[key] ?? null;
}

export function ayahModeAvailable(
  reciter: { id?: string; name?: string } | null
): boolean {
  return cdnVoiceFor(reciter) !== null;
}

export function ayahStreamUrl(
  voice: AyahVoice,
  surah: number,
  ayah: number
): string {
  return `https://cdn.islamic.network/quran/audio/${voice.bitrate}/${voice.voice}/${globalAyahNumber(surah, ayah)}.mp3`;
}
