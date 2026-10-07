import { useEffect, useState } from 'react';
import localforage from 'localforage';
import type { CustomVideo } from '../types';

/**
 * Shared resolution of stored background-video references.
 *
 * An id may be:
 * - A direct http/https/blob/data URL.
 * - An entry in localforage or global background video library.
 * - A localforage key holding a Blob (optionally prefixed with 'customVideo_blob_').
 */
// In-memory cache for resolved blob URLs so videos do not reload/skip on re-renders
const blobUrlCache = new Map<string, string>();

export async function resolveBackgroundVideo(
  id: string,
  videoLibrary?: CustomVideo[]
): Promise<{ url: string; revoke: boolean } | null> {
  if (!id) return null;
  if (id.startsWith('http://') || id.startsWith('https://') || id.startsWith('blob:') || id.startsWith('data:') || id.startsWith('/')) {
    return { url: id, revoke: false };
  }

  // Check if it matches a known video entry from library
  if (videoLibrary && videoLibrary.length > 0) {
    const match = videoLibrary.find(v => v.id === id);
    if (match && match.videoUrl) {
      return { url: match.videoUrl, revoke: false };
    }
  }

  // Check cache first
  if (blobUrlCache.has(id)) {
    return { url: blobUrlCache.get(id)!, revoke: false };
  }

  // Check localforage for Blob
  try {
    let blob = await localforage.getItem<Blob>(id);
    if (!blob) {
      blob = await localforage.getItem<Blob>(`customVideo_blob_${id}`);
    }
    if (blob) {
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(id, url);
      return { url, revoke: false };
    }
  } catch (err) {
    console.warn('Could not read localforage video blob:', err);
  }

  return null;
}

/** Object URL for a stored background id, or null. Never revokes pass-through URLs. */
export function useBackgroundVideoSrc(id: string | null | undefined, videoLibrary?: CustomVideo[]): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setSrc(null);
      return;
    }
    let active = true;
    let created: string | null = null;
    
    resolveBackgroundVideo(id, videoLibrary).then(resolved => {
      if (!resolved) {
        if (active) setSrc(null);
        return;
      }
      if (!active) {
        if (resolved.revoke) URL.revokeObjectURL(resolved.url);
        return;
      }
      if (resolved.revoke) created = resolved.url;
      setSrc(resolved.url);
    });

    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id, videoLibrary]);

  return src;
}
