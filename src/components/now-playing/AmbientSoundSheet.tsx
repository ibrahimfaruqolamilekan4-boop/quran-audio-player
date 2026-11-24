import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Check,
  Search,
  Volume2,
  VolumeX,
  Lock,
  Sparkles,
} from 'lucide-react';
import { AMBIENT_TRACKS } from '../../lib/constants';
import type { AmbientTrack } from '../../types';

export const FREE_AMBIENT_LIMIT = 4;

interface AmbientSoundSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentAmbient: AmbientTrack | null;
  ambientVolume: number;
  onSelectSound: (track: AmbientTrack | null) => void;
  onVolumeChange: (vol: number) => void;
  customVideos: Array<{
    id: string;
    name: string;
    category?: string;
    posterUrl?: string;
    poster_url?: string;
    videoUrl?: string;
    videoUrl720p?: string;
    videoUrl480p?: string;
  }>;
  activeBackgroundVideoId: string | null;
  onSelectVideo: (videoId: string) => void;
  onOpenCredits: () => void;
  isPremium?: boolean;
  onRequireUpgrade?: (reason?: string) => void;
}

export function AmbientSoundSheet({
  isOpen,
  onClose,
  currentAmbient,
  ambientVolume,
  onSelectSound,
  onVolumeChange,
  customVideos,
  activeBackgroundVideoId,
  onSelectVideo,
  onOpenCredits,
  isPremium = false,
  onRequireUpgrade,
}: AmbientSoundSheetProps) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredSounds = AMBIENT_TRACKS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSoundClick = (track: AmbientTrack | null, index?: number) => {
    if (!track) {
      onSelectSound(null);
      return;
    }

    // Check if free user is exceeding the 4 included tracks
    const originalIndex = AMBIENT_TRACKS.findIndex((t) => t.id === track.id);
    if (!isPremium && originalIndex >= FREE_AMBIENT_LIMIT) {
      onRequireUpgrade?.(
        `The "${track.name}" atmospheric soundscape is a Premium feature. Upgrade to Premium (₦500) to unlock all immersive ambient layers.`
      );
      return;
    }

    onSelectSound(track);
  };

  const handleVideoClick = (vidId: string, idx: number) => {
    // Default / first video is free, subsequent custom HD videos prompt upgrade for free users
    if (!isPremium && idx > 0) {
      onRequireUpgrade?.(
        'Cinematic Full HD background video scenes are a Premium feature (₦500). Upgrade to access all Medina Night and sacred landscape visuals.'
      );
      return;
    }
    onSelectVideo(vidId);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex flex-col justify-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="bg-[#0B0F19] border-t border-white/10 rounded-t-[2.5rem] p-6 max-h-[85vh] overflow-y-auto w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar: Close, Title, Checkmark */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5">
            <button
              onClick={onClose}
              aria-label="Close background sound sheet"
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="text-center">
              <h3 className="text-base font-bold text-white tracking-wide">
                Background Soundscape
              </h3>
              {!isPremium && (
                <span className="text-[10px] text-amber-300 font-medium">
                  Free Tier: 4 tracks included · Upgrade (₦500) for all
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Confirm background sound"
              className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center hover:bg-teal-500/30 transition-colors cursor-pointer"
            >
              <Check size={18} />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search soundscapes (rain, night, ocean)..."
              className="w-full bg-[#131926] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 transition-colors"
            />
          </div>

          {/* Sound Cards Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3.5 mb-6">
            {/* No sounds Option */}
            <button
              type="button"
              onClick={() => handleSoundClick(null)}
              className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                !currentAmbient
                  ? 'bg-teal-500/15 border-teal-400 text-teal-300 shadow-lg shadow-teal-500/10'
                  : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <VolumeX size={26} />
              <span className="text-xs font-semibold text-center">No sounds</span>
              {!currentAmbient && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center">
                  <Check size={11} strokeWidth={3} />
                </div>
              )}
            </button>

            {/* Ambient Sound Options */}
            {filteredSounds.map((track) => {
              const isActive = currentAmbient?.id === track.id;
              const originalIndex = AMBIENT_TRACKS.findIndex((t) => t.id === track.id);
              const isLocked = !isPremium && originalIndex >= FREE_AMBIENT_LIMIT;
              const Icon = track.icon;

              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => handleSoundClick(track, originalIndex)}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-teal-500/15 border-teal-400 text-teal-300 shadow-lg shadow-teal-500/10'
                      : isLocked
                      ? 'bg-white/[0.02] border-white/[0.04] text-slate-500 hover:border-amber-500/30'
                      : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={26} />
                  <span className="text-xs font-semibold text-center truncate w-full">
                    {track.name}
                  </span>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                  {isLocked && (
                    <div className="absolute top-2 right-2 p-1 rounded-full bg-amber-500/20 text-amber-300">
                      <Lock size={10} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Volume Slider for active soundscape */}
          {currentAmbient && (
            <div className="bg-[#131926] p-4 rounded-2xl border border-white/[0.06] flex items-center gap-4 mb-6">
              <Volume2 size={18} className="text-teal-400 shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{currentAmbient.name} Volume</span>
                  <span>{Math.round(ambientVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={ambientVolume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-teal-400 bg-white/20 rounded-full cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Background Video Switcher */}
          <div className="pt-4 border-t border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <span>Ambient Video Backgrounds</span>
                {!isPremium && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 normal-case font-normal">
                    HD Premium
                  </span>
                )}
              </h4>
              <button
                type="button"
                onClick={onOpenCredits}
                className="text-xs text-slate-400 hover:text-teal-300 underline transition cursor-pointer"
              >
                Media Credits & Licenses
              </button>
            </div>

            {customVideos.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No active background videos published yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {customVideos.map((vid, idx) => {
                  const isSelected =
                    activeBackgroundVideoId === vid.id ||
                    activeBackgroundVideoId === vid.videoUrl ||
                    activeBackgroundVideoId === vid.videoUrl720p ||
                    activeBackgroundVideoId === vid.videoUrl480p;
                  const poster = vid.posterUrl || vid.poster_url;
                  const isLockedVideo = !isPremium && idx > 0;

                  return (
                    <button
                      key={vid.id}
                      type="button"
                      onClick={() => handleVideoClick(vid.id, idx)}
                      className={`group relative rounded-2xl overflow-hidden border text-left transition-all cursor-pointer aspect-[16/10] ${
                        isSelected
                          ? 'border-teal-400 ring-2 ring-teal-400/40 shadow-lg shadow-teal-500/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {poster ? (
                        <img
                          src={poster}
                          alt={vid.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#071F17] to-[#04100C]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{vid.name}</p>
                          {vid.category && (
                            <p className="text-[10px] text-teal-300/80 uppercase tracking-wider truncate">
                              {vid.category}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                        {isLockedVideo && !isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
                            <Lock size={10} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
