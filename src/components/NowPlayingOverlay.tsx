import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Moon,
  Star,
  Loader2,
  Sliders,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { isSurahAvailable } from '../lib/audio';
import { SubscriptionModal } from './SubscriptionModal';
import { MediaCreditsModal } from './MediaCreditsModal';
import { ReciterAvatar } from './ReciterAvatar';
import { SurahDownloadButton } from './SurahDownloadButton';
import { useBackgroundVideoSrc } from '../lib/backgrounds';
import { isFeatureEnabled } from '../lib/featureFlags';
import { BackgroundLayer } from './now-playing/BackgroundLayer';
import { ErrorBanner } from './now-playing/ErrorBanner';
import { AmbientSoundSheet } from './now-playing/AmbientSoundSheet';
import { SleepTimerModal } from './now-playing/SleepTimerModal';
import { AyahReaderSheet } from './now-playing/AyahReaderSheet';
import type { AmbientTrack, Reciter } from '../types';

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
    currentChapter,
    currentReciter,
    isPlaying,
    isLoading,
    playbackError,
    fallbackNotice,
    currentTime,
    duration,
    togglePlayPause,
    playNextChapter,
    playPreviousChapter,
    seekTo,
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
    allReciters,
    switchReciterAndPlay,
  } = usePlayer();

  const { isPremium } = useAuth();
  const reduceMotion = useReducedMotion();
  const close = useCallback(() => setNowPlayingOpen(false), [setNowPlayingOpen]);
  const dialogRef = useRef<HTMLDivElement>(null);

  const resolvedOverlayVideoSrc = useBackgroundVideoSrc(activeBackgroundVideoId, customVideos);
  const resolvedOverlayPoster = React.useMemo(() => {
    if (!activeBackgroundVideoId && customVideos.length === 0) return '';
    const match =
      customVideos.find(
        (v) =>
          v.id === activeBackgroundVideoId ||
          v.videoUrl === activeBackgroundVideoId ||
          v.videoUrl720p === activeBackgroundVideoId ||
          v.videoUrl480p === activeBackgroundVideoId
      ) || customVideos[0];
    return match?.posterUrl || match?.poster_url || '';
  }, [activeBackgroundVideoId, customVideos]);

  // Sub-modal states
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [showAyahReader, setShowAyahReader] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  // Sleep timer state
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const sleepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sleepTimerTargetTimeRef = useRef<number | null>(null);

  // Favorites state
  const [isFavorite, setIsFavorite] = useState(false);

  const isOpen = isNowPlayingOpen && Boolean(currentChapter);

  // Coordinate single active video across background & NowPlaying
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__noorayaNowPlayingOpen = isOpen;
    window.dispatchEvent(new CustomEvent('nooraya-now-playing-visibility', { detail: isOpen }));
    return () => {
      (window as any).__noorayaNowPlayingOpen = false;
      window.dispatchEvent(new CustomEvent('nooraya-now-playing-visibility', { detail: false }));
    };
  }, [isOpen]);

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
        updated = favs.filter((id) => id !== currentChapter.id);
        setIsFavorite(false);
      } else {
        updated = [...favs, currentChapter.id];
        setIsFavorite(true);
      }
      localStorage.setItem('nooraya:favorites', JSON.stringify(updated));
    } catch {}
  };

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Sleep timer logic
  const handleSetSleepTimer = (minutes: number | null) => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    setSleepTimerMinutes(minutes);
    setShowSleepTimerModal(false);

    if (minutes !== null) {
      const targetTime = Date.now() + minutes * 60 * 1000;
      sleepTimerTargetTimeRef.current = targetTime;
      sleepTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current) togglePlayPause();
        setSleepTimerMinutes(null);
        sleepTimerTargetTimeRef.current = null;
      }, minutes * 60 * 1000);
    } else {
      sleepTimerTargetTimeRef.current = null;
    }
  };

  useEffect(() => {
    if (sleepTimerTargetTimeRef.current && Date.now() >= sleepTimerTargetTimeRef.current) {
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
      if (isPlayingRef.current) togglePlayPause();
      setSleepTimerMinutes(null);
      sleepTimerTargetTimeRef.current = null;
    }
  }, [currentTime, togglePlayPause]);

  // Keyboard escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showSoundModal) setShowSoundModal(false);
        else if (showSleepTimerModal) setShowSleepTimerModal(false);
        else if (showAyahReader) setShowAyahReader(false);
        else close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close, showSoundModal, showSleepTimerModal, showAyahReader]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!currentChapter) return null;

  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const reciterFor: Pick<Reciter, 'name' | 'imageUrl'> =
    currentReciter ?? { name: 'Reciter', imageUrl: null };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    setPlaybackRate(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  };

  const handleSelectSound = (track: AmbientTrack | null) => {
    setAmbientTrack(track);
    if (track) {
      const targetVideo =
        ambientVideoMapping[track.id] ||
        customVideos.find(
          (v) => v.id === track.id || (v.name && v.name.toLowerCase().includes(track.id.toLowerCase()))
        )?.videoUrl;
      if (targetVideo) {
        setActiveBackgroundVideoId(targetVideo);
      }
    }
  };

  const handleSwitchSheikh = () => {
    const altReciter = allReciters.find(
      (r) => currentChapter && isSurahAvailable(r, currentChapter.id) && r.id !== currentReciter?.id
    );
    if (altReciter) {
      switchReciterAndPlay(altReciter);
    } else {
      setNowPlayingOpen(false);
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
          className={`fixed inset-0 z-[90] flex flex-col justify-between overflow-hidden outline-none select-none ${
            isFeatureEnabled('opaqueBackdropStack') ? 'bg-[#06150F]' : ''
          }`}
          style={
            isFeatureEnabled('opaqueBackdropStack')
              ? { backgroundColor: '#06150F' }
              : undefined
          }
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
          {/* 4-LAYER OPAQUE NOW PLAYING STACK */}
          <BackgroundLayer
            isOpen={isOpen}
            reduceMotion={reduceMotion}
            videoSrc={resolvedOverlayVideoSrc}
            posterUrl={resolvedOverlayPoster}
          />

          {/* TOP BAR: Minimize, Soundscape Pill, Favorite */}
          <div className="relative z-20 flex shrink-0 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
            <button
              onClick={close}
              aria-label="Minimize player"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronDown size={28} />
            </button>

            {/* FLOATING SOUNDSCAPE PILL */}
            <button
              onClick={() => setShowSoundModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#06150F]/95 hover:bg-[#0C2A20] border border-white/25 text-white text-xs font-semibold tracking-wide transition-all shadow-lg active:scale-95 group cursor-pointer"
            >
              <Volume2 size={15} className="text-teal-400 group-hover:scale-110 transition-transform" />
              <span>{currentAmbient ? currentAmbient.name : 'No sounds'}</span>
            </button>

            {/* Favorite Star */}
            <button
              onClick={toggleFavorite}
              aria-label="Add to favorites"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Star
                size={22}
                className={isFavorite ? 'text-amber-400 fill-amber-400' : 'text-white/80'}
              />
            </button>
          </div>

          {/* CENTER / HERO: Clean Atmospheric Space */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
            <div className="text-center max-w-md">
              <span className="font-arabic text-3xl md:text-4xl text-amber-300/90 leading-relaxed block drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] font-normal mb-1">
                {currentChapter.name_arabic}
              </span>
              <p className="text-xs text-white/85 tracking-widest uppercase font-medium drop-shadow-md">
                Surah {currentChapter.id} • {currentChapter.verses_count} Verses
              </p>
            </div>
          </div>

          {/* LOWER CONTROL CONSOLE */}
          <div className="relative z-20 shrink-0 px-6 sm:px-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4">
            {/* Playback Error Alert */}
            <ErrorBanner
              error={playbackError}
              onTogglePlayPause={togglePlayPause}
              onSwitchSheikh={handleSwitchSheikh}
            />

            {/* Track & Reciter Info Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20 shadow-lg shrink-0">
                  <ReciterAvatar reciter={reciterFor} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-serif text-white font-bold tracking-tight truncate drop-shadow-md">
                    {currentChapter.name_simple}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium truncate drop-shadow flex items-center gap-2">
                    <span>{currentReciter?.name || 'Reciter'}</span>
                    {fallbackNotice && (
                      <span className="text-[11px] font-normal text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
                        Plays via {fallbackNotice.fallbackReciter.name} (unrecorded surah)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={toggleFavorite}
                className="p-2 text-white/80 hover:text-white transition-colors cursor-pointer"
                aria-label="Toggle favorite"
              >
                <Star
                  size={24}
                  className={isFavorite ? 'text-amber-400 fill-amber-400' : 'text-white/70'}
                />
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
                onChange={(e) => seekTo(parseFloat(e.target.value))}
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
              <button
                onClick={cycleSpeed}
                aria-label={`Playback speed ${playbackRate}x`}
                className="text-xs font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 hover:border-white/30 transition-all min-w-[36px] text-center cursor-pointer"
              >
                {playbackRate}x
              </button>

              <div className="flex items-center gap-5 sm:gap-7">
                <button
                  onClick={playPreviousChapter}
                  aria-label="Previous surah"
                  className="p-2 text-white/90 hover:text-white transition-colors active:scale-95 cursor-pointer"
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
                  className="p-2 text-white/90 hover:text-white transition-colors active:scale-95 cursor-pointer"
                >
                  <SkipForward size={28} className="fill-current" />
                </button>
              </div>

              {/* Sleep Timer */}
              <button
                onClick={() => setShowSleepTimerModal(true)}
                aria-label="Sleep timer"
                className={`p-2 transition-colors cursor-pointer ${
                  sleepTimerMinutes !== null ? 'text-teal-400' : 'text-slate-300 hover:text-white'
                }`}
                title={sleepTimerMinutes ? `Sleep timer: ${sleepTimerMinutes}m` : 'Set sleep timer'}
              >
                <Moon size={22} className={sleepTimerMinutes !== null ? 'fill-teal-400' : ''} />
              </button>
            </div>

            {/* Bottom Utility Tools: Volume, Arabic Verses ('ق'), Download, Soundscapes */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-slate-300">
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-slate-400" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={quranVolume}
                  onChange={(e) => setQuranVolume(parseFloat(e.target.value))}
                  aria-label="Recitation volume"
                  className="w-20 sm:w-28 h-1 accent-teal-400 bg-white/20 rounded-full cursor-pointer"
                />
              </div>

              {/* Arabic Verse Reader Toggle ('ق') */}
              <button
                onClick={() => setShowAyahReader(!showAyahReader)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-arabic text-lg font-bold transition-all cursor-pointer ${
                  showAyahReader
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Read Quran Verses"
              >
                ق
              </button>

              {currentChapter &&
                currentReciter &&
                (!currentReciter.isPartial ||
                  currentReciter.availableSurahs?.includes(currentChapter.id)) && (
                  <SurahDownloadButton
                    chapter={currentChapter}
                    reciter={currentReciter}
                    showText={false}
                  />
                )}

              <button
                onClick={() => setShowSoundModal(true)}
                className="p-2 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Sliders size={18} />
                <span className="hidden sm:inline">Soundscapes</span>
              </button>
            </div>
          </div>

          {/* AMBIENT SOUND SHEET */}
          <AmbientSoundSheet
            isOpen={showSoundModal}
            onClose={() => setShowSoundModal(false)}
            currentAmbient={currentAmbient}
            ambientVolume={ambientVolume}
            onSelectSound={handleSelectSound}
            onVolumeChange={setAmbientVolume}
            customVideos={customVideos}
            activeBackgroundVideoId={activeBackgroundVideoId}
            onSelectVideo={(vidId) => {
              localStorage.setItem('activeBackgroundVideoId', vidId);
              setActiveBackgroundVideoId(vidId);
            }}
            onOpenCredits={() => setShowCreditsModal(true)}
            isPremium={isPremium}
            onRequireUpgrade={() => setShowSubModal(true)}
          />

          {/* MEDIA CREDITS MODAL */}
          <MediaCreditsModal
            isOpen={showCreditsModal}
            onClose={() => setShowCreditsModal(false)}
            videos={customVideos}
          />

          {/* SLEEP TIMER MODAL */}
          <SleepTimerModal
            isOpen={showSleepTimerModal}
            onClose={() => setShowSleepTimerModal(false)}
            selectedMinutes={sleepTimerMinutes}
            onSelectMinutes={handleSetSleepTimer}
            isPremium={isPremium}
            onRequireUpgrade={() => setShowSubModal(true)}
          />

          {/* ARABIC AYAH READER MODAL ('ق') */}
          <AyahReaderSheet
            isOpen={showAyahReader}
            onClose={() => setShowAyahReader(false)}
            chapter={currentChapter}
            reciter={currentReciter}
          />

          {/* SUBSCRIPTION MODAL SOFT PAYWALL */}
          <SubscriptionModal
            isOpen={showSubModal}
            onClose={() => setShowSubModal(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
