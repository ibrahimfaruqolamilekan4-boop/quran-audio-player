import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SurahDownloadButton } from './SurahDownloadButton';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Volume2,
  VolumeX,
  Moon,
  Star,
  Check,
  Search,
  X,
  Loader2,
  BookOpen,
  ListMusic,
  Share2,
  Sparkles,
  Sliders,
  Maximize2,
  Download
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { isSurahDownloaded, downloadSurah } from '../lib/offlineManager';
import { SubscriptionModal } from './SubscriptionModal';
import { AMBIENT_TRACKS } from '../lib/constants';
import { ReciterAvatar } from './ReciterAvatar';
import type { AmbientTrack, Chapter, Reciter } from '../types';

function formatTime(seconds: number) {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRemainingTime(current: number, total: number) {
  if (!isFinite(total) || total <= 0) return '-0:00';
  const rem = Math.max(0, total - current);
  return `-${formatTime(rem)}`;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

export function NowPlayingOverlay() {
  const {
    isNowPlayingOpen,
    setNowPlayingOpen,
    playMode,
    setPlayMode,
    currentAyah,
    currentChapter,
    currentReciter,
    chapters,
    isPlaying,
    isLoading,
    playbackError,
    currentTime,
    duration,
    togglePlayPause,
    playNextChapter,
    playPreviousChapter,
    seekTo,
    skipForward,
    skipBackward,
    quranVolume,
    setQuranVolume,
    ambientVolume,
    setAmbientVolume,
    playbackRate,
    setPlaybackRate,
    currentAmbient,
    setAmbientTrack,
    activeBackgroundVideoId,
    setActiveBackgroundVideoId,
    customVideos,
    ambientVideoMapping,
  } = usePlayer();

  const reduceMotion = useReducedMotion();
  const close = useCallback(() => setNowPlayingOpen(false), [setNowPlayingOpen]);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Soundscape selector bottom sheet state
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [soundSearch, setSoundSearch] = useState('');
  
  // Sleep timer state
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const sleepTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Favorites state
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Offline download & subscription state
  const { user } = useAuth();
  const [showSubModal, setShowSubModal] = useState(false);
  const [isCurrentDownloaded, setIsCurrentDownloaded] = useState(false);
  const [isDownloadingCurrent, setIsDownloadingCurrent] = useState(false);
  const [currentDownloadPct, setCurrentDownloadPct] = useState(0);

  // Arabic Quran reader modal
  const [showAyahReader, setShowAyahReader] = useState(false);

  const isOpen = isNowPlayingOpen && Boolean(currentChapter);

  // Check if current track is in favorites
  useEffect(() => {
    if (!currentChapter) return;
    try {
      const favs = JSON.parse(localStorage.getItem('nooraya:favorites') || '[]');
      setIsFavorite(favs.includes(currentChapter.id));
    } catch {
      setIsFavorite(false);
    }
  }, [currentChapter]);

  const toggleFavorite = () => {
    if (!currentChapter) return;
    try {
      const favs: number[] = JSON.parse(localStorage.getItem('nooraya:favorites') || '[]');
      let updated: number[];
      if (favs.includes(currentChapter.id)) {
        updated = favs.filter(id => id !== currentChapter.id);
        setIsFavorite(false);
      } else {
        updated = [...favs, currentChapter.id];
        setIsFavorite(true);
      }
      localStorage.setItem('nooraya:favorites', JSON.stringify(updated));
    } catch {}
  };

  // Sleep timer logic
  const handleSetSleepTimer = (minutes: number | null) => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    setSleepTimerMinutes(minutes);
    setShowSleepTimerModal(false);

    if (minutes !== null) {
      sleepTimeoutRef.current = setTimeout(() => {
        togglePlayPause();
        setSleepTimerMinutes(null);
      }, minutes * 60 * 1000);
    }
  };

  // Keyboard escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showSoundModal) setShowSoundModal(false);
        else if (showSleepTimerModal) setShowSleepTimerModal(false);
        else close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close, showSoundModal, showSleepTimerModal]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!currentChapter) return null;

  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const reciterFor: Pick<Reciter, 'name' | 'imageUrl'> =
    currentReciter ?? { name: 'Reciter', imageUrl: null };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    setPlaybackRate(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  };

  // Filter ambient soundscapes for the bottom sheet
  const filteredSounds = AMBIENT_TRACKS.filter(t => 
    t.name.toLowerCase().includes(soundSearch.toLowerCase())
  );

  const handleSelectSound = (track: AmbientTrack | null) => {
    setAmbientTrack(track);
    if (track) {
      const targetVideo = ambientVideoMapping[track.id] || customVideos.find(v => v.id === track.id || (v.name && v.name.toLowerCase().includes(track.id.toLowerCase())))?.videoUrl;
      if (targetVideo) {
        setActiveBackgroundVideoId(targetVideo);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Now playing"
          tabIndex={-1}
          className="fixed inset-0 z-[90] flex flex-col justify-between overflow-hidden outline-none select-none"
          initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          drag={reduceMotion ? false : 'y'}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 150) close();
          }}
        >
          {/*
           * VIVID AMBIENT CANVAS INTEGRATION:
           * The master background video from QuranicPremiumBackground renders at full resolution
           * directly behind this transparent container. We apply a soft protective gradient
           * at the top and bottom so text is 100% readable while the video remains vivid & visible!
           */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />

          {/* =========================================================================
              TOP BAR: Minimize Chevron, Soundscape Pill, Options
             ========================================================================= */}
          <div className="relative z-20 flex shrink-0 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
            {/* Minimize button */}
            <button
              onClick={close}
              aria-label="Minimize player"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronDown size={28} />
            </button>

            {/* FLOATING SOUNDSCAPE PILL (Exactly like in EasyQuranify video) */}
            <button
              onClick={() => setShowSoundModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 backdrop-blur-xl text-white text-xs font-semibold tracking-wide transition-all shadow-lg active:scale-95 group cursor-pointer"
            >
              <Volume2 size={15} className="text-teal-400 group-hover:scale-110 transition-transform" />
              <span>{currentAmbient ? currentAmbient.name : 'No sounds'}</span>
            </button>

            {/* Favorite Star */}
            <button
              onClick={toggleFavorite}
              aria-label="Add to favorites"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Star 
                size={22} 
                className={isFavorite ? 'text-amber-400 fill-amber-400' : 'text-white/80'} 
              />
            </button>
          </div>

          {/* =========================================================================
              CENTER / HERO: Clean Atmospheric Breathing Space
             ========================================================================= */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
            {/* Small subtle reciter badge or verse snippet */}
            <div className="text-center max-w-md">
              <span className="font-arabic text-3xl md:text-4xl text-amber-300/90 leading-relaxed block drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] font-normal mb-1">
                {currentChapter.name_arabic}
              </span>
              <p className="text-xs text-white/70 tracking-widest uppercase font-medium drop-shadow-md">
                Surah {currentChapter.id} • {currentChapter.verses_count} Verses
              </p>
            </div>
          </div>

          {/* =========================================================================
              LOWER CONTROL CONSOLE (Identical to EasyQuranify in the video)
             ========================================================================= */}
          <div className="relative z-20 shrink-0 px-6 sm:px-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4">
            {/* Track & Reciter Info Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Small circular reciter portrait */}
                <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20 shadow-lg shrink-0">
                  <ReciterAvatar reciter={reciterFor} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-serif text-white font-bold tracking-tight truncate drop-shadow-md">
                    {currentChapter.name_simple}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium truncate drop-shadow">
                    {currentReciter?.name || 'Reciter'}
                  </p>
                </div>
              </div>

              {/* Heart / Favorite Toggle */}
              <button
                onClick={toggleFavorite}
                className="p-2 text-white/80 hover:text-white transition-colors"
              >
                <Star size={24} className={isFavorite ? 'text-amber-400 fill-amber-400' : 'text-white/70'} />
              </button>
            </div>

            {/* Scrubber Progress Bar */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={isFinite(duration) ? duration : 0}
                step={0.5}
                value={Math.min(currentTime, duration || 0)}
                onChange={e => seekTo(parseFloat(e.target.value))}
                aria-label="Seek within surah"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 accent-teal-400 block"
                style={{
                  background: `linear-gradient(to right, #2DD4BF ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`,
                }}
              />
              <div className="flex justify-between font-mono text-[11px] text-slate-300 font-medium">
                <span>{formatTime(currentTime)}</span>
                <span>{formatRemainingTime(currentTime, duration)}</span>
              </div>
            </div>

            {/* Playback Controls Row: Speed, Prev, Play/Pause, Next, Sleep */}
            <div className="flex items-center justify-between pt-1">
              {/* Playback Speed */}
              <button
                onClick={cycleSpeed}
                aria-label={`Playback speed ${playbackRate}x`}
                className="text-xs font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 hover:border-white/30 transition-all min-w-[36px] text-center"
              >
                {playbackRate}x
              </button>

              {/* Transport Buttons */}
              <div className="flex items-center gap-5 sm:gap-7">
                <button
                  onClick={playPreviousChapter}
                  aria-label="Previous surah"
                  className="p-2 text-white/90 hover:text-white transition-colors active:scale-95"
                >
                  <SkipBack size={28} className="fill-current" />
                </button>

                <button
                  onClick={togglePlayPause}
                  disabled={isLoading}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-16 h-16 rounded-full bg-[#D4AF37] hover:bg-[#E2C04B] text-[#06150F] flex items-center justify-center shadow-[0_0_35px_rgba(212,175,55,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 size={30} className="animate-spin text-slate-950" />
                  ) : isPlaying ? (
                    <Pause size={30} className="fill-current text-slate-950" />
                  ) : (
                    <Play size={30} className="fill-current ml-1 text-slate-950" />
                  )}
                </button>

                <button
                  onClick={playNextChapter}
                  aria-label="Next surah"
                  className="p-2 text-white/90 hover:text-white transition-colors active:scale-95"
                >
                  <SkipForward size={28} className="fill-current" />
                </button>
              </div>

              {/* Sleep Timer */}
              <button
                onClick={() => setShowSleepTimerModal(true)}
                aria-label="Sleep timer"
                className={`p-2 transition-colors ${
                  sleepTimerMinutes !== null ? 'text-teal-400' : 'text-slate-300 hover:text-white'
                }`}
                title={sleepTimerMinutes ? `Sleep timer: ${sleepTimerMinutes}m` : 'Set sleep timer'}
              >
                <Moon size={22} className={sleepTimerMinutes !== null ? 'fill-teal-400' : ''} />
              </button>
            </div>

            {/* Bottom Utility Tools: Volume, Arabic Verses ('ق'), Playlist */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-slate-300">
              {/* Volume Slider Drawer */}
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-slate-400" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={quranVolume}
                  onChange={e => setQuranVolume(parseFloat(e.target.value))}
                  aria-label="Recitation volume"
                  className="w-20 sm:w-28 h-1 accent-teal-400 bg-white/20 rounded-full"
                />
              </div>

              {/* Arabic Verse Reader Toggle ('ق') */}
              <button
                onClick={() => setShowAyahReader(!showAyahReader)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-arabic text-lg font-bold transition-all ${
                  showAyahReader 
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Read Quran Verses"
              >
                ق
              </button>

              {currentChapter && currentReciter && (
                <SurahDownloadButton
                  chapter={currentChapter}
                  reciter={currentReciter}
                  showText={false}
                />
              )}

              {/* Soundscape Mixer quick button */}
              <button
                onClick={() => setShowSoundModal(true)}
                className="p-2 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              >
                <Sliders size={18} />
                <span className="hidden sm:inline">Soundscapes</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              BOTTOM SHEET: "Background sound" Modal (Exactly as in the user's video!)
             ========================================================================= */}
          <AnimatePresence>
            {showSoundModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex flex-col justify-end"
                onClick={() => setShowSoundModal(false)}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  className="bg-[#0B0F19] border-t border-white/10 rounded-t-[2.5rem] p-6 max-h-[85vh] overflow-y-auto w-full shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Top Bar: Close (✕), Title, Checkmark (✓) */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5">
                    <button
                      onClick={() => setShowSoundModal(false)}
                      className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                      <X size={18} />
                    </button>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Background sound
                    </h3>
                    <button
                      onClick={() => setShowSoundModal(false)}
                      className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center hover:bg-teal-500/30 transition-colors"
                    >
                      <Check size={18} />
                    </button>
                  </div>

                  {/* Search bar */}
                  <div className="relative mb-6">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={soundSearch}
                      onChange={e => setSoundSearch(e.target.value)}
                      placeholder="Search soundscape..."
                      className="w-full bg-[#131926] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 transition-colors"
                    />
                  </div>

                  {/* 4-Column Grid of Sound Cards (matching video exactly) */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3.5 mb-6">
                    {/* No sounds Option */}
                    <button
                      onClick={() => handleSelectSound(null)}
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
                    {filteredSounds.map(track => {
                      const isActive = currentAmbient?.id === track.id;
                      const Icon = track.icon;
                      return (
                        <button
                          key={track.id}
                          onClick={() => handleSelectSound(track)}
                          className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                            isActive 
                              ? 'bg-teal-500/15 border-teal-400 text-teal-300 shadow-lg shadow-teal-500/10' 
                              : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]'
                          }`}
                        >
                          <Icon size={26} />
                          <span className="text-xs font-semibold text-center truncate w-full">{track.name}</span>
                          {isActive && (
                            <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center">
                              <Check size={11} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Volume Slider for the chosen soundscape */}
                  {currentAmbient && (
                    <div className="bg-[#131926] p-4 rounded-2xl border border-white/[0.06] flex items-center gap-4">
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
                          onChange={e => setAmbientVolume(parseFloat(e.target.value))}
                          className="w-full h-1.5 accent-teal-400 bg-white/20 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* =========================================================================
              SLEEP TIMER MODAL
             ========================================================================= */}
          <AnimatePresence>
            {showSleepTimerModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setShowSleepTimerModal(false)}
              >
                <div
                  className="bg-[#0B0F19] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Moon size={18} className="text-teal-400" />
                      <span>Sleep Timer</span>
                    </h3>
                    <button
                      onClick={() => setShowSleepTimerModal(false)}
                      className="text-slate-500 hover:text-white"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {[15, 30, 45, 60].map(mins => (
                      <button
                        key={mins}
                        onClick={() => handleSetSleepTimer(mins)}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
                          sleepTimerMinutes === mins
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                            : 'bg-white/[0.02] text-slate-300 border-white/[0.06] hover:bg-white/[0.05]'
                        }`}
                      >
                        <span>{mins} minutes</span>
                        {sleepTimerMinutes === mins && <Check size={16} />}
                      </button>
                    ))}

                    {sleepTimerMinutes !== null && (
                      <button
                        onClick={() => handleSetSleepTimer(null)}
                        className="w-full text-center px-4 py-2.5 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mt-2"
                      >
                        Turn off sleep timer
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* =========================================================================
              ARABIC AYAH READER MODAL ('ق')
             ========================================================================= */}
          <AnimatePresence>
            {showAyahReader && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed inset-x-0 bottom-0 z-[100] bg-[#070A12]/95 border-t border-white/15 rounded-t-[2.5rem] p-6 max-h-[70vh] overflow-y-auto shadow-2xl backdrop-blur-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen size={16} className="text-teal-400" />
                    <span>Surah {currentChapter.name_simple} • {currentChapter.name_arabic}</span>
                  </h3>
                  <button
                    onClick={() => setShowAyahReader(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="text-center py-6 space-y-4">
                  <span className="font-arabic text-4xl text-amber-300 leading-[2.2] block dir-rtl">
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </span>
                  <p className="text-sm text-slate-300 font-light italic max-w-md mx-auto">
                    In the name of Allah, the Entirely Merciful, the Especially Merciful.
                  </p>
                  <p className="text-xs text-slate-500 pt-4">
                    Recited by {currentReciter?.name} ({currentReciter?.style})
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
