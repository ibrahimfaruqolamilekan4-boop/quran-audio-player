import localforage from 'localforage';
import { mediaStore, processAndStoreFile, deleteStoredMedia } from './upload';

/**
 * Admin-uploaded recitations (prompt §3.2, design.md pass 5).
 *
 * Audio files are never proxied through the serverless API (the 4.5 MB body
 * cap on Vercel Hobby rules out a full surah). The file itself lives in the
 * localforage media store from lib/upload.ts alongside every other upload;
 * what lives here is only the metadata saying which reciter and surah a file
 * belongs to, so the player streams it before the public CDN mirrors.
 */
export interface StoredRecitation {
  id: string;
  mediaId: string;
  reciterId: string;
  reciterName: string;
  surah: number;
  surahName: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  durationSec: number | null;
  createdAt: number;
}

const LIST_KEY = 'quran_recitations';

export async function loadRecitations(): Promise<StoredRecitation[]> {
  try {
    const list = await localforage.getItem<StoredRecitation[]>(LIST_KEY);
    return Array.isArray(list) ? list.filter(r => r && r.id && r.mediaId) : [];
  } catch {
    return [];
  }
}

async function persist(list: StoredRecitation[]): Promise<void> {
  try {
    await localforage.setItem(LIST_KEY, list);
  } catch {
    // Out of storage: the recitation still plays this session, just not after reload.
  }
}

/** Seconds of an audio Blob, read from the element's metadata; null when unknown. */
export function probeAudioDuration(blobUrl: string): Promise<number | null> {
  return new Promise(resolve => {
    const audio = document.createElement('audio');
    let settled = false;
    const done = (value: number | null) => {
      if (settled) return;
      settled = true;
      audio.removeAttribute('src');
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(isFinite(audio.duration) ? Math.round(audio.duration) : null);
    audio.onerror = () => done(null);
    setTimeout(() => done(null), 4000); // never hang the upload on a stubborn codec
    audio.src = blobUrl;
  });
}

export async function uploadRecitation(
  file: File,
  meta: { reciterId: string; reciterName: string; surah: number; surahName: string },
  onProgress?: (percent: number) => void
): Promise<StoredRecitation> {
  const stored = await processAndStoreFile(file, 'audio', onProgress);
  const durationSec = await probeAudioDuration(stored.url);
  const entry: StoredRecitation = {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mediaId: stored.id,
    reciterId: meta.reciterId,
    reciterName: meta.reciterName,
    surah: meta.surah,
    surahName: meta.surahName,
    fileName: file.name,
    sizeBytes: stored.sizeBytes,
    mimeType: stored.mimeType,
    durationSec,
    createdAt: Date.now(),
  };
  await persist([entry, ...(await loadRecitations())]);
  return entry;
}

/** Swap the audio of an existing recitation, keeping every other field. */
export async function replaceRecitation(
  id: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<StoredRecitation | null> {
  const list = await loadRecitations();
  const existing = list.find(r => r.id === id);
  if (!existing) return null;
  const stored = await processAndStoreFile(file, 'audio', onProgress);
  const durationSec = await probeAudioDuration(stored.url);
  const updated: StoredRecitation = {
    ...existing,
    mediaId: stored.id,
    fileName: file.name,
    sizeBytes: stored.sizeBytes,
    mimeType: stored.mimeType,
    durationSec,
    createdAt: Date.now(),
  };
  await persist(list.map(r => (r.id === id ? updated : r)));
  deleteStoredMedia(existing.mediaId).catch(() => { /* old blob is orphaned at worst */ });
  return updated;
}

export async function deleteRecitation(id: string): Promise<void> {
  const list = await loadRecitations();
  const entry = list.find(r => r.id === id);
  await persist(list.filter(r => r.id !== id));
  if (entry) deleteStoredMedia(entry.mediaId).catch(() => {});
}

/** Fresh object URL for a stored recitation file (the caller owns revoking it). */
export async function recitationObjectUrl(entry: StoredRecitation): Promise<string | null> {
  try {
    const blob = await mediaStore.getItem<Blob>(entry.mediaId);
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export function findRecitation(
  list: StoredRecitation[],
  reciterId: string,
  surah: number
): StoredRecitation | null {
  return list.find(r => r.reciterId === reciterId && r.surah === surah) ?? null;
}

export function countRecitationsByReciter(list: StoredRecitation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of list) counts[r.reciterId] = (counts[r.reciterId] || 0) + 1;
  return counts;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
