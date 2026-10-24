import { useEffect, useState } from 'react';
import localforage from 'localforage';
import type { CustomVideo } from '../types';
import { mediaStore } from './upload';

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
  rawId: string | null | undefined,
  videoLibrary?: CustomVideo[]
): Promise<{ url: string; revoke: boolean } | null> {
  const id = (rawId || '').trim().replace(/^https?:\/\/localhost(:\d+)?/, '');
  if (!id) {
    // If no ID specified, pick default from videoLibrary if available
    const def = videoLibrary?.find(v => v.isDefault && v.videoUrl) || videoLibrary?.[0];
    if (def?.videoUrl) {
      return { url: def.videoUrl.replace(/^https?:\/\/localhost(:\d+)?/, ''), revoke: false };
    }
    return null;
  }

  // Direct URLs or relative paths (except local blob keys)
  if (
    id.startsWith('http://') ||
    id.startsWith('https://') ||
    id.startsWith('blob:') ||
    id.startsWith('data:') ||
    id.startsWith('/api/media/')
  ) {
    return { url: id, revoke: false };
  }

  // Check if it matches a known video entry from library with a portable URL
  if (videoLibrary && videoLibrary.length > 0) {
    const match = videoLibrary.find(v => v.id === id || v.name === id || v.videoUrl === id);
    if (
      match &&
      match.videoUrl &&
      match.videoUrl !== id &&
      (match.videoUrl.startsWith('/api/media/') ||
        match.videoUrl.startsWith('http://') ||
        match.videoUrl.startsWith('https://'))
    ) {
      return { url: match.videoUrl.replace(/^https?:\/\/localhost(:\d+)?/, ''), revoke: false };
    }
  }

  // Check in-memory blob cache first
  if (blobUrlCache.has(id)) {
    return { url: blobUrlCache.get(id)!, revoke: false };
  }

  // Check localforage & mediaStore for Blob (saved locally on this device)
  try {
    let blob = await localforage.getItem<Blob>(id);
    if (!blob) {
      blob = await localforage.getItem<Blob>(`customVideo_blob_${id}`);
    }
    if (!blob) {
      const storedItem = await mediaStore.getItem<any>(id);
      if (storedItem?.blob instanceof Blob) {
        blob = storedItem.blob;
      }
    }
    if (blob instanceof Blob) {
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(id, url);
      return { url, revoke: false };
    }
  } catch (err) {
    console.warn('Could not read localforage video blob:', err);
  }

  // If this device had an unresolvable local ID, prefer the admin's global default video from videoLibrary
  if (videoLibrary && videoLibrary.length > 0) {
    const globalDef =
      videoLibrary.find(v => v.isDefault && v.videoUrl && (v.videoUrl.startsWith('/api/media/') || v.videoUrl.startsWith('http'))) ||
      videoLibrary.find(v => v.videoUrl && (v.videoUrl.startsWith('/api/media/') || v.videoUrl.startsWith('http')));
    if (globalDef?.videoUrl) {
      return { url: globalDef.videoUrl.replace(/^https?:\/\/localhost(:\d+)?/, ''), revoke: false };
    }
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
