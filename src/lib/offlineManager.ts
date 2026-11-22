import localforage from 'localforage';
import type { Chapter, Reciter } from '../types';
import { candidateUrls } from './audio';
import type { AppUser } from './api';

export interface DownloadedSurah {
  surahId: number;
  surahName: string;
  surahNameArabic: string;
  reciterId: string;
  reciterName: string;
  reciterPhoto?: string;
  moshafId?: string;
  fileSizeBytes: number;
  cacheKey: string;
  storageKey: string;
  downloadedAt: number;
}

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'downloaded' | 'failed';

export interface ActiveDownloadState {
  surahId: number;
  reciterId: string;
  moshafId?: string;
  status: DownloadStatus;
  progressPercent: number;
  error?: string;
  abortController?: AbortController;
}

const CACHE_NAME = 'quran-offline-audio-v2';
const LEGACY_CACHE_NAME = 'quran-offline-audio-v1';

// Dedicated IndexedDB instances for offline storage
const metaStore = localforage.createInstance({
  name: 'NoorayaOffline',
  storeName: 'surah_metadata_v2',
});

const blobStore = localforage.createInstance({
  name: 'NoorayaOffline',
  storeName: 'audio_blobs_v2',
});

// Clean up legacy v1 cache if present on startup
if (typeof window !== 'undefined' && 'caches' in window) {
  try {
    caches.delete(LEGACY_CACHE_NAME).catch(() => {});
  } catch {}
}

/** Detect whether running as native wrapper or PWA/Web */
export function detectPlatform(): 'native' | 'pwa' {
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.Capacitor?.isNativePlatform?.() || w.cordova || w.ReactNativeWebView) {
      return 'native';
    }
  }
  return 'pwa';
}

/** Request persistent storage from browser so downloads are never evicted */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;
      return await navigator.storage.persist();
    }
  } catch (err) {
    console.warn('Storage persist request warning:', err);
  }
  return false;
}

/** Storage quota estimate */
export async function getStorageQuotaEstimate(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
  isPersistent: boolean;
}> {
  let usedBytes = 0;
  let quotaBytes = 0;
  let percentUsed = 0;
  let isPersistent = false;

  try {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.persisted) {
        isPersistent = await navigator.storage.persisted().catch(() => false);
      }
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        usedBytes = est.usage || 0;
        quotaBytes = est.quota || 0;
        if (quotaBytes > 0) {
          percentUsed = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));
        }
      }
    }
  } catch {}

  return { usedBytes, quotaBytes, percentUsed, isPersistent };
}

/** Check if user is currently on metered mobile data */
export function isMeteredConnection(): boolean {
  if (typeof navigator !== 'undefined') {
    const conn = (navigator as any).connection;
    if (conn) {
      return Boolean(conn.saveData || conn.type === 'cellular');
    }
  }
  return false;
}

/** Storage key: reciterId + moshafId + surahNumber */
export function getOfflineStorageKey(surahId: number, reciterId: string, moshafId?: string): string {
  const m = moshafId || 'default';
  return `${reciterId}_${m}_${surahId}`;
}

export function getOfflineCacheUrl(surahId: number, reciterId: string, moshafId?: string): string {
  const m = moshafId || 'default';
  return `/offline-audio/${reciterId}/${m}/${surahId}.mp3`;
}

/** Check if user's subscription is currently active (or admin) */
export function isPremiumActive(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.subscription_plan === 'lifetime') return true;
  if (!user.is_premium) return false;
  if (user.premium_expires_at) {
    const exp = new Date(user.premium_expires_at).getTime();
    if (!isNaN(exp) && exp < Date.now()) {
      return false; // Expired
    }
  }
  return true;
}

// ============================================================================
// CONCURRENT DOWNLOAD QUEUE (MAX 2 AT ONCE) & CANCELATION
// ============================================================================

const MAX_CONCURRENT_DOWNLOADS = 2;
const activeDownloadsMap = new Map<string, ActiveDownloadState>();
const downloadQueue: Array<() => Promise<void>> = [];
let runningCount = 0;

function notifyDownloadStateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('quran-downloads-changed'));
  }
}

function processQueue() {
  while (runningCount < MAX_CONCURRENT_DOWNLOADS && downloadQueue.length > 0) {
    const nextTask = downloadQueue.shift();
    if (nextTask) {
      runningCount++;
      nextTask().finally(() => {
        runningCount--;
        processQueue();
      });
    }
  }
}

/** Check download status for a surah + reciter */
export function getSurahDownloadStatus(
  surahId: number,
  reciterId: string,
  moshafId?: string
): ActiveDownloadState | null {
  const key = getOfflineStorageKey(surahId, reciterId, moshafId);
  return activeDownloadsMap.get(key) || null;
}

