import React, { useState, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { ReciterAvatar } from '../components/ReciterAvatar';
import { Check, Search, MapPin, Play, Pause, X, Radio, ImageOff, ExternalLink, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';
import type { Reciter } from '../types';

const SECTION_ORDER = [
  "Madinah (Prophet's Mosque)",
  "Makkah (Masjid al-Haram)",
  "Classic Masters",
  "Sweet Voices"
];

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
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [selectedReciter, setSelectedReciter] = useState<string | null>(null);

  const query = searchQuery.trim().toLowerCase();

  const filteredReciters = useMemo(() => {
    return allReciters.filter(r => {
      const matchesSearch =
        !query ||
        r.name.toLowerCase().includes(query) ||
        (r.nameArabic || '').includes(query) ||
        (r.category || '').toLowerCase().includes(query) ||
        (r.region || '').toLowerCase().includes(query) ||
        (r.location || '').toLowerCase().includes(query) ||
        r.style.toLowerCase().includes(query);

      const matchesSection =
        selectedSection === 'All' ||
        (r.category && r.category.toLowerCase().includes(selectedSection.toLowerCase())) ||
        (!r.category && selectedSection === 'Custom');

      return matchesSearch && matchesSection;
    });
  }, [allReciters, query, selectedSection]);

  // Group reciters into ordered sections
  const groupedSections = useMemo(() => {
    const groups: { title: string; reciters: Reciter[] }[] = [];

    SECTION_ORDER.forEach(secTitle => {
      const inSec = filteredReciters.filter(r => r.category === secTitle);
      if (inSec.length > 0) {
        groups.push({ title: secTitle, reciters: inSec });
      }
    });

    // Custom or uncategorized
    const remaining = filteredReciters.filter(
      r => !r.category || !SECTION_ORDER.includes(r.category)
    );
    if (remaining.length > 0) {
      groups.push({ title: 'Community & Custom Reciters', reciters: remaining });
    }

    return groups;
  }, [filteredReciters]);

  const isActive = (reciter: Reciter) => currentReciter?.id === reciter.id;

  const startPlaying = (reciter: Reciter) => {
    if (isActive(reciter) && currentChapter) {
      togglePlayPause();
      return;
    }
    const chapter = currentChapter ?? chapters[0];
    if (!chapter) return;
    setReciter(reciter);
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
          className="text-slate-400 hover:text-white mb-8 text-sm flex items-center gap-2 transition-colors group"
        >
          <span className="transition-transform group-hover:-translate-x-1">&larr;</span> Back to All Reciters
        </button>

        <div className="relative flex flex-col md:flex-row gap-8 md:gap-12 items-start mb-12 bg-[#0b1320]/60 p-6 md:p-8 rounded-3xl border border-slate-800/80 backdrop-blur-xl">
          <button
            onClick={() => startPlaying(reciter)}
            title={showPause ? 'Pause' : 'Play'}
            className="group relative shrink-0 w-44 h-56 md:w-56 md:h-72 overflow-hidden rounded-[2rem] shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 border border-slate-700/60"
          >
            <ReciterAvatar
              reciter={reciter}
              className="rounded-none border-0"
              contentClassName="text-5xl"
              iconSize={48}
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-16 h-16 rounded-full bg-teal-500 text-black flex items-center justify-center shadow-[0_0_30px_rgba(20,184,166,0.45)] opacity-95 group-hover:scale-110 transition-transform duration-300">
                {showPause ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-1" />}
              </span>
            </span>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] font-semibold text-white/90">
              {active ? (showPause ? 'Now playing' : 'Paused') : 'Listen Now'}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {reciter.category && (
                <span className="px-3 py-1 bg-teal-500/15 text-teal-300 rounded-full text-xs font-semibold border border-teal-500/30 tracking-wide flex items-center gap-1.5">
                  <Sparkles size={12} className="text-teal-400" />
                  {reciter.category}
                </span>
              )}
              <span className="px-3 py-1 bg-slate-800/80 text-slate-300 rounded-full text-xs font-medium border border-slate-700 tracking-wide">
                {reciter.style}
              </span>
              <span className="px-3 py-1 bg-slate-800/80 text-slate-300 rounded-full text-xs font-medium border border-slate-700 tracking-wide">
                {reciter.region || 'Custom'}
              </span>
              {active && (
                <span className="px-3 py-1 bg-teal-500 text-black rounded-full text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-md">
                  <Radio size={12} className="animate-pulse" /> Active reciter
                </span>
              )}
            </div>

            <h2 className="text-3xl md:text-5xl font-serif text-white tracking-tight mb-1">{reciter.name}</h2>
            {reciter.nameArabic && (
              <h3 className="text-2xl md:text-3xl font-amiri text-teal-400/90 font-bold mb-3" dir="rtl">
                {reciter.nameArabic}
              </h3>
            )}

            {reciter.location && (
              <p className="text-slate-400 font-light flex items-center gap-2 text-sm mb-4">
                <MapPin size={15} className="text-teal-500" /> {reciter.location}, {reciter.region}
              </p>
            )}

            {reciter.bio && (
              <div className="my-5 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 text-sm leading-relaxed">
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-400 mb-1.5 uppercase tracking-wider">
                  <BookOpen size={13} />
                  Biography & Background
                </div>
                <p>{reciter.bio}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                onClick={() => setReciter(reciter)}
                disabled={active}
                className={`px-8 py-3 rounded-2xl font-semibold transition-all shadow-lg ${
                  active
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40 shadow-teal-500/10 cursor-default'
                    : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/20'
                }`}
              >
                {active ? 'Currently Selected' : 'Set as Active Reciter'}
              </button>

              {reciter.imageCredit && (
                <a
                  href={reciter.imageCredit}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
                  title="View photo source and license on Wikimedia Commons"
                >
                  <ShieldCheck size={14} className="text-teal-400" />
                  <span>Photo: {reciter.imageLicense || 'Wikimedia Commons'}</span>
                  <ExternalLink size={12} className="opacity-60" />
                </a>
              )}

              {!reciter.imageUrl && (
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
                  <ImageOff size={13} />
                  Placeholder avatar (uploadable in Admin)
                </span>
              )}
            </div>

            <div className="mt-4 text-[11px] text-slate-500 font-mono truncate max-w-xl">
              CDN Source: {reciter.serverUrl}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-white tracking-wide">
              114 Surahs
              {currentChapter && (
                <span className="ml-3 text-sm font-normal text-teal-400/80">· now playing {currentChapter.name_simple}</span>
              )}
            </h3>
            <span className="text-xs text-slate-500">Click any surah to stream directly from this reciter</span>
          </div>

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
                      ? 'bg-teal-500/15 border-teal-500/50 text-teal-300 shadow-md'
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
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-amiri text-slate-400 group-hover:text-teal-400 transition-colors" dir="rtl">
                      {chapter.name_arabic}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 transition-opacity ${
                        playingThis ? 'opacity-100 bg-teal-500/20' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {playingThis && isPlaying ? (
                        <Pause size={14} className="text-teal-300 fill-current" />
                      ) : (
                        <Play size={14} className="text-white fill-current ml-0.5" />
                      )}
                    </div>
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
      <header className="mb-8 space-y-6 sticky top-0 bg-[#030712]/90 backdrop-blur-3xl pt-6 pb-6 z-20 border-b border-slate-800/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Reciters</h2>
            <p className="text-slate-400 text-sm mt-2">
              {filteredReciters.length} of {allReciters.length} qurra available
              {currentReciter && (
                <>
                  {' · '}
                  <span className="text-teal-400 font-medium">{currentReciter.name}</span> active
                </>
              )}
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search in English or Arabic (e.g. نورين)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0F172A]/70 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-11 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/60 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Section Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
          {['All', ...SECTION_ORDER, ...(customReciters.length > 0 ? ['Custom'] : [])].map(sec => {
            const isSecActive = selectedSection === sec;
            return (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSecActive
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800 hover:text-white'
                }`}
              >
                {sec}
              </button>
            );
          })}
        </div>
      </header>

      {filteredReciters.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
          <ImageOff size={32} className="mb-4 opacity-60 text-slate-400" />
          <p className="text-white font-medium text-lg">No reciter matches “{searchQuery}”.</p>
          <p className="text-sm mt-1 text-slate-400">Try searching by English or Arabic name, mosque, or country.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSection('All');
            }}
            className="mt-6 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        groupedSections.map(group => {
          return (
            <div key={group.title} className="mb-14">
              <div className="flex items-center justify-between mb-6 pl-1">
                <h3 className="text-base font-semibold text-slate-200 tracking-wide flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.6)]" />
                  {group.title}
                  <span className="text-xs font-normal text-slate-500">({group.reciters.length})</span>
                </h3>
                <div className="h-px bg-slate-800/80 flex-1 ml-4" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {group.reciters.map(reciter => {
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
                          ? 'border-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.25)] ring-1 ring-teal-500/50'
                          : 'border-slate-800/80 hover:border-slate-600 bg-slate-900/30'
                      }`}
                    >
                      <ReciterAvatar
                        reciter={reciter}
                        className="rounded-none border-0"
                        contentClassName="text-4xl"
                        iconSize={32}
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                        {reciter.featured ? (
                          <span className="bg-amber-400/90 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                            <Sparkles size={10} /> Featured
                          </span>
                        ) : (
                          <span />
                        )}
                        {selected && (
                          <span className="bg-teal-500 text-black p-1 rounded-full shadow-lg">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>

                      {/* Bottom Info */}
                      <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col justify-end">
                        <span className="text-white font-serif text-base font-bold leading-tight group-hover:text-teal-300 transition-colors line-clamp-1">
                          {reciter.name}
                        </span>

                        {reciter.nameArabic && (
                          <span className="text-xs font-amiri text-teal-400/90 font-medium mt-0.5 truncate" dir="rtl">
                            {reciter.nameArabic}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1.5">
                          <MapPin size={11} className="text-teal-400 shrink-0" />
                          <span className="truncate">{reciter.location || reciter.region}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
