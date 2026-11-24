import { Play, Pause, SkipBack, SkipForward, ChevronUp, AlertCircle } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { ReciterAvatar } from './ReciterAvatar';

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Slim mini player ("Medina Emerald")
 * Positioned above mobile bottom navigation with safe-area spacing.
 * Features accent gold main play button (#D4AF37).
 */
export function BottomPlayer() {
  const {
    currentChapter,
    currentReciter,
    currentAmbient,
    isPlaying,
    isLoading,
    playbackError,
    currentTime,
    duration,
    togglePlayPause,
    playNextChapter,
    playPreviousChapter,
    seekTo,
    setNowPlayingOpen,
  } = usePlayer();

  if (!currentChapter) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 md:ml-72 h-20 md:h-28 bg-[var(--bg-primary)] border-t border-[var(--border-color-highlight)] z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.45)] transition-colors">
      {/* Always Visible Progress Bar */}
      <div className="absolute top-0 left-0 w-full -mt-2 group">
        <div className="px-6 md:px-10 flex items-center gap-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 w-full justify-between text-[10px] text-[var(--text-muted)] font-mono tracking-widest z-10 pointer-events-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={e => seekTo(parseFloat(e.target.value))}
          aria-label="Seek within surah"
          className="w-full h-1.5 appearance-none cursor-pointer accent-[#D4AF37] hover:accent-[#E2C04B] transition-all z-20 absolute top-0 block"
          style={{
            padding: 0,
            margin: 0,
            outline: 'none',
            borderRadius: 0,
            background: `linear-gradient(to right, #D4AF37 ${progressPercent}%, var(--border-color-highlight) ${progressPercent}%)`,
          }}
        />
      </div>

      {/* Compact Mini Player */}
      <div
        className="h-20 md:h-28 px-4 md:px-10 flex items-center justify-between cursor-pointer group pt-1"
        onClick={() => setNowPlayingOpen(true)}
      >
        <div className="flex items-center gap-4 sm:gap-5 flex-1 overflow-hidden">
          <div
            className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden flex-shrink-0 border transition-all duration-500 ring-2 ring-[var(--primary-emerald)]/40 ${
              isPlaying ? 'border-[var(--status-success)] shadow-[0_0_20px_rgba(52,195,143,0.3)]' : 'border-[var(--border-color)]'
            }`}
          >
            {currentReciter ? (
              <ReciterAvatar
                reciter={currentReciter}
                className="rounded-none border-0"
                contentClassName="text-xl sm:text-2xl"
                iconSize={20}
              />
            ) : (
              <div className="w-full h-full bg-[var(--bg-surface)] flex items-center justify-center font-serif text-lg font-bold text-[var(--text-primary)]">
                {currentChapter.id}
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-serif text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-wide truncate group-hover:text-[var(--primary-emerald)] transition-colors">
                {currentChapter.name_simple}
              </span>
              <span className="text-xs sm:text-sm font-quran text-[var(--primary-emerald)] opacity-90 hidden sm:inline" dir="rtl">
                {currentChapter.name_arabic}
              </span>
            </div>

            <span className="text-xs text-[var(--text-muted)] font-light flex items-center gap-2 truncate mt-0.5">
              {playbackError ? (
                <>
                  <AlertCircle size={14} className="shrink-0 text-[var(--status-error)]" />
                  <span className="truncate text-[var(--status-error)]">{playbackError}</span>
                </>
              ) : (
                <>
                  <span className="truncate">{currentReciter?.name}</span>
                  {fallbackNotice && (
                    <span className="text-amber-400 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 shrink-0">
                      via {fallbackNotice.fallbackReciter.name}
                    </span>
                  )}
                  {currentAmbient && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-[var(--border-color-highlight)] shrink-0" />
                      <span className="text-[var(--primary-emerald)] flex items-center gap-1.5 opacity-90 shrink-0">
                        <currentAmbient.icon size={12} /> {currentAmbient.name}
                      </span>
                    </>
                  )}
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6" onClick={e => e.stopPropagation()}>
          <button
            onClick={playPreviousChapter}
            aria-label="Previous surah"
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors hidden sm:block cursor-pointer"
          >
            <SkipBack size={22} className="fill-current" />
          </button>

          {/* Reserved Accent Gold Play Button */}
          <button
            onClick={togglePlayPause}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-[#D4AF37] hover:bg-[#E2C04B] text-[#06150F] hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:scale-100 shadow-[0_0_24px_rgba(212,175,55,0.4)] cursor-pointer shrink-0"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-[#06150F]/40 border-t-[#06150F] rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause size={22} className="fill-current" />
            ) : (
              <Play size={22} className="fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={playNextChapter}
            aria-label="Next surah"
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors hidden sm:block cursor-pointer"
          >
            <SkipForward size={22} className="fill-current" />
          </button>

          <button
            onClick={() => setNowPlayingOpen(true)}
            aria-label="Open full-screen player"
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-2 hidden md:block group-hover:text-[var(--primary-emerald)] cursor-pointer"
          >
            <ChevronUp size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