/** Check whether a surah has been saved to offline storage */
export async function isSurahDownloaded(
  surahId: number,
  reciterId: string,
  moshafId?: string
): Promise<boolean> {
  try {
    const key = getOfflineStorageKey(surahId, reciterId, moshafId);
    const meta = await metaStore.getItem<DownloadedSurah>(key);
    if (!meta) return false;

    // Check blob in IndexedDB
    const blob = await blobStore.getItem<Blob>(meta.cacheKey);
    if (blob instanceof Blob && blob.size > 10000) return true;

    // Check CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(meta.cacheKey);
      if (match) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** Cancel an ongoing download and clean up partial state */
export async function cancelDownload(surahId: number, reciterId: string, moshafId?: string): Promise<void> {
  const key = getOfflineStorageKey(surahId, reciterId, moshafId);
  const state = activeDownloadsMap.get(key);
  if (state?.abortController) {
    state.abortController.abort();
  }
  activeDownloadsMap.delete(key);

  const cacheKey = getOfflineCacheUrl(surahId, reciterId, moshafId);
  await blobStore.removeItem(cacheKey).catch(() => {});
  notifyDownloadStateChanged();
}

/** Download a Surah audio file with live progress, retry, cancel, and integrity check */
export async function downloadSurah(
  chapter: Chapter,
  reciter: Reciter,
  user: AppUser | null | undefined,
  options: {
    moshafId?: string;
    onProgress?: (percent: number) => void;
  } = {}
): Promise<void> {
  // 1. Premium entitlement check
  if (!isPremiumActive(user)) {
    throw new Error('UPGRADE_REQUIRED');
  }

  const { moshafId, onProgress } = options;
  const storageKey = getOfflineStorageKey(chapter.id, reciter.id, moshafId);
  const cacheKey = getOfflineCacheUrl(chapter.id, reciter.id, moshafId);

  // Request browser persistence if not already granted
  void requestPersistentStorage();

  // If already downloading, don't duplicate
  if (activeDownloadsMap.has(storageKey)) {
    const existing = activeDownloadsMap.get(storageKey);
    if (existing?.status === 'downloading' || existing?.status === 'queued') {
      return;
    }
  }

  const abortController = new AbortController();
  const state: ActiveDownloadState = {
    surahId: chapter.id,
    reciterId: reciter.id,
    moshafId,
    status: 'queued',
    progressPercent: 0,
    abortController,
  };
  activeDownloadsMap.set(storageKey, state);
  notifyDownloadStateChanged();

  return new Promise<void>((resolve, reject) => {
    const task = async () => {
      state.status = 'downloading';
      state.progressPercent = 1;
      notifyDownloadStateChanged();
      onProgress?.(1);

      const urls = candidateUrls(reciter, chapter.id);
      if (!urls || urls.length === 0) {
        state.status = 'failed';
        state.error = 'No streaming mirror available';
        notifyDownloadStateChanged();
        reject(new Error('No streaming URL available for this reciter.'));
        return;
      }

      let audioBlob: Blob | null = null;
      let totalBytes = 0;

      for (const url of urls) {
        if (abortController.signal.aborted) break;

        try {
          const response = await fetch(url, { signal: abortController.signal });
          if (!response.ok) continue;

          const contentLengthHeader = response.headers.get('content-length');
          totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

          if (!response.body) {
            audioBlob = await response.blob();
            break;
          }

          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let receivedBytes = 0;

          while (true) {
            if (abortController.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              receivedBytes += value.length;
              if (totalBytes > 0) {
                const pct = Math.min(Math.round((receivedBytes / totalBytes) * 100), 99);
                state.progressPercent = pct;
                onProgress?.(pct);
                notifyDownloadStateChanged();
              }
            }
          }

          if (abortController.signal.aborted) {
            state.status = 'idle';
            activeDownloadsMap.delete(storageKey);
            notifyDownloadStateChanged();
            reject(new Error('Download cancelled.'));
            return;
          }

          // Combine chunks into single MP3 Blob
          audioBlob = new Blob(chunks, { type: 'audio/mp3' });
          totalBytes = receivedBytes;
          break;
        } catch (fetchErr: any) {
          if (abortController.signal.aborted) {
            state.status = 'idle';
            activeDownloadsMap.delete(storageKey);
            notifyDownloadStateChanged();
            reject(new Error('Download cancelled.'));
            return;
          }
          console.warn(`Candidate fetch error for ${url}:`, fetchErr?.message || fetchErr);
        }
      }

      // Verification: must have a valid blob with reasonable size (> 20 KB)
      if (!audioBlob || audioBlob.size < 20000) {
        state.status = 'failed';
        state.error = 'Could not download complete audio file';
        notifyDownloadStateChanged();
        reject(new Error('Download failed. Please check internet connection and retry.'));
        return;
      }

      try {
        // 1. Cache Storage for ServiceWorker & range request support
        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            const cache = await caches.open(CACHE_NAME);
            const res = new Response(audioBlob, {
              headers: {
                'Content-Type': 'audio/mp3',
                'Content-Length': String(audioBlob.size),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000',
              },
            });
            await cache.put(cacheKey, res);
          } catch (cacheErr) {
            console.warn('CacheStorage put note:', cacheErr);
          }
        }

        // 2. Guaranteed IndexedDB persistent store
        await blobStore.setItem(cacheKey, audioBlob);

        // 3. Metadata store
        const meta: DownloadedSurah = {
          surahId: chapter.id,
          surahName: chapter.name_simple,
          surahNameArabic: chapter.name_arabic,
          reciterId: reciter.id,
          reciterName: reciter.name,
          reciterPhoto: reciter.imageUrl,
          moshafId,
          fileSizeBytes: audioBlob.size,
          cacheKey,
          storageKey,
          downloadedAt: Date.now(),
        };
        await metaStore.setItem(storageKey, meta);

        state.status = 'downloaded';
        state.progressPercent = 100;
        onProgress?.(100);
        notifyDownloadStateChanged();
        resolve();
      } catch (storageErr: any) {
        state.status = 'failed';
        state.error = storageErr?.message || 'Storage error';
        notifyDownloadStateChanged();
        reject(storageErr);
      }
    };

    downloadQueue.push(task);
    processQueue();
  });
}

