import type { Reciter } from '../types';
import { AUDIO_FORMATS } from './constants';

const FORMAT_KEY = 'quran_audio_format';
const SURAH_WIDTH = 3;

/** Extension that worked for this reciter before, so MP4 is not probed on every single play. */
export function rememberedFormat(reciterId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(FORMAT_KEY) || '{}');
    return typeof map[reciterId] === 'string' ? map[reciterId] : null;
  } catch {
    return null;
  }
}

export function rememberFormat(reciterId: string, ext: string) {
  if (!reciterId) return;
  try {
    const map = JSON.parse(localStorage.getItem(FORMAT_KEY) || '{}');
    if (map[reciterId] === ext) return;
    map[reciterId] = ext;
    localStorage.setItem(FORMAT_KEY, JSON.stringify(map));
  } catch {
    /* storage disabled — the probe simply runs again next time */
  }
}

/** True for a locally cached copy, which carries no extension to read a format from. */
export function isObjectUrl(url: string) {
  return url.startsWith('blob:');
}

export function extensionOf(url: string): string | null {
  const match = /\.([a-z0-9]+)(\?|$)/i.exec(url.split('?')[0]);
  return match ? match[1].toLowerCase() : null;
}

export function isSurahAvailable(reciter: Pick<Reciter, 'availableSurahs'> | null | undefined, chapterId: number): boolean {
  if (!reciter || !reciter.availableSurahs || !Array.isArray(reciter.availableSurahs)) return true;
  return reciter.availableSurahs.includes(chapterId);
}

/**
 * Ensures a server URL is safe, starts with https://, and ends with a trailing slash.
 */
export function normalizeServerUrl(url: string): string {
  let clean = url.trim().replace(/^http:\/\//i, 'https://');
  if (!clean.endsWith('/')) clean += '/';
  return clean;
}

/**
 * Every URL to try for one surah, best first.
 * Primary serverUrl first, followed by configured fallback mirrors.
 * MP3 is always the primary format to prevent failed probes and avoid breaking browser user gestures.
 */
export function candidateUrls(reciter: Pick<Reciter, 'id' | 'serverUrl' | 'formats' | 'fallbackServerUrls'>, chapterId: number): string[] {
  if (!reciter.serverUrl) return [];

  const surahStr = String(chapterId).padStart(SURAH_WIDTH, '0');
  const urls: string[] = [];

  // Primary URL
  const primaryBase = normalizeServerUrl(reciter.serverUrl);
  urls.push(`${primaryBase}${surahStr}.mp3`);

  // Fallback mirrors
  if (Array.isArray(reciter.fallbackServerUrls)) {
    for (const fb of reciter.fallbackServerUrls) {
      if (fb && fb.trim()) {
        const fbBase = normalizeServerUrl(fb);
        const fbUrl = `${fbBase}${surahStr}.mp3`;
        if (!urls.includes(fbUrl)) {
          urls.push(fbUrl);
        }
      }
    }
  }

  // If the server is an mp3quran CDN / server, provide alternate CDN mirror
  if (primaryBase.includes('cdn.mp3quran.net/audio/')) {
    // If it's cdn.mp3quran.net, the server mirror is already in fallbacks or can be fallback
  }

  return urls;
}
