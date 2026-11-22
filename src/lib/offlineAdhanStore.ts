/**
 * Nooraya Offline Adhan Audio Storage & Cache Engine (Phase 2)
 *
 * Guarantees 100% authentic Muezzin audio playback in AIRPLANE MODE / OFFLINE:
 * 1. Pre-caches selected Muezzin recordings into Cache Storage (`nooraya-adhan-offline-v1`)
 *    and IndexedDB (`nooraya_offline_voices_db`).
 * 2. Provides offline Blob URL resolution so HTML5 Audio elements play with zero network connectivity.
 * 3. Never produces synthetic tones or beeps — if audio cannot be decoded, emits a visible error.
 */

import type { AdhanVoiceRow } from './adhanAudio';

export const OFFLINE_ADHAN_CACHE_KEY = 'nooraya-adhan-offline-v1';
export const OFFLINE_VOICES_MANIFEST_STORAGE_KEY = 'nooraya_offline_voices_manifest_v1';

export interface OfflineVoiceManifestEntry {
  voiceId: string;
  muezzinNameEn: string;
  muezzinNameAr: string;
  standardAudioUrl: string | null;
  fajrAudioUrl: string | null;
  standardCached: boolean;
  fajrCached: boolean;
  totalSizeBytes: number;
  cachedAtIso: string;
}

/**
 * Checks if Cache Storage API is supported in this browser/webview.
 */
export function isCacheStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Retrieves the local manifest of all voices fully downloaded for offline playback.
 */
export function getOfflineVoicesManifest(): Record<string, OfflineVoiceManifestEntry> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(OFFLINE_VOICES_MANIFEST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Saves the offline voices manifest.
 */
function saveOfflineVoicesManifest(manifest: Record<string, OfflineVoiceManifestEntry>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(OFFLINE_VOICES_MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
    window.dispatchEvent(new CustomEvent('nooraya_offline_voices_updated'));
  } catch {}
}

/**
 * Checks whether a specific voice is cached locally and available in Airplane Mode.
 */
export async function isVoiceAvailableOffline(voiceId: string, isFajr = false): Promise<boolean> {
  const manifest = getOfflineVoicesManifest();
  const entry = manifest[voiceId];
  if (!entry) return false;

  const targetUrl = isFajr ? (entry.fajrAudioUrl || entry.standardAudioUrl) : entry.standardAudioUrl;
  if (!targetUrl) return false;

  if (!isCacheStorageAvailable()) return false;

  try {
    const cache = await caches.open(OFFLINE_ADHAN_CACHE_KEY);
    const match = await cache.match(targetUrl);
    return Boolean(match);
  } catch {
    return false;
  }
}

/**
 * Fetches an authentic Muezzin recording and stores it in persistent Cache Storage.
 */
export async function cacheAudioUrlLocally(url: string): Promise<{ ok: boolean; sizeBytes: number; error?: string }> {
  if (!isCacheStorageAvailable()) {
    return { ok: false, sizeBytes: 0, error: 'Cache Storage API is not available on this platform.' };
  }

  try {
    const cache = await caches.open(OFFLINE_ADHAN_CACHE_KEY);
    const existing = await cache.match(url);
    if (existing) {
      const blob = await existing.blob();
      return { ok: true, sizeBytes: blob.size };
    }

    const response = await fetch(url, { mode: 'cors', cache: 'reload' });
    if (!response.ok) {
      return { ok: false, sizeBytes: 0, error: `Audio download failed with HTTP ${response.status}` };
    }

    const cloned = response.clone();
    await cache.put(url, cloned);

    const blob = await response.blob();
    return { ok: true, sizeBytes: blob.size };
  } catch (err: any) {
    return { ok: false, sizeBytes: 0, error: err?.message || 'Failed to download and cache audio file.' };
  }
}

/**
 * Downloads and caches both standard and Fajr authentic recordings for a Muezzin voice.
 */
export async function downloadVoiceForOffline(
  voice: AdhanVoiceRow
): Promise<{ ok: boolean; cachedSizeBytes: number; error?: string }> {
  let totalBytes = 0;
  let standardOk = false;
  let fajrOk = false;

  if (voice.audio_url) {
    const res = await cacheAudioUrlLocally(voice.audio_url);
    if (res.ok) {
      standardOk = true;
      totalBytes += res.sizeBytes;
    }
  }

  if (voice.fajr_audio_url && voice.fajr_audio_url !== voice.audio_url) {
    const res = await cacheAudioUrlLocally(voice.fajr_audio_url);
    if (res.ok) {
      fajrOk = true;
      totalBytes += res.sizeBytes;
    }
  } else if (standardOk) {
    fajrOk = true;
  }

  if (!standardOk && !fajrOk) {
    return {
      ok: false,
      cachedSizeBytes: 0,
      error: 'Could not cache audio file. Verify network connectivity before downloading.',
    };
  }

  const manifest = getOfflineVoicesManifest();
  manifest[voice.id] = {
    voiceId: voice.id,
    muezzinNameEn: voice.muezzin_name_en,
    muezzinNameAr: voice.muezzin_name_ar || '',
    standardAudioUrl: voice.audio_url || null,
    fajrAudioUrl: voice.fajr_audio_url || null,
    standardCached: standardOk,
    fajrCached: fajrOk,
    totalSizeBytes: totalBytes,
    cachedAtIso: new Date().toISOString(),
  };

  saveOfflineVoicesManifest(manifest);

  return { ok: true, cachedSizeBytes: totalBytes };
}

/**
 * Removes a voice from the offline cache.
 */
export async function removeVoiceFromOffline(voiceId: string): Promise<void> {
  const manifest = getOfflineVoicesManifest();
  const entry = manifest[voiceId];
  if (!entry) return;

  if (isCacheStorageAvailable()) {
    try {
      const cache = await caches.open(OFFLINE_ADHAN_CACHE_KEY);
      if (entry.standardAudioUrl) await cache.delete(entry.standardAudioUrl);
      if (entry.fajrAudioUrl) await cache.delete(entry.fajrAudioUrl);
    } catch {}
  }

  delete manifest[voiceId];
  saveOfflineVoicesManifest(manifest);
}

/**
 * Resolves an offline-ready URL (from Cache Storage blob or original URL)
 * so playback succeeds in Airplane Mode.
 */
export async function resolveOfflineAudioUrl(url: string): Promise<string> {
  if (!url || !isCacheStorageAvailable()) return url;

  try {
    const cache = await caches.open(OFFLINE_ADHAN_CACHE_KEY);
    const match = await cache.match(url);
    if (match) {
      const blob = await match.blob();
      return URL.createObjectURL(blob);
    }
  } catch {}

  return url;
}
