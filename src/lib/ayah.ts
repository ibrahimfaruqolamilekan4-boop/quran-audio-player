// Auto-generated from api.quran.com/api/v4/chapters verses_count data
// (sum 6236; validated on generation). Do not hand-edit.
//
// Ayah-by-ayah recitation playback (design.md §4.1). Quran.com's public CDN
// (https://cdn.islamic.network) serves one MP3 per ayah, numbered 1..6236
// across the whole Quran, per reciter "voice" at specific bitrates. Only a
// subset of our curated sheikhs has CDN voices, and each voice is pinned to
// its working bitrate: a wrong bitrate/voice combination returns 403 (all
// pairs below were probed live and return 200).

export interface AyahVoice {
  voice: string;
  bitrate: 64 | 96 | 128 | 192;
}

/** Curated reciter id (src/lib/constants.ts) -> CDN voice + working bitrate. */
export const CDN_VOICES: Record<string, AyahVoice> = {
  afs: { voice: 'ar.alafasy', bitrate: 128 },
  sds: { voice: 'ar.abdurrahmaansudais', bitrate: 64 },
  shrm: { voice: 'ar.saoodshuraym', bitrate: 64 },
  maher: { voice: 'ar.mahermuaiqly', bitrate: 128 },
  hthfi: { voice: 'ar.hudhaify', bitrate: 128 },
  basit: { voice: 'ar.abdulbasitmurattal', bitrate: 64 },
};

/** Name fallback for cloud/admin-added reciters whose id isn't known. */
const NAME_VOICES: Record<string, AyahVoice> = {
  'mishary alafasy': CDN_VOICES.afs,
  'mishary rashid alafasy': CDN_VOICES.afs,
  'abdur rahman as-sudais': CDN_VOICES.sds,
  'abdurrahman sudais': CDN_VOICES.sds,
  'saood al-shuraim': CDN_VOICES.shrm,
  shuraim: CDN_VOICES.shrm,
  'maher al-muaiqly': CDN_VOICES.maher,
  maher: CDN_VOICES.maher,
  'ali alhuthaify': CDN_VOICES.hthfi,
  hudhaify: CDN_VOICES.hthfi,
  'abdul basit': CDN_VOICES.basit,
  'abdul basit abdulsamad': CDN_VOICES.basit,
  // Available on the CDN but not among the curated 13 today — kept so
  // admin-added global reciters with these names work immediately.
  'abdullah basfar': { voice: 'ar.abdullahbasfar', bitrate: 64 },
  'hani ar-rifai': { voice: 'ar.hanirifai', bitrate: 64 },
};

/** Number of ayahs in each of the 114 surahs (source note above). */
const SURAH_AYAH_COUNTS: number[] = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];

export function versesInSurah(surah: number): number {
  return SURAH_AYAH_COUNTS[surah - 1] ?? 0;
}

/** 1-based position of the first ayah of `surah` in the 6236-verse sequence. */
function firstGlobalAyah(surah: number): number {
  let n = 1;
  for (let s = 1; s < surah && s <= 114; s++) n += SURAH_AYAH_COUNTS[s - 1];
  return n;
}

export function globalAyahNumber(surah: number, ayah: number): number {
  const a = Math.min(Math.max(ayah, 1), Math.max(versesInSurah(surah), 1));
  return firstGlobalAyah(surah) + a - 1;
}

export function clampAyah(surah: number, ayah: number): number {
  const max = versesInSurah(surah);
  if (max === 0) return 1;
  return Math.min(Math.max(ayah, 1), max);
}

export function cdnVoiceFor(reciter: { id?: string; name?: string } | null | undefined): AyahVoice | null {
  if (!reciter) return null;
  if (reciter.id && CDN_VOICES[reciter.id]) return CDN_VOICES[reciter.id];
  if (reciter.name) {
    const key = reciter.name.toLowerCase().trim();
    if (NAME_VOICES[key]) return NAME_VOICES[key];
  }
  return null;
}

export function ayahModeAvailable(reciter: { id?: string; name?: string } | null | undefined): boolean {
  return cdnVoiceFor(reciter) !== null;
}

/** Stream URL for one ayah. Returns null when the reciter has no CDN voice. */
export function ayahStreamUrl(voice: AyahVoice, surah: number, ayah: number): string {
  const n = globalAyahNumber(surah, ayah);
  return `https://cdn.islamic.network/quran/audio/${voice.bitrate}/${voice.voice}/${n}.mp3`;
}
