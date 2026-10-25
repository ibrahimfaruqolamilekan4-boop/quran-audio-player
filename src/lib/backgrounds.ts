import { useEffect, useState } from 'react';
import type { CustomVideo } from '../types';

/**
 * Shared resolution of stored background-video references.
 *
 * All background videos in Nooraya stream directly from Supabase Storage
 * or the cloud media catalog. Local device-only blobs and IndexedDB blobs
 * have been completely replaced with the cloud source of truth.
 */
export async function resolveBackgroundVideo(
  rawId: string | null | undefined,
  videoLibrary?: CustomVideo[]
): Promise<{ url: string; revoke: boolean } | null> {
  const id = (rawId || '').trim();
  if (!id) {
    const def = videoLibrary?.find((v) => v.isDefault && v.videoUrl) || videoLibrary?.[0];
    if (def?.videoUrl) {
      return { url: def.videoUrl, revoke: false };
    }
    return null;
  }

  // Direct URLs (Supabase storage, CDN, HTTP/HTTPS)
  if (
    id.startsWith('http://') ||
    id.startsWith('https://') ||
    id.startsWith('/api/media/')
  ) {
    return { url: id, revoke: false };
  }

  // Lookup in catalog by ID or name
  if (videoLibrary && videoLibrary.length > 0) {
    const match = videoLibrary.find((v) => v.id === id || v.name === id || v.videoUrl === id);
    if (match?.videoUrl) {
      return { url: match.videoUrl, revoke: false };
    }
    // Fallback to default active video
    const fallback = videoLibrary.find((v) => v.isDefault && v.videoUrl) || videoLibrary[0];
    if (fallback?.videoUrl) {
      return { url: fallback.videoUrl, revoke: false };
    }
  }

  return null;
}

/** Hook to resolve a background video URL reactively. */
export function useBackgroundVideoSrc(id: string | null | undefined, videoLibrary?: CustomVideo[]): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveBackgroundVideo(id, videoLibrary).then((res) => {
      if (!cancelled) setSrc(res?.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id, videoLibrary]);

  return src;
}
