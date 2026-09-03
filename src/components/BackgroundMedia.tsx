import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { motion, AnimatePresence } from 'motion/react';

const AmbientCSSBackground = ({ type, intensity }: { type: string; intensity: number }) => {
  // Boost intensity so it's always visible even at low volumes
  const opacity = 0.3 + (intensity * 0.7);

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
              opacity: opacity
            }} 
          />
        </div>
      );
    case 'fire':
      return (
        <div className="absolute inset-0 bg-[#140500] overflow-hidden">
           <div 
             className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,_rgba(255,80,0,0.5)_0%,_transparent_70%)] animate-fire" 
             style={{ opacity: opacity }}
           />
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_90%,_rgba(255,150,0,0.2)_0%,_transparent_50%)] animate-pulse" />
        </div>
      );
    case 'waves':
      return (
        <div className="absolute inset-0 bg-[#00101a] overflow-hidden">
          <div 
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,100,200,0.4)_0%,_transparent_80%)] animate-wave" 
            style={{ opacity: opacity, transformOrigin: 'bottom center' }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,150,255,0.08)_100%)]" />
        </div>
      );
    case 'wind':
      return (
        <div className="absolute inset-0 bg-[#0a1014] overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(100,120,140,0.15)_0%,_transparent_100%)]" />
           <div 
             className="absolute inset-0 animate-wind"
             style={{
               backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)',
               backgroundSize: '200px 4px',
               opacity: opacity
             }} 
           />
        </div>
      );
    case 'river':
      return (
         <div className="absolute inset-0 bg-[#001a14] overflow-hidden">
           <div 
             className="absolute -inset-10 bg-[linear-gradient(45deg,_rgba(0,200,150,0.15)_0%,_transparent_40%,_rgba(0,150,200,0.15)_100%)] animate-wave" 
             style={{ opacity: opacity }}
           />
         </div>
      );
    default:
      return null;
  }
};

export function BackgroundMedia() {
  const { currentAmbient, ambientVolume } = usePlayer();
  const activeAmbientId = currentAmbient?.id;
  
  // Volume goes from 0.0 to 1.0. 
  // We use this to scale the visual intensity of the CSS animations.
  const visualIntensity = Math.max(0.2, ambientVolume);

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
            <AmbientCSSBackground type={activeAmbientId} intensity={visualIntensity} />
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
      {/* 
        Subtle overlay gradient to make text legible while blending edges.
        Reduced from 40% opacity to 20% to make the CSS animations pop more!
      */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
    </div>
  );
}
