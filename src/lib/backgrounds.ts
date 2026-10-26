import { useEffect, useState } from 'react';
import type { CustomVideo } from '../types';

/**
 * Dynamically selects the optimal video rendition for the client device:
 * - Mobile phones & tablets (< 768px): 480p rendition (saves ~75% data & battery)
 * - Cellular connections with Save-Data / 2G / 3G: 480p rendition
 * - Desktop / fast broadband: 720p rendition
 * - Safe fallback to videoUrl if renditions are unpopulated
 */
export function selectAdaptiveVideoUrl(video: CustomVideo): string {
  if (typeof window !== 'undefined') {
    const nav = navigator as any;
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    const isSaveData = conn?.saveData === true;
    const isSlow = conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g' || conn?.effectiveType === '3g';
    const isMobile = window.innerWidth < 768;

    // Mobile / Slow connection: choose 480p
    if (isSaveData || isSlow || isMobile) {
      if (video.videoUrl480p) return video.videoUrl480p;
      const r480 = video.renditions?.find((r) => r.resolution === '480p')?.url;
      if (r480) return r480;
    }

    // Desktop / Fast connection: choose 720p
    if (video.videoUrl720p) return video.videoUrl720p;
    const r720 = video.renditions?.find((r) => r.resolution === '720p')?.url;
    if (r720) return r720;
  }

  return video.videoUrl || '';
}

/**
 * Shared resolution of stored background-video references.
 *
 * All background videos in Nooraya stream directly from Supabase Storage
 * or the cloud media catalog with phone-adaptive rendition selection.
 */
export async function resolveBackgroundVideo(
  rawId: string | null | undefined,
  videoLibrary?: CustomVideo[]
): Promise<{ url: string; poster?: string; revoke: boolean } | null> {
  const id = (rawId || '').trim();
  if (!id) {
    const def = videoLibrary?.find((v) => v.isDefault && (v.videoUrl || v.videoUrl720p || v.videoUrl480p)) || videoLibrary?.[0];
    if (def) {
      return {
        url: selectAdaptiveVideoUrl(def),
        poster: def.posterUrl || def.poster_url,
        revoke: false,
      };
    }
    return null;
  }

  // Direct URLs (Supabase storage, CDN, HTTP/HTTPS)
  if (
    id.startsWith('http://') ||
    id.startsWith('https://') ||
    id.startsWith('/api/media/')
  ) {
    // If the direct URL matches an item in videoLibrary, adaptively pick rendition
    const matched = videoLibrary?.find((v) => v.videoUrl === id || v.videoUrl720p === id || v.videoUrl480p === id);
    if (matched) {
      return {
        url: selectAdaptiveVideoUrl(matched),
        poster: matched.posterUrl || matched.poster_url,
        revoke: false,
      };
    }
    return { url: id, revoke: false };
  }

  // Lookup in catalog by ID or name
  if (videoLibrary && videoLibrary.length > 0) {
    const match = videoLibrary.find((v) => v.id === id || v.name === id || v.videoUrl === id);
    if (match) {
      return {
        url: selectAdaptiveVideoUrl(match),
        poster: match.posterUrl || match.poster_url,
        revoke: false,
      };
    }
    // Fallback to default active video
    const fallback = videoLibrary.find((v) => v.isDefault && (v.videoUrl || v.videoUrl720p || v.videoUrl480p)) || videoLibrary[0];
    if (fallback) {
      return {
        url: selectAdaptiveVideoUrl(fallback),
        poster: fallback.posterUrl || fallback.poster_url,
        revoke: false,
      };
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
