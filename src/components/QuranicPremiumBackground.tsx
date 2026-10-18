import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { usePlayer } from '../context/PlayerContext';
import { resolveBackgroundVideo } from '../lib/backgrounds';

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
    'الله نور السموات والأرض',
    'فتبارك الله أحسن الخالقين',
    'إن الله مع الصابرين',
    'الحمد لله رب العالمين',
    'سبحان الله وبحمده',
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
  themeName = 'midnight-scholar',
  ambientVolume = 0.6,
}: QuranicPremiumBackgroundProps) {
  const theme = THEME_LIBRARY[themeName] || THEME_LIBRARY['midnight-scholar'];
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
    return '/videos/cosmos.mp4';
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
      if (!activeBackgroundVideoId) {
        if (isMounted) setVideoUrl('/videos/cosmos.mp4');
        return;
      }
      try {
        const resolved = await resolveBackgroundVideo(activeBackgroundVideoId, customVideos);
        if (!isMounted) return;
        if (resolved?.url) {
          setVideoUrl(resolved.url);
        } else {
          setVideoUrl('/videos/cosmos.mp4');
        }
      } catch (e) {
        console.error('Failed to load background video:', e);
        if (isMounted) setVideoUrl('/videos/cosmos.mp4');
      }
    }

    loadCustomVideo();
    return () => { isMounted = false; };
  }, [activeBackgroundVideoId, customVideos]);

  // Dual-buffer crossfade manager: smoothly transitions to new video without black frames or reload glitches
  useEffect(() => {
    if (!videoUrl) return;

    if (activeSlot === 'A') {
      if (slotAUrl === videoUrl) {
        setSlotAOpacity(1);
        setSlotBOpacity(0);
        return;
      }
      // Load onto Slot B
      setSlotBUrl(videoUrl);
      setSlotBOpacity(1);
      setSlotAOpacity(0);
      setActiveSlot('B');
    } else {
      if (slotBUrl === videoUrl) {
        setSlotBOpacity(1);
        setSlotAOpacity(0);
        return;
      }
      // Load onto Slot A
      setSlotAUrl(videoUrl);
      setSlotAOpacity(1);
      setSlotBOpacity(0);
      setActiveSlot('A');
    }
  }, [videoUrl]);

  // Start playback safely on video elements whenever sources are ready (iOS Safari, iPadOS, Android)
  const playVideoSafe = (vid: HTMLVideoElement | null) => {
    if (!vid) return;
    try {
      vid.muted = true;
      vid.defaultMuted = true;
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
    if (!failedSrc || failedSrc === '/videos/cosmos.mp4') return;
    // Try another cloud default video from customVideos if available, otherwise fall back to cosmos.mp4
    const fallbackCloud = customVideos.find(
      v =>
        v.videoUrl &&
        v.videoUrl !== failedSrc &&
        (v.videoUrl.startsWith('/api/media/') || v.videoUrl.startsWith('http://') || v.videoUrl.startsWith('https://'))
    );
    setVideoUrl(fallbackCloud?.videoUrl || '/videos/cosmos.mp4');
  };

  // Global user interaction unblocker for mobile browser autoplay policy
  useEffect(() => {
    const unblock = () => {
      if (videoRefA.current && slotAUrl) playVideoSafe(videoRefA.current);
      if (videoRefB.current && slotBUrl) playVideoSafe(videoRefB.current);
    };
    window.addEventListener('touchstart', unblock, { once: true, passive: true });
    window.addEventListener('pointerdown', unblock, { once: true, passive: true });
    window.addEventListener('click', unblock, { once: true, passive: true });
    window.addEventListener('keydown', unblock, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', unblock);
      window.removeEventListener('pointerdown', unblock);
      window.removeEventListener('click', unblock);
      window.removeEventListener('keydown', unblock);
    };
  }, [slotAUrl, slotBUrl]);

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden select-none"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
      }}
    >
      {/* Base gradient using theme colors */}
      <div 
        className="fixed inset-0"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: `linear-gradient(to bottom right, ${theme.colors.background}, ${theme.colors.muted})`,
          zIndex: 0,
        }}
      />

      {/*
       * Dual-Buffer Persistent Video Elements:
       * Fullscreen 100vw x 100vh canvas with object-cover - NO half-screen translations or crop offsets.
       */}
      <video
        ref={videoRefA}
        src={slotAUrl || undefined}
        autoPlay
        loop
        muted
        defaultMuted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        className="fixed inset-0 w-full h-full min-w-full min-h-full object-cover pointer-events-none transition-opacity duration-1000 ease-in-out"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          minWidth: '100%',
          minHeight: '100%',
          objectFit: 'cover',
          opacity: slotAOpacity,
          filter: `brightness(${0.9 + visualIntensity * 0.2}) contrast(1.08)`,
          zIndex: 1,
        }}
        onCanPlay={() => playVideoSafe(videoRefA.current)}
        onLoadedData={() => playVideoSafe(videoRefA.current)}
        onError={() => handleVideoError(slotAUrl)}
        onEnded={() => {
          if (videoRefA.current) {
            videoRefA.current.currentTime = 0;
            playVideoSafe(videoRefA.current);
          }
        }}
      />

      <video
        ref={videoRefB}
        src={slotBUrl || undefined}
        autoPlay
        loop
        muted
        defaultMuted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        className="fixed inset-0 w-full h-full min-w-full min-h-full object-cover pointer-events-none transition-opacity duration-1000 ease-in-out"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          minWidth: '100%',
          minHeight: '100%',
          objectFit: 'cover',
          opacity: slotBOpacity,
          filter: `brightness(${0.9 + visualIntensity * 0.2}) contrast(1.08)`,
          zIndex: 1,
        }}
        onCanPlay={() => playVideoSafe(videoRefB.current)}
        onLoadedData={() => playVideoSafe(videoRefB.current)}
        onError={() => handleVideoError(slotBUrl)}
        onEnded={() => {
          if (videoRefB.current) {
            videoRefB.current.currentTime = 0;
            playVideoSafe(videoRefB.current);
          }
        }}
      />

      {/* Theme-Aware Islamic Patterns and Divine Glows overlaying video */}
      <AnimatePresence mode="wait">
        <motion.div
          key={themeName}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="fixed inset-0 pointer-events-none"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 2,
          }}
        >
          {/* Islamic Geometric Patterns - THEME AWARE */}
          <IslamicPattern intensity={visualIntensity} theme={theme} />

          {/* Divine Particles - THEME AWARE */}
          <DivineParticles intensity={visualIntensity} theme={theme} />

          {/* Mystical Aurora Glow - THEME AWARE */}
          <MysticalAurora intensity={visualIntensity} theme={theme} />

          {/* Quranic Verse Scroll - THEME AWARE */}
          <QuranicVerseScroll intensity={visualIntensity} theme={theme} />
        </motion.div>
      </AnimatePresence>

      {/* Subtle protective vignette overlay so text and UI remain crystal clear */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: `radial-gradient(ellipse at center, rgba(2,6,18,0.15) 0%, rgba(2,6,18,0.65) 100%)`,
          zIndex: 3,
        }}
      />
    </div>
  );
}

export default QuranicPremiumBackground;
