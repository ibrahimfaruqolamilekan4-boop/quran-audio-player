import React, { useEffect, useRef } from 'react';
import { isFeatureEnabled } from '../../lib/featureFlags';

interface BackgroundLayerProps {
  isOpen: boolean;
  reduceMotion: boolean | null;
  videoSrc: string | null;
  posterUrl: string;
}

export function BackgroundLayer({
  isOpen,
  reduceMotion,
  videoSrc,
  posterUrl,
}: BackgroundLayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Immediately pause decorative overlay <video> whenever the app leaves foreground so mobile
  // browsers (iOS Safari / PWA / Android Chrome) never suspend or steal MediaSession from Quran <audio>.
  useEffect(() => {
    const syncOverlayVideo = () => {
      const vid = videoRef.current;
      if (!vid) return;
      if (document.hidden || !isOpen || reduceMotion) {
        try {
          vid.pause();
        } catch {}
      } else {
        try {
          vid.muted = true;
          vid.defaultMuted = true;
          vid.play().catch(() => {});
        } catch {}
      }
    };
    const pauseOnPageHide = () => {
      try {
        videoRef.current?.pause();
      } catch {}
    };

    syncOverlayVideo();
    document.addEventListener('visibilitychange', syncOverlayVideo);
    window.addEventListener('pagehide', pauseOnPageHide);
    return () => {
      document.removeEventListener('visibilitychange', syncOverlayVideo);
      window.removeEventListener('pagehide', pauseOnPageHide);
    };
  }, [isOpen, reduceMotion, videoSrc]);

  if (!isFeatureEnabled('opaqueBackdropStack')) {
    return (
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0 bg-[#06150F]">
      {/* Layer 1: Solid opaque base & Medina Emerald radial gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 22%, #0C2A20 0%, #06150F 70%, #040E0A 100%)',
        }}
      />

      {/* Layer 2A: High-resolution poster */}
      {posterUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
      )}

      {/* Layer 2B: Synced muted background video */}
      {!reduceMotion && videoSrc && (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          poster={posterUrl || undefined}
          autoPlay={!document.hidden}
          loop
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: 'translateZ(0)',
            willChange: 'opacity',
          }}
        />
      )}

      {/* Layer 3: Measured WCAG AA Contrast Scrim */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(6, 21, 15, 0.82) 0%, rgba(6, 21, 15, 0.46) 45%, rgba(6, 21, 15, 0.92) 100%)',
        }}
      />
    </div>
  );
}
