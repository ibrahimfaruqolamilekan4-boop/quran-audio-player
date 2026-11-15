import { useEffect, useState } from 'react';
import type { CustomVideo } from '../types';
import { isFeatureEnabled } from './featureFlags';
import type { VideoQualitySnapshot } from './prodDiagnostics';

/**
 * Runtime quality tier state — starts at 'hd' (1080p/720p) on capable devices
 * and steps down to 'sd' (480p) ONLY if Save-Data/2G/3G is active or if
 * `reportVideoPerformanceDegradation()` records high dropped frames or stalls.
 */
let degradedToSdUntilMs = 0;

export function reportVideoPerformanceDegradation(reason: string): void {
  // Step down for 3 minutes, then allow recovery step-up
  degradedToSdUntilMs = Date.now() + 3 * 60 * 1000;
  console.info(`[VideoQuality] Stepping down rendition to SD for 3m (${reason})`);
}

export function isVideoCurrentlyDegraded(): boolean {
  return Date.now() < degradedToSdUntilMs;
}

export function resetVideoQualityStepDown(): void {
  degradedToSdUntilMs = 0;
}

/**
 * Computes exact source vs. physical viewport upscale metrics for an active `<video>`
 * rendered with `object-fit: cover`.
 */
export function computeVideoQualityMetrics(
  videoEl: HTMLVideoElement,
  renditionLabel = 'auto'
): VideoQualitySnapshot | null {
  if (!videoEl) return null;
  const vw = videoEl.videoWidth || 1280;
  const vh = videoEl.videoHeight || 720;
  const cssW = Math.max(1, (typeof window !== 'undefined' ? window.innerWidth : 390) || 390);
  const cssH = Math.max(1, (typeof window !== 'undefined' ? window.innerHeight : 844) || 844);
  const dpr = Math.max(1, (typeof window !== 'undefined' ? window.devicePixelRatio : 3) || 1);
  const physW = Math.round(cssW * dpr);
  const physH = Math.round(cssH * dpr);

  // With `object-fit: cover`, the video is scaled uniformly by max(cssW/vw, cssH/vh)
  const videoAspect = vw / vh;
  const viewportAspect = cssW / cssH;

  let visibleSourceWidth = vw;
  let visibleSourceHeight = vh;

  if (videoAspect > viewportAspect) {
    // Video is wider than viewport (e.g., 16:9 video on 9:19.5 portrait phone):
    // Left and right edges are cropped; height fills viewport height.
    visibleSourceHeight = vh;
    visibleSourceWidth = vh * viewportAspect;
  } else {
    // Video is taller than viewport: top and bottom are cropped; width fills viewport width.
    visibleSourceWidth = vw;
    visibleSourceHeight = vw / viewportAspect;
  }

  const effectiveUpscaleFactor = Math.max(
    physW / Math.max(1, visibleSourceWidth),
    physH / Math.max(1, visibleSourceHeight)
  );

  let totalVideoFrames = 0;
  let droppedVideoFrames = 0;
  try {
    if (typeof videoEl.getVideoPlaybackQuality === 'function') {
      const q = videoEl.getVideoPlaybackQuality();
      totalVideoFrames = q.totalVideoFrames || 0;
      droppedVideoFrames = q.droppedVideoFrames || 0;
    }
  } catch {}

  const droppedFrameRatio =
    totalVideoFrames > 20 ? droppedVideoFrames / totalVideoFrames : 0;

  return {
    ts: Date.now(),
    src: videoEl.currentSrc || videoEl.src || '',
    renditionLabel,
    videoWidth: vw,
    videoHeight: vh,
    cssWidth: cssW,
    cssHeight: cssH,
    dpr,
    physicalViewportWidth: physW,
    physicalViewportHeight: physH,
    visibleSourceWidth,
    visibleSourceHeight,
    effectiveUpscaleFactor,
    totalVideoFrames,
    droppedVideoFrames,
    droppedFrameRatio,
  };
}

/**
 * Dynamically selects the optimal sharp video rendition for the client device (Phase 2B):
 * - Matches viewport orientation (Portrait 9:16 vs Landscape 16:9) when portrait renditions exist.
 * - Serves sharp 1080p / 720p on modern phones and desktops so effective upscale stays low.
 * - Steps down to 480p ONLY when:
 *   1. User enabled Data Saver (`saveData === true`) or is on `slow-2g` / `2g` / `3g`
 *   2. Device has very low RAM (`deviceMemory <= 2`)
 *   3. Measured dropped frames or stalls triggered `reportVideoPerformanceDegradation()`
 */
