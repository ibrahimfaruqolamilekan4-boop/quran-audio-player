import { useEffect, useState } from 'react';
import localforage from 'localforage';

/**
 * Shared resolution of stored background-video references.
 *
 * An id may be a direct http/blob URL, or a localforage key holding a Blob,
 * optionally prefixed with 'customVideo_blob_' (SettingsView's storage
 * convention for user/admin-added ambient videos).
 *
 * This lives here because the page-wide ambient layer (QuranicPremiumBackground)
 * and the full-screen Now-Playing overlay must resolve the exact same id to the
 * exact same URL.
 */
export async function resolveBackgroundVideo(
  id: string
): Promise<{ url: string; revoke: boolean } | null> {
  if (id.startsWith('http') || id.startsWith('blob:')) {
    return { url: id, revoke: false };
  }
  let blob = await localforage.getItem<Blob>(id);
  if (!blob) {
    blob = await localforage.getItem<Blob>(`customVideo_blob_${id}`);
  }
  if (!blob) return null;
  return { url: URL.createObjectURL(blob), revoke: true };
}

/** Object URL for a stored background id, or null. Never revokes pass-through URLs. */
export function useBackgroundVideoSrc(id: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setSrc(null);
      return;
    }
    let active = true;
    let created: string | null = null;
    setSrc(null);
    resolveBackgroundVideo(id).then(resolved => {
      if (!resolved) return;
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
  }, [id]);

  return src;
}
