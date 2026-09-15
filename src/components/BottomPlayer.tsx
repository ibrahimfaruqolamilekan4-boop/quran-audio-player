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
 * Slim mini player. Full controls (mixer, ambient, backgrounds, speed) live in
 * the NowPlayingOverlay — tapping anywhere on the bar opens it.
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
    setNowPlayingOpen
  } = usePlayer();

  if (!currentChapter) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 md:ml-72 h-28 bg-[#0A0C10]/90 backdrop-blur-3xl border-t border-white/5 z-50">

      {/* Always Visible Progress Bar */}
      <div className="absolute top-0 left-0 w-full -mt-2 group">
        <div className="px-6 md:px-10 flex items-center gap-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 w-full justify-between text-[10px] text-slate-400 font-mono tracking-widest z-10 pointer-events-none">
           <span>{formatTime(currentTime)}</span>
           <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          aria-label="Seek within surah"
          className="w-full h-1.5 appearance-none cursor-pointer accent-teal-500 hover:accent-teal-400 transition-all z-20 absolute top-0 block"
          style={{
            padding: 0, margin: 0, outline: 'none', borderRadius: 0,
            background: `linear-gradient(to right, #E2B753 ${progressPercent}%, #151921 ${progressPercent}%)`
          }}
        />
      </div>

      {/* Compact Mini Player */}
      <div
        className="h-28 px-6 md:px-10 flex items-center justify-between cursor-pointer group pt-1"
        onClick={() => setNowPlayingOpen(true)}
      >
        <div className="flex items-center gap-5 flex-1 overflow-hidden">
          <div
            className={`relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border transition-all duration-500 ${
              isPlaying ? 'border-teal-400/50 shadow-[0_0_24px_rgba(45,212,191,0.28)]' : 'border-white/10'
            }`}
          >
            <ReciterAvatar
              reciter={currentReciter ?? { name: '' }}
              className="rounded-none border-0"
              contentClassName="text-lg"
              iconSize={20}
            />
            <span className="absolute bottom-0 right-0 px-1.5 py-0.5 rounded-tl-lg bg-black/70 backdrop-blur-sm text-teal-300 text-[10px] font-mono leading-none">
              {currentChapter.id}
            </span>
          </div>

          <div className="flex flex-col overflow-hidden whitespace-nowrap">
            <span className="text-white font-serif text-xl truncate group-hover:text-teal-400 transition-colors">
              {currentChapter.name_simple}
            </span>
            <span className={`text-sm truncate flex items-center gap-2 font-light tracking-wide ${playbackError ? 'text-red-400' : 'text-slate-400'}`}>
              {playbackError ? (
                <>
                  <AlertCircle size={14} className="shrink-0" />
                  {/* Without this the player just sits there and looks frozen. */}
                  <span className="truncate">{playbackError}</span>
                </>
              ) : (
                <>
                  {currentReciter?.name}
                  {currentAmbient && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-blue-400 flex items-center gap-1.5 opacity-90">
                        <currentAmbient.icon size={12} /> {currentAmbient.name}
                      </span>
                    </>
                  )}
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-8" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={playPreviousChapter}
            aria-label="Previous surah"
            className="p-2 text-slate-500 hover:text-white transition-colors hidden sm:block"
          >
            <SkipBack size={24} className="fill-current" />
          </button>

          <button
            onClick={togglePlayPause}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className={`w-14 h-14 flex items-center justify-center rounded-full bg-white text-[#0A0C10] hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:scale-100 shadow-[0_0_30px_rgba(255,255,255,0.15)]`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0A0C10] rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause size={24} className="fill-current" />
            ) : (
              <Play size={24} className="fill-current ml-1" />
            )}
          </button>

          <button
            onClick={playNextChapter}
            aria-label="Next surah"
            className="p-2 text-slate-500 hover:text-white transition-colors hidden sm:block"
          >
            <SkipForward size={24} className="fill-current" />
          </button>

          <button
            onClick={() => setNowPlayingOpen(true)}
            aria-label="Open full-screen player"
            className="p-2 text-slate-600 hover:text-white transition-colors ml-4 hidden md:block group-hover:text-teal-500"
          >
            <ChevronUp size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
