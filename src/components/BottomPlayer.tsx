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
    <div className={`fixed bottom-0 left-0 right-0 md:ml-64 bg-[#0A0C10]/90 backdrop-blur-3xl border-t border-white/5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 ${expanded ? 'h-[28rem]' : 'h-28'}`}>
      
      {/* Always Visible Progress Bar */}
      <div className={`absolute top-0 left-0 w-full -mt-2 group ${expanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
          className="w-full h-1.5 appearance-none cursor-pointer accent-gold-500 hover:accent-gold-400 transition-all z-20 absolute top-0 block"
          style={{ 
            padding: 0, margin: 0, outline: 'none', borderRadius: 0,
            background: `linear-gradient(to right, #E2B753 ${progressPercent}%, #151921 ${progressPercent}%)`
          }}
        />
      </div>

      {/* Compact Mini Player */}
      <div 
        className="h-28 px-6 md:px-10 flex items-center justify-between cursor-pointer group pt-1"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-5 flex-1 overflow-hidden">
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center flex-shrink-0 shadow-lg ${isPlaying ? 'shadow-[0_0_20px_rgba(226,183,83,0.3)]' : ''} transition-all duration-500`}>
            <span className="text-[#050608] font-bold text-xl font-serif">{currentChapter.id}</span>
          </div>
          
          <div className="flex flex-col overflow-hidden whitespace-nowrap">
            <span className="text-white font-serif text-xl truncate group-hover:text-gold-400 transition-colors">
              {currentChapter.name_simple}
            </span>
            <span className="text-slate-400 text-sm truncate flex items-center gap-2 font-light tracking-wide">
              {currentReciter?.name}
              {currentAmbient && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="text-blue-400 flex items-center gap-1.5 opacity-90">
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
            className="p-2 text-slate-500 hover:text-white transition-colors hidden sm:block"
          >
            <SkipBack size={24} className="fill-current" />
          </button>
          
          <button 
            onClick={togglePlayPause}
            disabled={isLoading}
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
            className="p-2 text-slate-500 hover:text-white transition-colors hidden sm:block"
          >
            <SkipForward size={24} className="fill-current" />
          </button>
          
          <button className="p-2 text-slate-600 hover:text-white transition-colors ml-4 hidden md:block group-hover:text-gold-500">
            {expanded ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </button>
        </div>
      </div>

      {/* Expanded Controls */}
      <div className={`px-10 pt-4 pb-12 transition-all duration-700 ease-out ${expanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        <div className="max-w-3xl mx-auto space-y-12">
          
          {/* Main Scrubber */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 tracking-widest font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-gold-500 hover:accent-gold-400 transition-all"
              style={{ background: `linear-gradient(to right, #E2B753 ${progressPercent}%, #151921 ${progressPercent}%)` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6 bg-[#11141A] p-8 rounded-[2rem] border border-white/5 shadow-2xl">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-500 flex items-center justify-center border border-gold-500/20">
                  <ListMusic size={18} />
                </div>
                <div>
                  <h4 className="text-base font-serif text-white tracking-wide">Recitation Volume</h4>
                  <p className="text-xs text-slate-500 font-light mt-0.5">{currentReciter?.name}</p>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={quranVolume}
                onChange={(e) => setQuranVolume(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-gold-500"
                style={{ background: `linear-gradient(to right, #E2B753 ${quranVolume * 100}%, #1A1F29 ${quranVolume * 100}%)` }}
              />
            </div>

            <div className={`space-y-6 bg-[#11141A] p-8 rounded-[2rem] border border-white/5 shadow-2xl transition-all duration-500 ${!currentAmbient ? 'opacity-50 grayscale' : ''}`}>
              <div className="flex items-center gap-4 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${currentAmbient ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-[#151921] text-slate-600 border-white/5'}`}>
                  {currentAmbient ? <currentAmbient.icon size={18} /> : <Volume2 size={18} />}
                </div>
                <div>
                  <h4 className="text-base font-serif text-white tracking-wide">Ambient Layer</h4>
                  <p className="text-xs text-slate-500 font-light mt-0.5">{currentAmbient ? currentAmbient.name : 'No ambient track selected'}</p>
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
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-500"
                style={{ background: `linear-gradient(to right, #3B82F6 ${ambientVolume * 100}%, #1A1F29 ${ambientVolume * 100}%)` }}
              />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