export function selectAdaptiveVideoUrl(video: CustomVideo): string {
  if (!video) return '';

  // Legacy kill-switch fallback if hdPortraitVideoEngine is disabled
  if (!isFeatureEnabled('hdPortraitVideoEngine')) {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && video.videoUrl480p) {
      return video.videoUrl480p;
    }
    return video.videoUrl720p || video.videoUrl || '';
  }

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
  const isSaveData = conn?.saveData === true;
  const isSlowNetwork =
    conn?.effectiveType === 'slow-2g' ||
    conn?.effectiveType === '2g' ||
    conn?.effectiveType === '3g';
  const isLowMemory = typeof nav?.deviceMemory === 'number' && nav.deviceMemory <= 2;
  const innerW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const innerH = typeof window !== 'undefined' ? window.innerHeight : 720;
  const isPortraitViewport = innerH > innerW;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2;
  const physicalLongEdge = Math.max(innerW, innerH) * dpr;

  const shouldUseSd =
    isSaveData || isSlowNetwork || isLowMemory || isVideoCurrentlyDegraded();

  const renditions = Array.isArray(video.renditions) ? video.renditions : [];

  if (shouldUseSd) {
    if (isPortraitViewport) {
      const p480 = renditions.find(
        (r) =>
          r.resolution === '480p-portrait' ||
          (r.width && r.height && r.height > r.width && r.width <= 540)
      )?.url;
      if (p480) return p480;
    }
    if (video.videoUrl480p) return video.videoUrl480p;
    const r480 = renditions.find((r) => r.resolution === '480p')?.url;
    if (r480) return r480;
  }

  // Portrait Phone / Tablet Viewport: prefer Portrait 1080p or Portrait 720p first
  if (isPortraitViewport) {
    if (physicalLongEdge >= 1600) {
      const p1080 = renditions.find(
        (r) =>
          r.resolution === '1080p-portrait' ||
          (r.width && r.height && r.height >= 1600 && r.height > r.width)
      )?.url;
      if (p1080) return p1080;
    }
    const p720 = renditions.find(
      (r) =>
        r.resolution === '720p-portrait' ||
        (r.width && r.height && r.height > r.width)
    )?.url;
    if (p720) return p720;
  }

  // High-DPR / Desktop: prefer 1080p, then 720p, then canonical videoUrl
  if (physicalLongEdge >= 1600) {
    const r1080 = renditions.find(
      (r) => r.resolution === '1080p' || (r.width && r.width >= 1920)
    )?.url;
    if (r1080) return r1080;
  }

  if (video.videoUrl720p) return video.videoUrl720p;
  const r720 = renditions.find((r) => r.resolution === '720p')?.url;
  if (r720) return r720;

  return video.videoUrl720p || video.videoUrl || '';
}

/**
 * Shared resolution of stored background-video references.
 */
export async function resolveBackgroundVideo(
  rawId: string | null | undefined,
  videoLibrary?: CustomVideo[]
): Promise<{ url: string; poster?: string; revoke: boolean; video?: CustomVideo } | null> {
  const id = (rawId || '').trim();
  if (!id) {
    const def =
      videoLibrary?.find(
        (v) => v.isDefault && (v.videoUrl || v.videoUrl720p || v.videoUrl480p)
      ) || videoLibrary?.[0];
    if (def) {
      return {
        url: selectAdaptiveVideoUrl(def),
        poster: def.posterUrl || def.poster_url,
        revoke: false,
        video: def,
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
    const matched = videoLibrary?.find(
      (v) => v.videoUrl === id || v.videoUrl720p === id || v.videoUrl480p === id
    );
    if (matched) {
      return {
        url: selectAdaptiveVideoUrl(matched),
        poster: matched.posterUrl || matched.poster_url,
        revoke: false,
        video: matched,
      };
    }
    return { url: id, revoke: false };
  }

  // Lookup in catalog by ID or name
  if (videoLibrary && videoLibrary.length > 0) {
    const match = videoLibrary.find(
      (v) => v.id === id || v.name === id || v.videoUrl === id
    );
    if (match) {
      return {
        url: selectAdaptiveVideoUrl(match),
        poster: match.posterUrl || match.poster_url,
        revoke: false,
        video: match,
      };
    }
    const fallback =
      videoLibrary.find(
        (v) => v.isDefault && (v.videoUrl || v.videoUrl720p || v.videoUrl480p)
      ) || videoLibrary[0];
    if (fallback) {
      return {
        url: selectAdaptiveVideoUrl(fallback),
        poster: fallback.posterUrl || fallback.poster_url,
        revoke: false,
        video: fallback,
      };
    }
  }

  return null;
}

/** Hook to resolve a background video URL reactively. */
export function useBackgroundVideoSrc(
  id: string | null | undefined,
  videoLibrary?: CustomVideo[]
): string | null {
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
