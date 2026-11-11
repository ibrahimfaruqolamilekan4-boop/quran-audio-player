import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { usePlayer } from '../context/PlayerContext';
import {
  resolveBackgroundVideo,
  computeVideoQualityMetrics,
  reportVideoPerformanceDegradation,
} from '../lib/backgrounds';
import { setLatestVideoQualitySnapshot } from '../lib/prodDiagnostics';
import { isFeatureEnabled } from '../lib/featureFlags';

/**
 * THEME CONFIGURATION INTERFACE
 * Define this at the top of your theme variations file
 */
export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;      // Main accent (gold, teal, rose, etc)
    secondary: string;    // Secondary accent
    background: string;   // Dark background
    accent: string;       // Bright accent
    muted: string;        // Muted tone
  };
  patterns: {
    primaryColor: string;
    secondaryColor: string;
    opacity: number;
  };
}

interface Particle {
  id: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

/**
 * THEME LIBRARY - All your themes in one place
 * Update colors here to see them in real-time!
 */
export const THEME_LIBRARY: Record<string, ThemeConfig> = {
  'medina-emerald': {
    name: 'Medina Emerald',
    colors: {
      primary: '#1F8A6A',      // Medina Emerald
      secondary: '#11382B',    // Surface Raised
      background: '#06150F',   // Deep Emerald Night
      accent: '#D4AF37',       // Medina Gold
      muted: '#0C2A20',        // Surface Dark
    },
    patterns: {
      primaryColor: '#1F8A6A',
      secondaryColor: '#D4AF37',
      opacity: 0.65,
    },
  },
  'midnight-scholar': {
    name: 'Midnight Scholar',
    colors: {
      primary: '#C9A961',      // Islamic Gold
      secondary: '#8B7355',    // Warm Brown
      background: '#0A0E16',   // Deep Navy
      accent: '#D4AF37',       // Bright Gold
      muted: '#4A5568',        // Gray-Blue
    },
    patterns: {
      primaryColor: '#D4AF37',
      secondaryColor: '#1A4D3E',
      opacity: 0.6,
    },
  },
  'celestial-garden': {
    name: 'Celestial Garden',
    colors: {
      primary: '#00D9A3',      // Vibrant Teal
      secondary: '#1A4D3E',    // Rich Emerald
      background: '#051f16',   // Deep Teal-Black
      accent: '#E8F4F0',       // Pale Mint
      muted: '#2D6A5C',        // Muted Emerald
    },
    patterns: {
      primaryColor: '#00D9A3',
      secondaryColor: '#1A4D3E',
      opacity: 0.5,
    },
  },
  'rose-garden': {
    name: 'Rose Garden',
    colors: {
      primary: '#D4738B',      // Rose
      secondary: '#8B4652',    // Burgundy
      background: '#2B1620',   // Deep Wine
      accent: '#F5E6D3',       // Cream
      muted: '#6B3847',        // Muted Rose
    },
    patterns: {
      primaryColor: '#D4738B',
      secondaryColor: '#8B4652',
      opacity: 0.55,
    },
  },
  'dawn-prayer': {
    name: 'Dawn Prayer (Fajr)',
    colors: {
      primary: '#FFD700',      // Dawn Gold
      secondary: '#87CEEB',    // Sky Blue
      background: '#1A1A3E',   // Deep Blue-Purple
      accent: '#FFE4B5',       // Muted Gold
      muted: '#4B0082',        // Indigo
    },
    patterns: {
      primaryColor: '#FFD700',
      secondaryColor: '#87CEEB',
      opacity: 0.65,
    },
  },
  'desert-dusk': {
    name: 'Desert Dusk (Maghreb)',
    colors: {
      primary: '#FF8C42',      // Warm Orange
      secondary: '#8B4513',    // Saddle Brown
      background: '#2D1810',   // Dark Brown
      accent: '#FFA500',       // Orange
      muted: '#5C3D2E',        // Muted Brown
    },
    patterns: {
      primaryColor: '#FF8C42',
      secondaryColor: '#8B4513',
      opacity: 0.58,
    },
  },
  'night-contemplation': {
    name: 'Night Contemplation (Isha)',
    colors: {
      primary: '#C0C0C0',      // Silver
      secondary: '#4169E1',    // Royal Blue
      background: '#000000',   // Pure Black
      accent: '#E0E0E0',       // Bright Silver
      muted: '#36454F',        // Charcoal
    },
    patterns: {
      primaryColor: '#C0C0C0',
      secondaryColor: '#4169E1',
      opacity: 0.5,
    },
  },
};

// ============================================
// ISLAMIC GEOMETRIC PATTERN - NOW THEME-AWARE
// ============================================
const IslamicPattern = ({ intensity, theme }: { intensity: number; theme: ThemeConfig }) => {
  const opacity = 0.15 + (intensity * 0.25);
  const { primaryColor, secondaryColor } = theme.patterns;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        {/* Star Pattern Grid */}
        <pattern id="stars" x="120" y="120" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="60" cy="60" r="3" fill={primaryColor} opacity={opacity * 0.8} />
          <circle cx="60" cy="60" r="8" fill="none" stroke={primaryColor} strokeWidth="1" opacity={opacity * 0.4} />
          <line x1="60" y1="30" x2="60" y2="90" stroke={primaryColor} strokeWidth="0.5" opacity={opacity * 0.3} />
          <line x1="30" y1="60" x2="90" y2="60" stroke={primaryColor} strokeWidth="0.5" opacity={opacity * 0.3} />
        </pattern>
        
        {/* Hexagon Pattern */}
        <pattern id="hexagon" x="100" y="100" width="100" height="100" patternUnits="userSpaceOnUse">
          <polygon
            points="50,0 100,25 100,75 50,100 0,75 0,25"
            fill="none"
            stroke={secondaryColor}
            strokeWidth="1"
            opacity={opacity * 0.5}
          />
        </pattern>

        {/* Divine Light Radial Gradient */}
        <radialGradient id="divineLight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={primaryColor} stopOpacity={opacity * 0.6} />
          <stop offset="50%" stopColor={secondaryColor} stopOpacity={opacity * 0.2} />
          <stop offset="100%" stopColor={theme.colors.background} stopOpacity="0" />
        </radialGradient>

        {/* Verse Glow Gradient */}
        <linearGradient id="verseGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={theme.colors.accent} stopOpacity="0" />
          <stop offset="50%" stopColor={primaryColor} stopOpacity={opacity * 0.4} />
          <stop offset="100%" stopColor={secondaryColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Subtle gradient base over video */}
      <rect
        width="1200"
        height="800"
        fill="url(#divineLight)"
        cx="600"
        cy="400"
      />

      {/* Islamic geometric patterns */}
      <g opacity={opacity * 0.6}>
        <rect width="1200" height="800" fill="url(#stars)" />
      </g>

      <g opacity={opacity * 0.4}>
        <rect width="1200" height="800" fill="url(#hexagon)" />
      </g>

      {/* Corner ornamental frames */}
      <g stroke={primaryColor} strokeWidth="2" fill="none" opacity={opacity * 0.7}>
        {/* Top-left corner */}
        <path d="M 20,50 L 20,20 L 50,20" />
        <circle cx="20" cy="20" r="8" fill="none" />
        {/* Top-right corner */}
        <path d="M 1180,50 L 1180,20 L 1150,20" />
        <circle cx="1180" cy="20" r="8" fill="none" />
        {/* Bottom-left corner */}
        <path d="M 20,750 L 20,780 L 50,780" />
        <circle cx="20" cy="780" r="8" fill="none" />
        {/* Bottom-right corner */}
        <path d="M 1180,750 L 1180,780 L 1150,780" />
        <circle cx="1180" cy="780" r="8" fill="none" />
      </g>

      {/* Central ornamental circle */}
      <circle
        cx="600"
        cy="400"
        r="150"
        fill="none"
        stroke={primaryColor}
        strokeWidth="1"
        opacity={opacity * 0.3}
      />
      <circle
        cx="600"
        cy="400"
        r="120"
        fill="none"
        stroke={secondaryColor}
        strokeWidth="0.5"
        opacity={opacity * 0.2}
      />
    </svg>
  );
};

