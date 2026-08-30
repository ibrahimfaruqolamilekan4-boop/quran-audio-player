import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronUp, ChevronDown, ListMusic, Maximize2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BottomPlayer() {
  const {
    currentChapter,
    currentReciter,
    currentAmbient,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    togglePlayPause,
    playNextChapter,
    playPreviousChapter,
    seekTo,
    quranVolume,
    ambientVolume,
    setQuranVolume,
    setAmbientVolume
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);

  if (!currentChapter) return null;
  
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`fixed bottom-0 left-0 right-0 md:ml-64 bg-slate-950/80 backdrop-blur-3xl border-t border-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 ${expanded ? 'h-[28rem]' : 'h-24'}`}>
      
      {/* Top Progress Bar (Mini Player) */}
      {!expanded && (
        <div 
          className="absolute top-0 left-0 h-1 bg-slate-800 w-full cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const newTime = (clickX / rect.width) * duration;
            seekTo(newTime);
          }}
        >
          <div className="h-full bg-emerald-500 transition-all duration-100 ease-linear relative group-hover:bg-emerald-400" style={{ width: `${progressPercent}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2" />
          </div>
        </div>
      )}

      {/* Compact Mini Player */}
      <div 
        className="h-24 px-6 md:px-10 flex items-center justify-between cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-5 flex-1 overflow-hidden">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-lg ${isPlaying ? 'shadow-emerald-500/20' : ''} transition-all duration-500`}>
            <span className="text-black font-bold text-xl">{currentChapter.id}</span>
          </div>
          
          <div className="flex flex-col overflow-hidden whitespace-nowrap">
            <span className="text-white font-semibold text-lg truncate group-hover:text-emerald-400 transition-colors">
              {currentChapter.name_simple}
            </span>
            <span className="text-slate-400 text-sm truncate flex items-center gap-2">
              {currentReciter?.name}
              {currentAmbient && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span className="text-blue-400 flex items-center gap-1">
                    <currentAmbient.icon size={12} /> {currentAmbient.name}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-8" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={playPreviousChapter}
            className="p-2 text-slate-400 hover:text-white transition-colors hidden sm:block"
          >
            <SkipBack size={24} className="fill-current" />
          </button>
          
          <button 
            onClick={togglePlayPause}
            disabled={isLoading}
            className={`w-14 h-14 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_0_20px_rgba(255,255,255,0.1)]`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-slate-300 border-t-black rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause size={24} className="fill-current" />
            ) : (
              <Play size={24} className="fill-current ml-1" />
            )}
          </button>
          
          <button 
            onClick={playNextChapter}
            className="p-2 text-slate-400 hover:text-white transition-colors hidden sm:block"
          >
            <SkipForward size={24} className="fill-current" />
          </button>
          
          <button className="p-2 text-slate-500 hover:text-white transition-colors ml-4 hidden md:block">
            <Maximize2 size={20} />
          </button>
        </div>
      </div>

      {/* Expanded Controls (Dual Mixer & Large Scrubber) */}
      <div className={`px-10 pt-4 pb-12 transition-all duration-500 ${expanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        <div className="max-w-3xl mx-auto space-y-12">
          
          {/* Main Scrubber */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400 tracking-widest">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ListMusic size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Recitation</h4>
                  <p className="text-xs text-slate-400">{currentReciter?.name}</p>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={quranVolume}
                onChange={(e) => setQuranVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className={`space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5 transition-all ${!currentAmbient ? 'opacity-50 grayscale' : ''}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentAmbient ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                  {currentAmbient ? <currentAmbient.icon size={16} /> : <Volume2 size={16} />}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Ambient Layer</h4>
                  <p className="text-xs text-slate-400">{currentAmbient ? currentAmbient.name : 'No ambient track selected'}</p>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={ambientVolume}
                onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                disabled={!currentAmbient}
                className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
