import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { motion, AnimatePresence } from 'motion/react';

const BACKGROUND_VIDEOS: Record<string, string> = {
  rain: 'https://cdn.pixabay.com/video/2021/08/04/83864-584733477_tiny.mp4',
  fire: 'https://cdn.pixabay.com/video/2019/11/13/28971-372950570_tiny.mp4',
  waves: 'https://cdn.pixabay.com/video/2021/08/25/86277-592750694_tiny.mp4',
  wind: 'https://cdn.pixabay.com/video/2022/01/26/105741-671239860_tiny.mp4',
  river: 'https://cdn.pixabay.com/video/2020/05/25/40141-424888257_tiny.mp4',
};

export function BackgroundMedia() {
  const { currentAmbient } = usePlayer();
  const activeVideoUrl = currentAmbient?.id ? BACKGROUND_VIDEOS[currentAmbient.id] : null;

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-[#050608]">
      <AnimatePresence mode="wait">
        {activeVideoUrl ? (
          <motion.div
            key={activeVideoUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover transform scale-105 transition-opacity duration-1000"
              src={activeVideoUrl}
            />
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
      {/* Dark overlay gradient to ensure UI readability */}
      <div className="absolute inset-0 bg-black/40 backdrop-brightness-90" />
    </div>
  );
}
