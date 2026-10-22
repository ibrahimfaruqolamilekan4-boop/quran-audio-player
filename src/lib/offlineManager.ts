import localforage from 'localforage';
import type { Chapter, Reciter } from '../types';
import { candidateUrls } from './audio';

export interface DownloadedSurah {
  surahId: number;
  surahName: string;
  surahNameArabic: string;
  reciterId: string;
  reciterName: string;
  reciterPhoto?: string;
  durationSeconds?: number;
  fileSizeBytes: number;
  cacheKey: string;
  downloadedAt: number;
}

const CACHE_NAME = 'quran-offline-audio-v1';

// Dedicated IndexedDB store for offline metadata and fallback audio blobs
const metaStore = localforage.createInstance({
  name: 'NoorayaOffline',
  storeName: 'surah_metadata',
});

const blobStore = localforage.createInstance({
  name: 'NoorayaOffline',
  storeName: 'audio_blobs',
});

export function getOfflineCacheKey(surahId: number, reciterId: string): string {
  return `/offline-audio/${reciterId}/${surahId}.mp3`;
}

/** Check whether a surah has been downloaded for offline playback */
export async function isSurahDownloaded(surahId: number, reciterId: string): Promise<boolean> {
  try {
    const key = `${reciterId}_${surahId}`;
    const meta = await metaStore.getItem<DownloadedSurah>(key);
    if (!meta) return false;

    // Check if binary is present in CacheStorage or IndexedDB
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(meta.cacheKey);
      if (match) return true;
    }

    const blob = await blobStore.getItem<Blob>(meta.cacheKey);
    return Boolean(blob);
  } catch {
    return false;
  }
}

/** Download a Surah audio file with live progress percentage (0-100%) */
export async function downloadSurah(
  chapter: Chapter,
  reciter: Reciter,
  onProgress?: (percent: number) => void
): Promise<void> {
  const urls = candidateUrls(reciter, chapter.id);
  if (!urls || urls.length === 0) {
    throw new Error('No audio streaming URL available for this reciter.');
  }

  const cacheKey = getOfflineCacheKey(chapter.id, reciter.id);
  let audioBlob: Blob | null = null;
  let totalBytes = 0;

  // Try candidate URLs in order until one responds
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const contentLengthHeader = response.headers.get('content-length');
      totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      if (!response.body) {
        audioBlob = await response.blob();
        onProgress?.(100);
        break;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (totalBytes > 0 && onProgress) {
            const pct = Math.min(Math.round((receivedBytes / totalBytes) * 100), 99);
            onProgress(pct);
          }
        }
      }

      // Combine chunks into single Blob
      audioBlob = new Blob(chunks, { type: 'audio/mp3' });
      totalBytes = receivedBytes;
      onProgress?.(100);
      break;
    } catch (err) {
      console.warn(`Download attempt failed for ${url}:`, err);
    }
  }

  if (!audioBlob) {
    throw new Error('Could not download surah audio. Please check your internet connection.');
  }

  // 1. Save to CacheStorage for ServiceWorker / PWA caching
  if ('caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = new Response(audioBlob, {
        headers: {
          'Content-Type': 'audio/mp3',
          'Content-Length': String(totalBytes),
          'Cache-Control': 'public, max-age=31536000',
        },
      });
      await cache.put(cacheKey, response);
    } catch (cacheErr) {
      console.warn('CacheStorage put error:', cacheErr);
    }
  }

  // 2. Guaranteed fallback in IndexedDB
  await blobStore.setItem(cacheKey, audioBlob);

  // 3. Store Surah metadata
  const meta: DownloadedSurah = {
    surahId: chapter.id,
    surahName: chapter.name_simple,
    surahNameArabic: chapter.name_arabic,
    reciterId: reciter.id,
    reciterName: reciter.name,
    reciterPhoto: reciter.imageUrl,
    fileSizeBytes: totalBytes,
    cacheKey,
    downloadedAt: Date.now(),
  };

  await metaStore.setItem(`${reciter.id}_${chapter.id}`, meta);
}

/** Retrieve offline playback URL for zero-internet / Airplane Mode listening */
export async function getOfflineAudioUrl(surahId: number, reciterId: string): Promise<string | null> {
  const cacheKey = getOfflineCacheKey(surahId, reciterId);

  // Check CacheStorage first
  if ('caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(cacheKey);
      if (match) {
        const blob = await match.blob();
        return URL.createObjectURL(blob);
      }
    } catch (e) {
      console.warn('Cache match error:', e);
    }
  }

  // Check IndexedDB
  try {
    const blob = await blobStore.getItem<Blob>(cacheKey);
    if (blob instanceof Blob) {
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn('IndexedDB blob retrieval error:', e);
  }

  return null;
}

/** Get list of all downloaded Surahs */
export async function getDownloadedSurahs(): Promise<DownloadedSurah[]> {
  const list: DownloadedSurah[] = [];
  try {
    await metaStore.iterate<DownloadedSurah, void>((value) => {
      if (value && typeof value === 'object' && value.surahId) {
        list.push(value);
      }
    });
    list.sort((a, b) => a.surahId - b.surahId);
  } catch (err) {
    console.warn('Failed to load downloaded surahs list:', err);
  }
  return list;
}

/** Delete a downloaded Surah to free up storage space */
export async function deleteDownloadedSurah(surahId: number, reciterId: string): Promise<void> {
  const cacheKey = getOfflineCacheKey(surahId, reciterId);

  if ('caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(cacheKey);
    } catch {}
  }

  await blobStore.removeItem(cacheKey);
  await metaStore.removeItem(`${reciterId}_${surahId}`);
}

/** Format file size in KB / MB */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = Math.round(bytes / 1024);
    return `${kb} KB`;
  }
  return `${mb.toFixed(1)} MB`;
}
