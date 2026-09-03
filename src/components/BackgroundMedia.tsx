import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';

const AmbientCSSBackground = ({ type, intensity }: { type: string; intensity: number }) => {
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
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,_rgba(255,80,0,0.5)_0%,_transparent_70%)] animate-fire" style={{ opacity: opacity }} />
        </div>
      );
    case 'waves':
      return (
        <div className="absolute inset-0 bg-[#00101a] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,100,200,0.4)_0%,_transparent_80%)] animate-wave" style={{ opacity: opacity, transformOrigin: 'bottom center' }} />
        </div>
      );
    case 'wind':
      return (
        <div className="absolute inset-0 bg-[#0a1014] overflow-hidden">
           <div className="absolute inset-0 animate-wind" style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)', backgroundSize: '200px 4px', opacity: opacity }} />
        </div>
      );
    case 'river':
      return (
         <div className="absolute inset-0 bg-[#001a14] overflow-hidden">
           <div className="absolute -inset-10 bg-[linear-gradient(45deg,_rgba(0,200,150,0.15)_0%,_transparent_40%,_rgba(0,150,200,0.15)_100%)] animate-wave" style={{ opacity: opacity }} />
         </div>
      );
    default:
      return null;
  }
};

export function BackgroundMedia() {
  const { currentAmbient, ambientVolume, customVideos } = usePlayer();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const activeAmbientId = currentAmbient?.id;
  
  useEffect(() => {
    async function loadCustomVideo() {
      if (!activeAmbientId) {
        setVideoUrl(null);
        return;
      }
      // Check if it's a custom uploaded video
      const isCustom = customVideos.find(v => v.id === activeAmbientId);
      if (isCustom) {
        const blob = await localforage.getItem<Blob>('customVideo_blob_' + activeAmbientId);
        if (blob) {
          setVideoUrl(URL.createObjectURL(blob));
          return;
        }
      }
      setVideoUrl(null);
    }
    loadCustomVideo();
  }, [activeAmbientId, customVideos]);

  const visualIntensity = Math.max(0.2, ambientVolume);

  return (
    <div className="fixed inset-0 -z-50 w-full h-full overflow-hidden bg-gradient-to-br from-[#0F172A] to-[#020617]">
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
            {/* Base Layer */}
            <AmbientCSSBackground type={activeAmbientId} intensity={visualIntensity} />
            
            {/* Custom Uploaded Video Layer */}
            {videoUrl && (
              <video
                autoPlay loop muted playsInline aria-hidden="true"
                className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover pointer-events-none mix-blend-screen transition-opacity duration-1000"
                style={{ opacity: visualIntensity, filter: `brightness(${0.4 + ambientVolume * 0.6})` }}
                src={videoUrl}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="gradient"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/10 via-[#0A0C10] to-[#020408]"
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-[#050B14]/30 backdrop-blur-[4px] mix-blend-multiply" />
    </div>
  );
}
