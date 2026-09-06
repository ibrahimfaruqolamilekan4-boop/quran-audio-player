import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { usePlayer } from '../context/PlayerContext';

/**
 * THEME CONFIGURATION INTERFACE
 * Define this at the top of your theme variations file
 */
export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    accent: string;
    muted: string;
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
 */
export const THEME_LIBRARY: Record<string, ThemeConfig> = {
  'midnight-scholar': {
    name: 'Midnight Scholar',
    colors: {
      primary: '#C9A961',
      secondary: '#8B7355',
      background: '#0A0E16',
      accent: '#D4AF37',
      muted: '#4A5568',
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
      primary: '#00D9A3',
      secondary: '#1A4D3E',
      background: '#051f16',
      accent: '#E8F4F0',
      muted: '#2D6A5C',
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
      primary: '#D4738B',
      secondary: '#8B4652',
      background: '#2B1620',
      accent: '#F5E6D3',
      muted: '#6B3847',
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
      primary: '#FFD700',
      secondary: '#87CEEB',
      background: '#1A1A3E',
      accent: '#FFE4B5',
      muted: '#4B0082',
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
      primary: '#FF8C42',
      secondary: '#8B4513',
      background: '#2D1810',
      accent: '#FFA500',
      muted: '#5C3D2E',
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
      primary: '#C0C0C0',
      secondary: '#4169E1',
      background: '#000000',
      accent: '#E0E0E0',
      muted: '#36454F',
    },
    patterns: {
      primaryColor: '#C0C0C0',
      secondaryColor: '#4169E1',
      opacity: 0.5,
    },
  },
};

// ============================================
// ISLAMIC GEOMETRIC PATTERN
// ============================================
const IslamicPattern = ({ intensity, theme }: { intensity: number; theme: ThemeConfig }) => {
  const opacity = 0.15 + (intensity * 0.25);
  const { primary, secondary } = theme.patterns;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="stars" x="120" y="120" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="60" cy="60" r="3" fill={primary} opacity={opacity * 0.8} />
          <circle cx="60" cy="60" r="8" fill="none" stroke={primary} strokeWidth="1" opacity={opacity * 0.4} />
          <line x1="60" y1="30" x2="60" y2="90" stroke={primary} strokeWidth="0.5" opacity={opacity * 0.3} />
          <line x1="30" y1="60" x2="90" y2="60" stroke={primary} strokeWidth="0.5" opacity={opacity * 0.3} />
        </pattern>
        
        <pattern id="hexagon" x="100" y="100" width="100" height="100" patternUnits="userSpaceOnUse">
          <polygon
            points="50,0 100,25 100,75 50,100 0,75 0,25"
            fill="none"
            stroke={secondary}
            strokeWidth="1"
            opacity={opacity * 0.5}
          />
        </pattern>

        <radialGradient id="divineLight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={primary} stopOpacity={opacity * 0.6} />
          <stop offset="50%" stopColor={secondary} stopOpacity={opacity * 0.2} />
          <stop offset="100%" stopColor={theme.colors.background} stopOpacity="0" />
        </radialGradient>

        <linearGradient id="verseGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={theme.colors.accent} stopOpacity="0" />
          <stop offset="50%" stopColor={primary} stopOpacity={opacity * 0.4} />
          <stop offset="100%" stopColor={secondary} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1200" height="800" fill={theme.colors.background} />
      
      <rect
        width="1200"
        height="800"
        fill="url(#divineLight)"
        cx="600"
        cy="400"
      />

      <g opacity={opacity * 0.6}>
        <rect width="1200" height="800" fill="url(#stars)" />
      </g>

      <g opacity={opacity * 0.4}>
        <rect width="1200" height="800" fill="url(#hexagon)" />
      </g>

      <g stroke={primary} strokeWidth="2" fill="none" opacity={opacity * 0.7}>
        <path d="M 20,50 L 20,20 L 50,20" />
        <circle cx="20" cy="20" r="8" fill="none" />
        <path d="M 1180,50 L 1180,20 L 1150,20" />
        <circle cx="1180" cy="20" r="8" fill="none" />
        <path d="M 20,750 L 20,780 L 50,780" />
        <circle cx="20" cy="780" r="8" fill="none" />
        <path d="M 1180,750 L 1180,780 L 1150,780" />
        <circle cx="1180" cy="780" r="8" fill="none" />
      </g>

      <circle
        cx="600"
        cy="400"
        r="150"
        fill="none"
        stroke={primary}
        strokeWidth="1"
        opacity={opacity * 0.3}
      />
      <circle
        cx="600"
        cy="400"
        r="120"
        fill="none"
        stroke={secondary}
        strokeWidth="0.5"
        opacity={opacity * 0.2}
      />
    </svg>
  );
};

