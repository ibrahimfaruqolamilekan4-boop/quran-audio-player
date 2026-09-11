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

/**
 * Every URL to try for one surah, best first. MP4 leads (see AUDIO_FORMATS); mirrors that only
 * publish MP3 answer 404 and the player falls through to the next candidate on its own.
 */
export function candidateUrls(reciter: Pick<Reciter, 'id' | 'serverUrl' | 'formats'>, chapterId: number): string[] {
  const base = reciter.serverUrl.endsWith('/') ? reciter.serverUrl : `${reciter.serverUrl}/`;
  const preferred = reciter.formats?.length ? reciter.formats : AUDIO_FORMATS;
  const remembered = rememberedFormat(reciter.id);
  const order = remembered ? [remembered, ...preferred.filter(f => f !== remembered)] : preferred;
  return order.map(ext => `${base}${String(chapterId).padStart(SURAH_WIDTH, '0')}.${ext}`);
}
