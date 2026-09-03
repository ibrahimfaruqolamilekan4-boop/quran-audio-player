import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { motion, AnimatePresence } from 'motion/react';

// Option 2: Support local self-hosted videos
// To use real videos, users just need to put MP4 files in the public/videos folder
const LOCAL_VIDEOS: Record<string, string> = {
  rain: '/videos/rain.mp4',
  fire: '/videos/fire.mp4',
  waves: '/videos/waves.mp4',
  wind: '/videos/wind.mp4',
  river: '/videos/river.mp4',
};

// Option 1: Pure CSS Dynamic Backgrounds (Always work, no downloads needed)
const AmbientCSSBackground = ({ type, intensity }: { type: string; intensity: number }) => {
  switch (type) {
    case 'rain':
      return (
        <div className="absolute inset-0 bg-[#070b14] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(20,40,70,0.4)_0%,_transparent_100%)]" />
          <div 
            className="absolute inset-0 animate-rain"
            style={{
              backgroundImage: 'linear-gradient(170deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
              backgroundSize: '15px 120px',
              opacity: intensity * 0.6
            }} 
          />
        </div>
      );
    case 'fire':
      return (
        <div className="absolute inset-0 bg-[#140500] overflow-hidden">
           <div 
             className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,_rgba(255,80,0,0.3)_0%,_transparent_70%)] animate-fire" 
             style={{ opacity: intensity + 0.2 }}
           />
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_90%,_rgba(255,150,0,0.15)_0%,_transparent_50%)] animate-pulse-slow" />
        </div>
      );
    case 'waves':
      return (
        <div className="absolute inset-0 bg-[#00101a] overflow-hidden">
          <div 
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,100,200,0.3)_0%,_transparent_80%)] animate-wave" 
            style={{ opacity: intensity, transformOrigin: 'bottom center' }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,150,255,0.05)_100%)]" />
        </div>
      );
    case 'wind':
      return (
        <div className="absolute inset-0 bg-[#0a1014] overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(100,120,140,0.1)_0%,_transparent_100%)]" />
           <div 
             className="absolute inset-0 animate-wind"
             style={{
               backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0) 100%)',
               backgroundSize: '200px 4px',
               opacity: intensity * 0.7
             }} 
           />
        </div>
      );
    case 'river':
      return (
         <div className="absolute inset-0 bg-[#001a14] overflow-hidden">
           <div 
             className="absolute -inset-10 bg-[linear-gradient(45deg,_rgba(0,200,150,0.1)_0%,_transparent_40%,_rgba(0,150,200,0.1)_100%)] animate-wave" 
             style={{ opacity: intensity }}
           />
         </div>
      );
    default:
      return null;
  }
};

export function BackgroundMedia() {
  const { currentAmbient, ambientVolume } = usePlayer();
  const [videoError, setVideoError] = useState<Record<string, boolean>>({});

  const activeAmbientId = currentAmbient?.id;
  const activeVideoUrl = activeAmbientId ? LOCAL_VIDEOS[activeAmbientId] : null;
  
  // Calculate visual intensity based on ambient volume (minimum 0.2 opacity)
  const visualIntensity = 0.2 + (ambientVolume * 0.8);

  return (
    <div className="fixed inset-0 -z-50 w-full h-full overflow-hidden bg-[#050608]">
      <AnimatePresence mode="wait">
        {activeAmbientId ? (
          <motion.div
            key={activeAmbientId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            {/* 1. Base layer: CSS Fallback (Always renders, ensures immediate visuals) */}
            <AmbientCSSBackground type={activeAmbientId} intensity={visualIntensity} />

            {/* 2. Top layer: Local Video (Only renders if user added the file and no error occurred) */}
            {activeVideoUrl && !videoError[activeAmbientId] && (
              <video
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover pointer-events-none mix-blend-screen transition-opacity duration-1000"
                style={{ 
                  opacity: visualIntensity,
                  filter: `brightness(${0.4 + ambientVolume * 0.6})` 
                }}
                src={activeVideoUrl}
                onError={() => {
                  console.log(`Video not found for ${activeAmbientId}. Falling back to CSS animation.`);
                  setVideoError(prev => ({ ...prev, [activeAmbientId]: true }));
                }}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="gradient"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold-900/10 via-[#0A0C10] to-[#050608]"
          />
        )}
      </AnimatePresence>
      {/* Subtle overlay gradient to make text legible while blending edges */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
    </div>
  );
}