// ============================================
// DIVINE PARTICLES
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
// MYSTICAL AURORA
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
// QURANIC VERSE SCROLL
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
// MAIN COMPONENT - IMPROVED WITH VIDEO PLAYBACK
// ============================================
interface QuranicPremiumBackgroundProps {
  themeName?: string;
  ambientVolume?: number;
  isPlaying?: boolean;  // ✨ NEW: Track playback state
}

export function QuranicPremiumBackground({ 
  themeName = 'midnight-scholar',
  ambientVolume = 0.6,
  isPlaying = false,  // ✨ NEW: Default to false
}: QuranicPremiumBackgroundProps) {
  const theme = THEME_LIBRARY[themeName] || THEME_LIBRARY['midnight-scholar'];
  const { activeBackgroundVideoId, customVideos, setActiveBackgroundVideoId } = usePlayer();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const visualIntensity = Math.max(0.2, ambientVolume);

  // ✨ IMPROVED: Load video based on activeBackgroundVideoId
  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;

    async function loadCustomVideo() {
      if (!activeBackgroundVideoId) {
        if (isMounted) setVideoUrl(null);
        return;
      }
      try {
        const blob = await localforage.getItem('customVideo_blob_' + activeBackgroundVideoId);
        if (blob && isMounted) {
          objectUrl = URL.createObjectURL(blob);
          setVideoUrl(objectUrl);
        } else if (isMounted) {
          setVideoUrl(null);
        }
      } catch (e) {
        console.error("Failed to load background video:", e);
        if (isMounted) setVideoUrl(null);
      }
    }

    loadCustomVideo();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [activeBackgroundVideoId]);

  // ✨ NEW: Auto-select first video if none selected
  useEffect(() => {
    if (!activeBackgroundVideoId && customVideos.length > 0) {
      setActiveBackgroundVideoId(customVideos[0].id);
    }
  }, [customVideos, activeBackgroundVideoId, setActiveBackgroundVideoId]);

  // ✨ IMPROVED: Calculate video opacity based on playback state
  const videoOpacity = isPlaying && videoUrl
    ? Math.max(0.6, visualIntensity * 0.95)  // More visible when playing
    : 0.15;  // Very subtle when paused/stopped

  const videoBrightness = isPlaying && videoUrl
    ? 0.65 + visualIntensity * 0.35
    : 0.3;

  return (
    <div className="fixed inset-0 -z-50 w-full h-full overflow-hidden">
      {/* Premium base gradient using theme colors */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom right, ${theme.colors.background}, ${theme.colors.muted})`,
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={themeName}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="absolute inset-0"
        >
          {/* Islamic Geometric Patterns - THEME AWARE */}
          <IslamicPattern intensity={visualIntensity} theme={theme} />

          {/* Divine Particles - THEME AWARE */}
          <DivineParticles intensity={visualIntensity} theme={theme} />

          {/* Mystical Aurora Glow - THEME AWARE */}
          <MysticalAurora intensity={visualIntensity} theme={theme} />

          {/* Quranic Verse Scroll - THEME AWARE */}
          <QuranicVerseScroll intensity={visualIntensity} theme={theme} />

          {/* ✨ IMPROVED: Custom Video Overlay with Playback Responsiveness */}
          {videoUrl && (
            <>
              {/* Video Element */}
              <motion.video
                key="video"
                initial={{ opacity: 0 }}
                animate={{ opacity: videoOpacity }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover pointer-events-none mix-blend-screen transition-all"
                style={{
                  filter: `brightness(${videoBrightness}) contrast(1.1)`,
                }}
                src={videoUrl}
              />

              {/* ✨ NEW: Active Video Indicator - Shows during playback */}
              {isPlaying && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-4 left-4 text-xs font-semibold text-teal-400 flex items-center gap-2 z-40 pointer-events-none"
                >
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <span className="bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                    Background Video Playing
                  </span>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Premium overlay with blur and vignette */}
      <div 
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{
          background: `linear-gradient(to bottom right, transparent, ${theme.colors.background}0d)`,
        }}
      />
      
      {/* Vignette effect for premium feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, ${theme.colors.background}66 100%)`,
        }}
      />
    </div>
  );
}

export default QuranicPremiumBackground;
