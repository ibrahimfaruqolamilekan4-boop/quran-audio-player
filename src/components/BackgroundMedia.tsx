import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';

interface Particle {
  id: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

// Islamic geometric pattern generator
const IslamicPattern = ({ intensity }: { intensity: number }) => {
  const opacity = 0.15 + (intensity * 0.25);
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Star Pattern Grid */}
      <defs>
        <pattern id="stars" x="120" y="120" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="60" cy="60" r="3" fill="#C9A961" opacity={opacity * 0.8} />
          <circle cx="60" cy="60" r="8" fill="none" stroke="#C9A961" strokeWidth="1" opacity={opacity * 0.4} />
          <line x1="60" y1="30" x2="60" y2="90" stroke="#C9A961" strokeWidth="0.5" opacity={opacity * 0.3} />
          <line x1="30" y1="60" x2="90" y2="60" stroke="#C9A961" strokeWidth="0.5" opacity={opacity * 0.3} />
        </pattern>
        
        <pattern id="hexagon" x="100" y="100" width="100" height="100" patternUnits="userSpaceOnUse">
          <polygon
            points="50,0 100,25 100,75 50,100 0,75 0,25"
            fill="none"
            stroke="#1A4D3E"
            strokeWidth="1"
            opacity={opacity * 0.5}
          />
        </pattern>

        <radialGradient id="divineLight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C9A961" stopOpacity={opacity * 0.6} />
          <stop offset="50%" stopColor="#1A4D3E" stopOpacity={opacity * 0.2} />
          <stop offset="100%" stopColor="#0F1419" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="verseGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8DCC8" stopOpacity="0" />
          <stop offset="50%" stopColor="#C9A961" stopOpacity={opacity * 0.4} />
          <stop offset="100%" stopColor="#1A4D3E" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background layers */}
      <rect width="1200" height="800" fill="#0F1419" />
      
      {/* Subtle gradient base */}
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
      <g stroke="#C9A961" strokeWidth="2" fill="none" opacity={opacity * 0.7}>
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
        stroke="#C9A961"
        strokeWidth="1"
        opacity={opacity * 0.3}
      />
      <circle
        cx="600"
        cy="400"
        r="120"
        fill="none"
        stroke="#1A4D3E"
        strokeWidth="0.5"
        opacity={opacity * 0.2}
      />
    </svg>
  );
};

// Divine particles effect
const DivineParticles = ({ intensity }: { intensity: number }) => {
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
          className="absolute rounded-full bg-gradient-to-b from-[#C9A961] to-[#1A4D3E] blur-sm"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            opacity: 0.6,
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

// Quranic verse scrolling effect
const QuranicVerseScroll = ({ intensity }: { intensity: number }) => {
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
        style={{ color: '#C9A961', opacity: 0.2 + intensity * 0.2 }}
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

// Aurora-like mystical glow
const MysticalAurora = ({ intensity }: { intensity: number }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(202, 169, 97, 0.3) 0%, transparent 70%)',
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
          background: 'radial-gradient(circle, rgba(26, 77, 62, 0.2) 0%, transparent 70%)',
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

// Main Premium Background Component
export function QuranicPremiumBackground() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ambientVolume] = useState(0.6); // Default, integrate with your context
  const [ambientMode] = useState<'geometric' | 'mystical' | 'verses'>('geometric'); // Integrate with context

  const visualIntensity = Math.max(0.2, ambientVolume);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  return (
    <div className="fixed inset-0 -z-50 w-full h-full overflow-hidden">
      {/* Premium base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F1419] via-[#1A1F2E] to-[#0F1419]" />

      <AnimatePresence mode="wait">
        <motion.div
          key={ambiantMode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="absolute inset-0"
        >
          {/* Islamic Geometric Patterns */}
          <IslamicPattern intensity={visualIntensity} />

          {/* Divine Particles */}
          <DivineParticles intensity={visualIntensity} />

          {/* Mystical Aurora Glow */}
          <MysticalAurora intensity={visualIntensity} />

          {/* Quranic Verse Scroll */}
          {ambientMode === 'verses' && <QuranicVerseScroll intensity={visualIntensity} />}

          {/* Custom Video Overlay (if needed) */}
          {videoUrl && (
            <video
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover pointer-events-none mix-blend-screen transition-opacity duration-1000"
              style={{
                opacity: visualIntensity * 0.5,
                filter: `brightness(${0.3 + visualIntensity * 0.4})`,
              }}
              src={videoUrl}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Premium overlay with blur and vignette */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#0F1419]/5 to-[#0F1419]/20 backdrop-blur-[2px]" />
      
      {/* Vignette effect for premium feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(15, 20, 25, 0.4) 100%)',
        }}
      />
    </div>
  );
}

export default QuranicPremiumBackground;
