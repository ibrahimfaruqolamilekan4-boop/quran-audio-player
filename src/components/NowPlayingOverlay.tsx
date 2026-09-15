import { Fragment, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react';
import {
  AlertCircle,
  ChevronDown,
  FastForward,
  Film,
  Gauge,
  Loader2,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Volume2,
  Wind,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useBackgroundVideoSrc } from '../lib/backgrounds';
import { ayahModeAvailable, versesInSurah } from '../lib/ayah';
import { AMBIENT_TRACKS } from '../lib/constants';
import { ReciterAvatar } from './ReciterAvatar';
import type { Chapter, CustomVideo, Reciter } from '../types';

function formatTime(seconds: number) {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

/**
 * Spotify-style full-screen "Now Playing" overlay.
 * Opened by playing a recitation or expanding the mini bar; dismissed with the
 * chevron, Escape, or a downward swipe. Live ambience (video/track/mixer) is
 * editable while recitation continues underneath.
 */
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
    customVideos,
    activeBackgroundVideoId,
    setActiveBackgroundVideoId,
  } = usePlayer();

  const reduceMotion = useReducedMotion();
  const close = useCallback(() => setNowPlayingOpen(false), [setNowPlayingOpen]);
  const videoSrc = useBackgroundVideoSrc(activeBackgroundVideoId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastPrevTapRef = useRef(0);

  const isOpen = isNowPlayingOpen && Boolean(currentChapter);

  // Escape closes; focus lands on the dialog so keyboard users can act immediately.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // The overlay is a modal surface: freeze scrolling behind it.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!currentChapter) return null;

  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const chapterIndex = chapters.findIndex(c => c.id === currentChapter.id);
  const reciterFor: Pick<Reciter, 'name' | 'imageUrl'> =
    currentReciter ?? { name: 'Reciter', imageUrl: null };

  // Double-tap prev on the same surah restarts it; otherwise prev-surah.
  const handlePreviousTap = () => {
    const now = Date.now();
    if (now - lastPrevTapRef.current < 400) seekTo(0);
    else playPreviousChapter();
    lastPrevTapRef.current = now;
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    setPlaybackRate(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  };

  const videoOptions: CustomVideo[] = customVideos.slice(0, 8);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Now playing"
          tabIndex={-1}
          className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#05070B] outline-none"
          initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          drag={reduceMotion ? false : 'y'}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 140) close();
          }}
        >
          {/* Ambient video layer */}
          <AnimatePresence>
            {videoSrc && (
              <motion.video
                key={videoSrc}
                src={videoSrc}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                muted
                loop
                autoPlay
                playsInline
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.45 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              />
            )}
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#05070B]/95 via-[#05070B]/55 to-[#05070B]/95" />

          {/* Top bar */}
          <div className="relative z-10 flex shrink-0 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              onClick={close}
              aria-label="Minimize player"
              className="rounded-full p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
            >
              <ChevronDown size={26} />
            </button>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                Now Playing
              </p>
              <p className="text-[10px] text-slate-500">
                {chapterIndex >= 0
                  ? `Surah ${chapterIndex + 1} of ${chapters.length || 114}`
                  : ''}
              </p>
            </div>
            <button
              onClick={close}
              aria-label="Close player"
              className="rounded-full p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
            >
              <X size={22} />
            </button>
          </div>

          {/* Hero */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-4">
            <motion.div
              className="relative h-52 w-52 shrink-0 overflow-hidden rounded-[2.5rem] border border-white/10 shadow-[0_0_60px_rgba(45,212,191,0.18)] sm:h-60 sm:w-60"
              animate={isPlaying && !reduceMotion ? { scale: 1.0 } : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 80, damping: 16 }}
            >
              <ReciterAvatar
                reciter={reciterFor}
                className="h-full w-full rounded-none border-0"
                contentClassName="text-5xl"
                iconSize={56}
              />
            </motion.div>

            <div className="max-w-lg text-center">
              <p className="mb-1 font-arabic text-3xl leading-tight text-[#E2B753]">
                {currentChapter.name_arabic}
              </p>
              <h2 className="font-serif text-4xl text-white">
                {currentChapter.name_simple}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {currentChapter.translated_name?.name
                  ? `${currentChapter.translated_name.name} · `
                  : ''}
                {currentChapter.verses_count} verses
                {playMode === 'ayah' && currentAyah && currentAyah.surah === currentChapter.id && (
                  <span className="text-teal-300"> · Ayah {currentAyah.ayah} of {versesInSurah(currentAyah.surah)}</span>
                )}
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-slate-500">
                {currentReciter?.name}
                {currentReciter?.style ? ` · ${currentReciter.style}` : ''}
              </p>
              <div
                className="mt-4 inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-[#131722]/80 p-1 backdrop-blur"
                role="group"
                aria-label="Playback granularity"
              >
                <button
                  type="button"
                  onClick={() => setPlayMode('surah')}
                  aria-pressed={playMode === 'surah'}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest transition ${
                    playMode === 'surah' ? 'bg-teal-500/20 text-teal-200' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Full surah
                </button>
                <button
                  type="button"
                  onClick={() => ayahModeAvailable(currentReciter) && setPlayMode('ayah')}
                  aria-pressed={playMode === 'ayah'}
                  disabled={!ayahModeAvailable(currentReciter)}
                  title={ayahModeAvailable(currentReciter) ? 'Play ayah by ayah' : 'Ayah-by-ayah audio is not available for this reciter'}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    playMode === 'ayah' ? 'bg-teal-500/20 text-teal-200' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Ayah
                </button>
              </div>
            </div>

            {playbackError && (
              <p className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle size={14} />
                {playbackError}
              </p>
            )}
          </div>

          {/* Controls */}
          <div
            className="relative z-10 shrink-0 space-y-5 px-6 pb-4 sm:px-10"
            style={{ touchAction: 'pan-y' }}
          >
            {/* Seek */}
            <div>
              <input
                type="range"
                min={0}
                max={isFinite(duration) ? duration : 0}
                step={0.5}
                value={Math.min(currentTime, duration || 0)}
                onChange={e => seekTo(parseFloat(e.target.value))}
                aria-label="Seek within surah"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
                style={{
                  background: `linear-gradient(to right, #E2B753 ${progressPercent}%, rgba(255,255,255,0.12) ${progressPercent}%)`,
                }}
              />
              <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Transport */}
            <div className="flex items-center justify-center gap-6 sm:gap-8">
              <button
                onClick={skipBackward}
                aria-label="Back 15 seconds"
                className="p-2 text-slate-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
              >
                <Rewind size={22} />
              </button>
              <button
                onClick={handlePreviousTap}
                aria-label={currentAyah ? "Previous ayah" : "Previous surah"}
                className="p-2 text-white transition-colors hover:text-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
              >
                <SkipBack size={30} className="fill-current" />
              </button>
              <button
                onClick={togglePlayPause}
                disabled={isLoading}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white text-[#0A0C10] shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={32} className="fill-current" />
                ) : (
                  <Play size={32} className="ml-1 fill-current" />
                )}
              </button>
              <button
                onClick={playNextChapter}
                aria-label={currentAyah ? "Next ayah" : "Next surah"}
                className="p-2 text-white transition-colors hover:text-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
              >
                <SkipForward size={30} className="fill-current" />
              </button>
              <button
                onClick={skipForward}
                aria-label="Forward 15 seconds"
                className="p-2 text-slate-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
              >
                <FastForward size={22} />
              </button>
            </div>

            {/* Mixer */}
            <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-slate-400">
                <Volume2 size={16} className="shrink-0" />
                <span className="sr-only">Recitation volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={quranVolume}
                  onChange={e => setQuranVolume(parseFloat(e.target.value))}
                  aria-label="Recitation volume"
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10"
                  style={{
                    background: `linear-gradient(to right, #E2B753 ${quranVolume * 100}%, rgba(255,255,255,0.1) ${quranVolume * 100}%)`,
                  }}
                />
              </label>
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-slate-400">
                <Wind size={16} className="shrink-0" />
                <span className="sr-only">Ambient volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={ambientVolume}
                  onChange={e => setAmbientVolume(parseFloat(e.target.value))}
                  disabled={!currentAmbient}
                  aria-label="Ambient volume"
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 disabled:opacity-40"
                  style={{
                    background: `linear-gradient(to right, #60A5FA ${ambientVolume * 100}%, rgba(255,255,255,0.1) ${ambientVolume * 100}%)`,
                  }}
                />
              </label>
              <button
                onClick={cycleSpeed}
                aria-label={`Playback speed ${playbackRate}x`}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 ${
                  playbackRate !== 1
                    ? 'border-teal-400/60 bg-teal-500/15 text-teal-300'
                    : 'border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Gauge size={14} />
                {playbackRate}x
              </button>
            </div>

            {/* Ambient sound chips */}
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <AmbientChip
                selected={!currentAmbient}
                onSelect={() => setAmbientTrack(null)}
              >
                <X size={14} /> Quiet
              </AmbientChip>
              {AMBIENT_TRACKS.map(track => (
                <AmbientChip
                  key={track.id}
                  selected={currentAmbient?.id === track.id}
                  onSelect={() =>
                    setAmbientTrack(
                      currentAmbient?.id === track.id ? null : track
                    )
                  }
                >
                  <track.icon size={14} /> {track.name}
                </AmbientChip>
              ))}
            </div>

            {/* Visual background strip */}
            <div>
              <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                <Film size={12} /> Choose background
              </p>
              <div className="scrollbar-none flex gap-3 overflow-x-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <VideoTile videoId={null} name="None" selected={!activeBackgroundVideoId} onSelect={setActiveBackgroundVideoId} />
                {videoOptions.map(video => (
                  <Fragment key={video.id}>
                    <VideoTile
                      videoId={video.id}
                      name={video.name}
                      selected={activeBackgroundVideoId === video.id}
                      onSelect={setActiveBackgroundVideoId}
                    />
                  </Fragment>
                ))}
                {videoOptions.length === 0 && (
                  <p className="py-2 text-[11px] text-slate-600">
                    No backgrounds added yet — add ambient videos in Settings.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AmbientChip({
  selected,
  onSelect,
  children,
}: {
  key?: string | number;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 ${
        selected
          ? 'border-blue-400/60 bg-blue-500/15 text-blue-300'
          : 'border-white/10 text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function VideoTile({
  videoId,
  name,
  selected,
  onSelect,
}: {
  videoId: string | null;
  name: string;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const src = useBackgroundVideoSrc(videoId);
  return (
    <button
      onClick={() => onSelect(videoId)}
      aria-pressed={selected}
      aria-label={`Background: ${name}`}
      className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 ${
        selected
          ? 'border-teal-400 shadow-[0_0_18px_rgba(45,212,191,0.35)]'
          : 'border-white/10 opacity-70 hover:opacity-100'
      }`}
    >
      {src ? (
        <video
          src={src}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-white/5 text-slate-500">
          {videoId === null ? <X size={18} /> : <Film size={18} />}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[10px] text-slate-200">
        {name}
      </span>
    </button>
  );
}