/** Retrieve offline audio URL for a surah (returns Blob URL, fully seekable in HTML5 audio) */
export async function getOfflineAudioUrl(
  surahId: number,
  reciterId: string,
  user?: AppUser | null,
  moshafId?: string
): Promise<string | null> {
  // If user session is provided, enforce active premium
  if (user !== undefined && !isPremiumActive(user)) {
    return null;
  }

  const cacheKey = getOfflineCacheUrl(surahId, reciterId, moshafId);

  // 1. Check CacheStorage
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(cacheKey);
      if (match) {
        const blob = await match.blob();
        if (blob && blob.size > 10000) {
          return URL.createObjectURL(blob);
        }
      }
    } catch {}
  }

  // 2. Check IndexedDB Blob
  try {
    const blob = await blobStore.getItem<Blob>(cacheKey);
    if (blob instanceof Blob && blob.size > 10000) {
      return URL.createObjectURL(blob);
    }
  } catch {}

  // 3. Fallback to legacy key if user downloaded before version update
  try {
    const legacyKey = `/offline-audio/${reciterId}/${surahId}.mp3`;
    const blob = await blobStore.getItem<Blob>(legacyKey);
    if (blob instanceof Blob && blob.size > 10000) {
      return URL.createObjectURL(blob);
    }
  } catch {}

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

/** Get downloaded surahs grouped by reciter for download management view */
export async function getDownloadedSurahsGroupedByReciter(): Promise<
  Record<string, { reciterName: string; reciterPhoto?: string; surahs: DownloadedSurah[]; totalBytes: number }>
> {
  const list = await getDownloadedSurahs();
  const groups: Record<
    string,
    { reciterName: string; reciterPhoto?: string; surahs: DownloadedSurah[]; totalBytes: number }
  > = {};

  for (const item of list) {
    if (!groups[item.reciterId]) {
      groups[item.reciterId] = {
        reciterName: item.reciterName,
        reciterPhoto: item.reciterPhoto,
        surahs: [],
        totalBytes: 0,
      };
    }
    groups[item.reciterId].surahs.push(item);
    groups[item.reciterId].totalBytes += item.fileSizeBytes || 0;
  }

  return groups;
}

/** Delete a downloaded Surah to free up storage space */
export async function deleteDownloadedSurah(
  surahId: number,
  reciterId: string,
  moshafId?: string
): Promise<void> {
  const storageKey = getOfflineStorageKey(surahId, reciterId, moshafId);
  const cacheKey = getOfflineCacheUrl(surahId, reciterId, moshafId);

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(cacheKey);
    } catch {}
  }

  await blobStore.removeItem(cacheKey).catch(() => {});
  await metaStore.removeItem(storageKey).catch(() => {});
  activeDownloadsMap.delete(storageKey);
  notifyDownloadStateChanged();
}

/** Delete all downloads */
export async function deleteAllDownloads(): Promise<void> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      await caches.delete(CACHE_NAME);
    } catch {}
  }
  await blobStore.clear().catch(() => {});
  await metaStore.clear().catch(() => {});
  activeDownloadsMap.clear();
  notifyDownloadStateChanged();
}

/** Format file size */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = Math.round(bytes / 1024);
    return `${kb} KB`;
  }
  return `${mb.toFixed(1)} MB`;
}