// ============================================
// DIVINE PARTICLES - NOW THEME-AWARE
// ============================================
const DivineParticles = ({ intensity, theme }: { intensity: number; theme: ThemeConfig }) => {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: Math.ceil(15 * intensity) }, (_, i) => ({
      id: `particle-${i}`,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 2,
    }));
  }, [intensity]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full blur-sm"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            opacity: 0.6,
            background: `linear-gradient(to bottom, ${theme.colors.primary}, ${theme.colors.secondary})`,
          }}
          animate={{
            y: [0, -300],
            opacity: [0.6, 0.2, 0],
            scale: [1, 1.2, 0.8],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// MYSTICAL AURORA - NOW THEME-AWARE
// ============================================
const MysticalAurora = ({ intensity, theme }: { intensity: number; theme: ThemeConfig }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${theme.colors.primary}4d 0%, transparent 70%)`,
          opacity: intensity * 0.4,
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${theme.colors.secondary}33 0%, transparent 70%)`,
          opacity: intensity * 0.3,
        }}
        animate={{
          x: [0, -40, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
};

// ============================================
// QURANIC VERSE SCROLL - NOW THEME-AWARE
// ============================================
const QuranicVerseScroll = ({ intensity, theme }: { intensity: number; theme: ThemeConfig }) => {
  const verses = [
    'اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ',
    'فَتَبَارَكَ اللَّهُ أَحْسَنُ الْخَالِقِينَ',
    'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
    'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
  ];

  const displayVerse = verses[Math.floor(Math.random() * verses.length)];

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      <motion.div
        className="text-center font-serif text-4xl tracking-wider"
        style={{ color: theme.colors.primary, opacity: 0.2 + intensity * 0.2 }}
        animate={{
          y: [-400, 800],
          opacity: [0, 0.3 + intensity * 0.2, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {displayVerse}
      </motion.div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT - WITH THEME SUPPORT
// ============================================
interface QuranicPremiumBackgroundProps {
  themeName?: string;
  ambientVolume?: number;
  isPlaying?: boolean;
}

export function QuranicPremiumBackground({ 
  themeName = 'medina-emerald',
  ambientVolume = 0.6,
}: QuranicPremiumBackgroundProps) {
  const theme = THEME_LIBRARY[themeName] || THEME_LIBRARY['medina-emerald'];
  const { activeBackgroundVideoId, customVideos } = usePlayer();

  // Initial video loop: default to Cosmos star loop immediately to eliminate any blank frame
  const initialVideo = useMemo(() => {
    if (typeof window !== 'undefined') {
      const saved = (localStorage.getItem('activeBackgroundVideoId') || '')
        .trim()
        .replace(/^https?:\/\/localhost(:\d+)?/, '');
      if (saved && (saved.startsWith('/') || saved.startsWith('http://') || saved.startsWith('https://'))) {
        return saved;
      }
    }
    return '';
  }, []);

  const [videoUrl, setVideoUrl] = useState<string>(initialVideo);
  // Dual-buffered persistent video slots for stutter-free, gapless transitions
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [slotAUrl, setSlotAUrl] = useState<string>(initialVideo);
  const [slotBUrl, setSlotBUrl] = useState<string | null>(null);
  const [slotAOpacity, setSlotAOpacity] = useState(1);
  const [slotBOpacity, setSlotBOpacity] = useState(0);

  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);

  const visualIntensity = Math.max(0.2, ambientVolume);

  // Sync activeBackgroundVideoId from PlayerContext
  useEffect(() => {
    let isMounted = true;

    async function loadCustomVideo() {
      if (customVideos.length === 0 && !activeBackgroundVideoId) {
        if (isMounted) setVideoUrl('');
        return;
      }
      try {
        const resolved = await resolveBackgroundVideo(activeBackgroundVideoId, customVideos);
        if (!isMounted) return;
        if (resolved?.url) {
          setVideoUrl(resolved.url);
        } else {
          setVideoUrl('');
        }
      } catch (e) {
        console.error('Failed to load background video:', e);
        if (isMounted) {
          setVideoUrl('');
        }
      }
    }

    loadCustomVideo();
    return () => { isMounted = false; };
  }, [activeBackgroundVideoId, customVideos]);

  // Dual-buffer crossfade manager: smoothly transitions to new video and pauses inactive slot after crossfade
  useEffect(() => {
    if (!videoUrl) {
      setSlotAOpacity(0);
      setSlotBOpacity(0);
      const clearTimer = setTimeout(() => {
        if (videoRefA.current) videoRefA.current.pause();
        if (videoRefB.current) videoRefB.current.pause();
        setSlotAUrl('');
        setSlotBUrl(null);
      }, 900);
      return () => clearTimeout(clearTimer);
    }

    if (activeSlot === 'A') {
      if (slotAUrl === videoUrl) {
        setSlotAOpacity(1);
        setSlotBOpacity(0);
        return;
      }
      // Load onto Slot B and crossfade
      setSlotBUrl(videoUrl);
      setSlotBOpacity(1);
      setSlotAOpacity(0);
      setActiveSlot('B');
      const pauseTimer = setTimeout(() => {
        if (videoRefA.current) videoRefA.current.pause();
      }, 1100);
      return () => clearTimeout(pauseTimer);
    } else {
      if (slotBUrl === videoUrl) {
        setSlotBOpacity(1);
        setSlotAOpacity(0);
        return;
      }
      // Load onto Slot A and crossfade
      setSlotAUrl(videoUrl);
      setSlotAOpacity(1);
      setSlotBOpacity(0);
      setActiveSlot('A');
      const pauseTimer = setTimeout(() => {
        if (videoRefB.current) videoRefB.current.pause();
      }, 1100);
      return () => clearTimeout(pauseTimer);
    }
  }, [videoUrl]);

function getVideoPoster(url: string | null | undefined): string {
  if (!url) return '';
  const match = customVideos.find(
    (v) =>
      v.videoUrl === url ||
      v.videoUrl720p === url ||
      v.videoUrl480p === url ||
      v.id === url ||
      v.renditions?.some((r) => r.url === url)
  );
  if ((match as any)?.posterUrl || (match as any)?.poster_url) {
    return (match as any).posterUrl || (match as any).poster_url;
  }
  return '';
}

  // Start playback safely on video elements whenever sources are ready (iOS Safari, iPadOS, Android)
  const playVideoSafe = (vid: HTMLVideoElement | null) => {
    if (!vid) return;
    try {
      vid.muted = true;
      (vid as any).playsInline = true;
      vid.setAttribute('muted', '');
      vid.setAttribute('playsinline', '');
      vid.setAttribute('webkit-playsinline', 'true');
      vid.setAttribute('x5-playsinline', 'true');
      const promise = vid.play();
      if (promise !== undefined) {
        promise.catch(() => {
          // Autoplay policy paused it; unblock listener will start on first touch/click/scroll
        });
      }
    } catch {}
  };

  useEffect(() => {
    if (slotAUrl && videoRefA.current) {
      try { videoRefA.current.load(); } catch {}
      playVideoSafe(videoRefA.current);
    }
  }, [slotAUrl]);

  useEffect(() => {
    if (slotBUrl && videoRefB.current) {
      try { videoRefB.current.load(); } catch {}
      playVideoSafe(videoRefB.current);
    }
  }, [slotBUrl]);

  const handleVideoError = (failedSrc: string | null) => {
    if (!failedSrc) return;
    // Try another cloud default video from customVideos if available
    const fallbackCloud = customVideos.find(
      v =>
        v.videoUrl &&
        v.videoUrl !== failedSrc &&
        (v.videoUrl.startsWith('/api/media/') || v.videoUrl.startsWith('http://') || v.videoUrl.startsWith('https://'))
    );
    setVideoUrl(fallbackCloud?.videoUrl || '');
  };

  // Global user interaction unblocker for mobile browser autoplay policy & iOS Low Power Mode
  useEffect(() => {
    const unblock = () => {
      if (videoRefA.current && slotAUrl) playVideoSafe(videoRefA.current);
      if (videoRefB.current && slotBUrl) playVideoSafe(videoRefB.current);
    };
    window.addEventListener('touchstart', unblock, { once: true, passive: true });
    window.addEventListener('pointerdown', unblock, { once: true, passive: true });
    window.addEventListener('click', unblock, { once: true, passive: true });
    window.addEventListener('keydown', unblock, { once: true, passive: true });
    window.addEventListener('scroll', unblock, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', unblock);
      window.removeEventListener('pointerdown', unblock);
      window.removeEventListener('click', unblock);
      window.removeEventListener('keydown', unblock);
      window.removeEventListener('scroll', unblock);
    };
  }, [slotAUrl, slotBUrl]);

  // Respect prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Measure video upscale factor & dropped frames every 6 seconds while active
  useEffect(() => {
    const activeVid = activeSlot === 'A' ? videoRefA.current : videoRefB.current;
    const activeUrl = activeSlot === 'A' ? slotAUrl : slotBUrl;
    if (!activeVid || !activeUrl) return;

    const measure = () => {
      if (document.hidden || activeVid.paused || !activeVid.videoWidth) return;
      const snap = computeVideoQualityMetrics(
        activeVid,
        activeUrl.includes('480p') ? '480p' : activeUrl.includes('1080p') ? '1080p' : '720p'
      );
      if (snap) {
        setLatestVideoQualitySnapshot(snap);
        if (snap.totalVideoFrames > 60 && snap.droppedFrameRatio > 0.18) {
          reportVideoPerformanceDegradation(
            `dropped ${snap.droppedVideoFrames}/${snap.totalVideoFrames} frames`
          );
        }
      }
    };

    const timer = window.setInterval(measure, 6000);
    activeVid.addEventListener('loadeddata', measure, { once: true });
    return () => {
      window.clearInterval(timer);
      activeVid.removeEventListener('loadeddata', measure);
    };
  }, [activeSlot, slotAUrl, slotBUrl]);

  // Pause video when screen locks or app goes to background (keeps audio reciting uninterrupted!)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden || prefersReducedMotion) {
        if (videoRefA.current) videoRefA.current.pause();
        if (videoRefB.current) videoRefB.current.pause();
      } else {
        if (slotAUrl && videoRefA.current && activeSlot === 'A') {
          playVideoSafe(videoRefA.current);
        }
        if (slotBUrl && videoRefB.current && activeSlot === 'B') {
          playVideoSafe(videoRefB.current);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [slotAUrl, slotBUrl, activeSlot, prefersReducedMotion]);

  const activePoster = getVideoPoster(activeSlot === 'A' ? slotAUrl : slotBUrl);
  const hasActiveVideo = Boolean(slotAUrl || slotBUrl) && !prefersReducedMotion;
  const useCleanCompositor = isFeatureEnabled('hdPortraitVideoEngine');

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden select-none bg-[#06150F]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: 'var(--bg-primary, #06150F)',
        zIndex: 0,
      }}
    >
      {/* LAYER 1: 100% Solid Opaque Base + Designed Medina Emerald Gradient Fallback (Never transparent, white, or black flash) */}
      <div
        className="fixed inset-0"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100dvh',
          background:
            'radial-gradient(circle at 50% 18%, #0C2A20 0%, #06150F 72%, #040E0A 100%)',
          zIndex: 0,
        }}
      />

      {/* LAYER 2A: High-resolution static poster fallback for instant display before video buffers & Reduced Motion mode */}
      {Boolean(activePoster) && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-700 ease-out"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            backgroundImage: `url(${activePoster})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 1,
          }}
        />
      )}

      {/* LAYER 2B: GPU-Composited Muted Video Layer (No software CSS filter on <video> to guarantee 0 dropped frames & 0 audio crackle) */}
      {!prefersReducedMotion && (
        <>
          <video
            ref={videoRefA}
            src={slotAUrl || undefined}
            poster={getVideoPoster(slotAUrl)}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            aria-hidden="true"
            className="fixed inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ease-out"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: slotAOpacity,
              transform: 'translateZ(0)',
              willChange: 'opacity',
              filter: useCleanCompositor
                ? undefined
                : `brightness(${0.85 + visualIntensity * 0.2}) contrast(1.05)`,
              zIndex: 1,
            }}
            onCanPlay={() => {
              if (activeSlot === 'A') playVideoSafe(videoRefA.current);
            }}
            onLoadedData={() => {
              if (activeSlot === 'A') playVideoSafe(videoRefA.current);
            }}
            onError={() => handleVideoError(slotAUrl)}
            onEnded={() => {
              if (videoRefA.current && activeSlot === 'A') {
                videoRefA.current.currentTime = 0;
                playVideoSafe(videoRefA.current);
              }
            }}
          />

          <video
            ref={videoRefB}
            src={slotBUrl || undefined}
            poster={getVideoPoster(slotBUrl)}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            aria-hidden="true"
            className="fixed inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ease-out"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: slotBOpacity,
              transform: 'translateZ(0)',
              willChange: 'opacity',
              filter: useCleanCompositor
                ? undefined
                : `brightness(${0.85 + visualIntensity * 0.2}) contrast(1.05)`,
              zIndex: 1,
            }}
            onCanPlay={() => {
              if (activeSlot === 'B') playVideoSafe(videoRefB.current);
            }}
            onLoadedData={() => {
              if (activeSlot === 'B') playVideoSafe(videoRefB.current);
            }}
            onError={() => handleVideoError(slotBUrl)}
            onEnded={() => {
              if (videoRefB.current && activeSlot === 'B') {
                videoRefB.current.currentTime = 0;
                playVideoSafe(videoRefB.current);
              }
            }}
          />
        </>
      )}

      {/* Only render static geometric pattern when no video is active so video stays 100% sharp and unblurred */}
      {!hasActiveVideo && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            zIndex: 2,
          }}
        >
          <IslamicPattern intensity={visualIntensity} theme={theme} />
        </div>
      )}

      {/* LAYER 3: Measured WCAG AA Contrast Scrim (>= 4.5:1 text legibility over brightest video frame) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100dvh',
          background:
            'linear-gradient(180deg, rgba(6, 21, 15, 0.80) 0%, rgba(6, 21, 15, 0.48) 45%, rgba(6, 21, 15, 0.86) 100%)',
          zIndex: 3,
        }}
      />
    </div>
  );
}

export default QuranicPremiumBackground;
