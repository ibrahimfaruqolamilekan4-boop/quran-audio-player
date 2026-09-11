import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { ReciterAvatar } from '../components/ReciterAvatar';
import { Check, Search, MapPin, Play, Pause, X, Radio, ImageOff } from 'lucide-react';
import type { Reciter } from '../types';

export function RecitersHubView() {
  const {
    currentReciter,
    setReciter,
    chapters,
    currentChapter,
    isPlaying,
    playChapter,
    togglePlayPause,
    customReciters,
    allReciters,
  } = usePlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReciter, setSelectedReciter] = useState<string | null>(null);

  const query = searchQuery.trim().toLowerCase();
  const filteredReciters = allReciters.filter(
    r =>
      !query ||
      r.name.toLowerCase().includes(query) ||
      (r.region || '').toLowerCase().includes(query) ||
      r.style.toLowerCase().includes(query)
  );

  const regions = Array.from(new Set(filteredReciters.map(r => r.region || 'Custom/Global')));
  const isActive = (reciter: Reciter) => currentReciter?.id === reciter.id;

  const startPlaying = (reciter: Reciter) => {
    if (isActive(reciter) && currentChapter) {
      togglePlayPause();
      return;
    }
    const chapter = currentChapter ?? chapters[0];
    if (!chapter) return;
    setReciter(reciter);
    // Pass the reciter explicitly: `currentReciter` state has not committed yet,
    // so reading it inside playChapter would stream from the previously active sheikh.
    playChapter(chapter, reciter);
  };

  if (selectedReciter) {
    const reciter = allReciters.find(r => r.id === selectedReciter);
    if (!reciter) return null;

    const active = isActive(reciter);
    const showPause = active && isPlaying && !!currentChapter;

    return (
      <div className="animate-in slide-in-from-right-8 duration-500 pb-20">
        <button
          onClick={() => setSelectedReciter(null)}
          className="text-slate-400 hover:text-white mb-8 text-sm flex items-center gap-2 transition-colors"
        >
          &larr; Back to Reciters
        </button>

        <div className="relative flex flex-col md:flex-row gap-8 md:gap-12 items-start mb-12">
          <button
            onClick={() => startPlaying(reciter)}
            title={showPause ? 'Pause' : 'Play'}
            className="group relative shrink-0 w-40 h-52 md:w-52 md:h-64 overflow-hidden rounded-[2rem] shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            <ReciterAvatar
              reciter={reciter}
              className="rounded-none border-0"
              contentClassName="text-5xl"
              iconSize={40}
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-14 h-14 rounded-full bg-teal-500 text-black flex items-center justify-center shadow-[0_0_30px_rgba(20,184,166,0.45)] opacity-90 group-hover:scale-110 transition-transform duration-300">
                {showPause ? <Pause size={22} className="fill-current" /> : <Play size={22} className="fill-current ml-1" />}
              </span>
            </span>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] text-white/70">
              {active ? (showPause ? 'Now playing' : 'Paused') : 'Play'}
            </span>
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 bg-teal-500/10 text-teal-400 rounded-full text-xs font-medium border border-teal-500/20 tracking-wide">
                {reciter.style}
              </span>
              <span className="px-3 py-1 bg-slate-800/50 text-slate-300 rounded-full text-xs font-medium border border-slate-700 tracking-wide">
                {reciter.region || 'Custom'}
              </span>
              {active && (
                <span className="px-3 py-1 bg-teal-500 text-black rounded-full text-xs font-semibold tracking-wide flex items-center gap-1.5">
                  <Radio size={12} /> Active reciter
                </span>
              )}
            </div>

            <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-3">{reciter.name}</h2>
            {reciter.location && (
              <p className="text-slate-400 font-light flex items-center gap-2">
                <MapPin size={16} /> {reciter.location}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setReciter(reciter)}
                disabled={active}
                className={`px-8 py-3 rounded-2xl font-medium transition-all shadow-lg ${
                  active
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-teal-500/10 cursor-default'
                    : 'bg-white text-black hover:bg-slate-200'
                }`}
              >
                {active ? 'Currently Selected' : 'Set as Active Reciter'}
              </button>
              <span className="text-xs text-slate-500 max-w-sm break-all">{reciter.serverUrl}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-medium text-white mb-6 tracking-wide">
            114 Surahs
            {currentChapter && (
              <span className="ml-3 text-sm font-normal text-teal-400/80">· now on {currentChapter.name_simple}</span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {chapters.map(chapter => {
              const playingThis = active && currentChapter?.id === chapter.id;
              return (
                <div
                  key={chapter.id}
                  onClick={() => {
                    playChapter(chapter, reciter);
                    if (!active) setReciter(reciter);
                  }}
                  className={`group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                    playingThis
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                      : 'bg-[#0F172A]/40 border-slate-800/50 hover:bg-[#1E293B]/60 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-sm font-mono opacity-40 group-hover:opacity-100 transition-opacity">
                      {String(chapter.id).padStart(3, '0')}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-serif text-base truncate group-hover:text-teal-400 transition-colors">
                        {chapter.name_simple}
                      </span>
                      <span className="text-xs text-slate-500 truncate">{chapter.translated_name.name}</span>
                    </div>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 transition-opacity ${
                      playingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {playingThis && isPlaying ? (
                      <Pause size={14} className="text-teal-300 fill-current" />
                    ) : (
                      <Play size={14} className="text-white fill-current ml-0.5" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-700">
      <header className="mb-10 space-y-6 sticky top-0 bg-[#030712]/80 backdrop-blur-3xl pt-6 pb-6 z-20 border-b border-slate-800/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Reciters</h2>
            <p className="text-slate-500 text-sm mt-2">
              {filteredReciters.length} of {allReciters.length} qurra
              {currentReciter && (
                <>
                  {' · '}
                  <span className="text-teal-400">{currentReciter.name}</span> active
                </>
              )}
            </p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by name, region, style..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0F172A]/50 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-11 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {filteredReciters.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
          <ImageOff size={28} className="mb-4 opacity-60" />
          <p className="text-white font-medium">No reciter matches “{searchQuery}”.</p>
          <p className="text-sm mt-1">Try a city (Mecca, Medina), a country, or a recitation style.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            Clear search
          </button>
        </div>
      ) : (
        regions.map(region => {
          const regionReciters = filteredReciters.filter(r => (r.region || 'Custom/Global') === region);
          if (regionReciters.length === 0) return null;

          return (
            <div key={region} className="mb-14">
              <h3 className="text-sm font-semibold text-slate-500 mb-6 uppercase tracking-[0.2em] pl-2 flex items-center gap-3">
                {region}
                <div className="h-px bg-slate-800 flex-1 ml-4" />
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {regionReciters.map(reciter => {
                  const selected = isActive(reciter);
                  return (
                    <div
                      key={reciter.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedReciter(reciter.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedReciter(reciter.id);
                        }
                      }}
                      className={`group relative flex flex-col overflow-hidden rounded-3xl aspect-[3/4] cursor-pointer border transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                        selected
                          ? 'border-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.2)]'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <ReciterAvatar
                        reciter={reciter}
                        className="absolute inset-0 rounded-none border-0"
                        contentClassName="text-4xl"
                        iconSize={34}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/40 to-transparent" />

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          startPlaying(reciter);
                        }}
                        title={selected && isPlaying ? `Pause ${reciter.name}` : `Play ${reciter.name}`}
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 focus:opacity-100 transition-all duration-300 hover:bg-teal-500 hover:text-black"
                      >
                        {selected && isPlaying ? (
                          <Pause size={14} className="fill-current" />
                        ) : (
                          <Play size={14} className="fill-current ml-0.5" />
                        )}
                      </button>

                      {selected && (
                        <div className="absolute bottom-0 right-0 bg-teal-500 text-black p-2 rounded-tl-2xl shadow-lg">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}

                      <div className="relative mt-auto p-4 text-left">
                        <h4
                          className={`font-serif leading-snug tracking-wide line-clamp-2 ${
                            selected ? 'text-teal-300' : 'text-white'
                          }`}
                        >
                          {reciter.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                          <span className="truncate">{reciter.style}</span>
                          {reciter.region && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                              <span className="truncate">{reciter.region}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <p className="text-[11px] text-slate-600 pt-4 border-t border-slate-800/50">
        Reciter photos courtesy of{' '}
        <a
          href="https://commons.wikimedia.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-400 transition-colors"
        >
          Wikimedia Commons
        </a>
        .
      </p>
    </div>
  );
}
