import React, { useState, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { ReciterAvatar } from '../components/ReciterAvatar';
import {
  Check,
  Search,
  MapPin,
  Play,
  Pause,
  X,
  Radio,
  ImageOff,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  BookOpen,
  WifiOff,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { SurahDownloadButton } from '../components/SurahDownloadButton';
import { isSurahDownloaded } from '../lib/offlineManager';
import type { Reciter } from '../types';

const SECTION_ORDER = [
  'African Masters',
  "Madinah (Prophet's Mosque)",
  "Makkah (Masjid al-Haram)",
  'Classic Masters',
  'Sweet Voices',
];

const COUNTRY_FLAGS: Record<string, string> = {
  Algeria: '🇩🇿',
  Sudan: '🇸🇩',
  'Saudi Arabia': '🇸🇦',
  Egypt: '🇪🇬',
  Morocco: '🇲🇦',
  Ghana: '🇬🇭',
  Yemen: '🇾🇪',
  Kuwait: '🇰🇼',
  Oman: '🇴🇲',
};

function getCountryFlag(region?: string): string {
  if (!region) return '🌍';
  return COUNTRY_FLAGS[region] || '🌍';
}

function getRiwayaShort(style?: string): string {
  if (!style) return "Hafs 'an 'Asim";
  if (style.includes('Warsh')) return "Warsh 'an Nafi'";
  if (style.includes('Duri') || style.includes('Dori')) return 'Al-Duri';
  if (style.includes('Bizi') || style.includes('Ibn Kathir')) return 'Ibn Kathir';
  if (style.includes('Mujawwad')) return 'Mujawwad';
  return "Hafs 'an 'Asim";
}

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
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedRiwaya, setSelectedRiwaya] = useState<string>('All');
  const [selectedReciter, setSelectedReciter] = useState<string | null>(null);
  const [downloadedMap, setDownloadedMap] = useState<Record<number, boolean>>({});
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  React.useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  React.useEffect(() => {
    if (!selectedReciter) return;
    let cancelled = false;
    async function check() {
      const map: Record<number, boolean> = {};
      for (const ch of chapters) {
        if (cancelled) return;
        const dl = await isSurahDownloaded(ch.id, selectedReciter!);
        if (dl) map[ch.id] = true;
      }
      if (!cancelled) setDownloadedMap(map);
    }
    void check();
    const handleChanged = () => {
      void check();
    };
    window.addEventListener('quran-downloads-changed', handleChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('quran-downloads-changed', handleChanged);
    };
  }, [selectedReciter, chapters]);

  // Derive unique countries and riwayat from reciters
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    allReciters.forEach(r => {
      if (r.region) set.add(r.region);
    });
    return Array.from(set).sort();
  }, [allReciters]);

  const availableRiwayat = useMemo(() => {
    const set = new Set<string>();
    allReciters.forEach(r => {
      set.add(getRiwayaShort(r.style));
    });
    return Array.from(set).sort();
  }, [allReciters]);

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

      const matchesCountry = selectedCountry === 'All' || r.region === selectedCountry;

      const matchesRiwaya =
        selectedRiwaya === 'All' || getRiwayaShort(r.style) === selectedRiwaya;

      return matchesSearch && matchesSection && matchesCountry && matchesRiwaya;
    });
  }, [allReciters, query, selectedSection, selectedCountry, selectedRiwaya]);

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

  // Reciter Detail View (114 Surahs & Per-Surah Downloads)
  if (selectedReciter) {
    const reciter = allReciters.find(r => r.id === selectedReciter);
    if (!reciter) return null;
    const active = isActive(reciter);
    const showPause = active && isPlaying && !!currentChapter;

    return (
      <div className="animate-in slide-in-from-right-8 duration-500 pb-24">
        <button
          onClick={() => setSelectedReciter(null)}
          className="text-[#A8BFB3] hover:text-[#F6F1E4] mb-8 text-sm flex items-center gap-2 transition-colors group cursor-pointer"
        >
          <span className="transition-transform group-hover:-translate-x-1">&larr;</span> Back to All Reciters
        </button>

        <div className="relative flex flex-col md:flex-row gap-8 md:gap-12 items-start mb-12 bg-[#0C2A20] p-6 md:p-8 rounded-3xl border border-white/8 backdrop-blur-xl">
          <button
            onClick={() => startPlaying(reciter)}
            title={showPause ? 'Pause' : 'Play'}
            className="group relative shrink-0 w-44 h-56 md:w-56 md:h-72 overflow-hidden rounded-[2rem] shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F8A6A] border-2 border-[#1F8A6A]/40 cursor-pointer"
          >
            <ReciterAvatar
              reciter={reciter}
              className="rounded-none border-0"
              contentClassName="text-5xl"
              iconSize={48}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#06150F] via-[#06150F]/40 to-transparent" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
                  showPause
                    ? 'medina-btn-play scale-105'
                    : 'bg-black/60 text-white backdrop-blur-md group-hover:scale-110 group-hover:bg-[#D4AF37] group-hover:text-[#06150F]'
                }`}
              >
                {showPause ? (
                  <Pause size={28} className="fill-current" />
                ) : (
                  <Play size={28} className="fill-current ml-1" />
                )}
              </div>
            </div>

            {active && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-[#1F8A6A] text-white text-[10px] font-bold tracking-wide flex items-center gap-1.5 shadow-md">
                <Radio size={12} className="animate-pulse" /> ACTIVE
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="px-3.5 py-1 rounded-full bg-[#11382B] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold tracking-wider flex items-center gap-1.5">
                <span>{getCountryFlag(reciter.region)}</span>
                <span>{reciter.region || 'International'}</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-[#11382B] text-[#A8BFB3] text-xs font-medium">
                {getRiwayaShort(reciter.style)}
              </span>
              {reciter.location && (
                <span className="text-xs text-[#A8BFB3] flex items-center gap-1">
                  <MapPin size={12} className="text-[#1F8A6A]" />
                  {reciter.location}
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-5xl font-serif font-bold text-[#F6F1E4] tracking-tight">
              {reciter.name}
            </h1>

            {reciter.nameArabic && (
              <p className="text-2xl md:text-3xl font-quran text-[#34C38F] mt-2 font-medium" dir="rtl">
                {reciter.nameArabic}
              </p>
            )}

            {reciter.bio && (
              <div className="mt-5 max-w-2xl text-xs sm:text-sm text-[#A8BFB3] leading-relaxed bg-[#06150F]/60 p-4 rounded-2xl border border-white/5 space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
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
                className={`px-8 py-3 rounded-2xl font-semibold transition-all shadow-lg cursor-pointer ${
                  active
                    ? 'bg-[#1F8A6A]/20 text-[#34C38F] border border-[#1F8A6A]/40 shadow-none cursor-default'
                    : 'medina-btn-primary'
                }`}
              >
                {active ? 'Currently Selected' : 'Set as Active Reciter'}
              </button>

              {reciter.imageCredit && (
                <a
                  href={reciter.imageCredit}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl bg-[#11382B] hover:bg-[#176B53] border border-white/8 text-xs text-[#A8BFB3] hover:text-[#F6F1E4] flex items-center gap-1.5 transition-colors"
                >
                  <ShieldCheck size={14} className="text-[#34C38F]" />
                  <span>Photo: {reciter.imageLicense || 'Wikimedia Commons'}</span>
                  <ExternalLink size={12} className="opacity-60" />
                </a>
              )}
            </div>

            <div className="mt-4 text-[11px] text-[#A8BFB3]/60 font-mono truncate max-w-xl">
              CDN Source: {reciter.serverUrl}
            </div>
          </div>
        </div>

        {/* 114 Surahs Section with per-surah download button */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-[#F6F1E4] tracking-wide">
              114 Surahs
              {currentChapter && (
                <span className="ml-3 text-sm font-normal text-[#34C38F]">
                  · now playing {currentChapter.name_simple}
                </span>
              )}
            </h3>
            <span className="text-xs text-[#A8BFB3]">Click any surah to stream directly from this reciter</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {chapters.map(chapter => {
              const playingThis = active && currentChapter?.id === chapter.id;
              const isDl = Boolean(downloadedMap[chapter.id]);
              const isUnavail = !isOnline && !isDl;

              return (
                <div
                  key={chapter.id}
                  onClick={() => {
                    if (isUnavail) {
                      setOfflineNotice(
                        `Surah ${chapter.name_simple} is not downloaded for ${reciter.name}. Connect to internet to stream.`
                      );
                      setTimeout(() => setOfflineNotice(null), 4000);
                      return;
                    }
                    playChapter(chapter, reciter);
                    if (!active) setReciter(reciter);
                  }}
                  className={`group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isUnavail
                      ? 'opacity-40 cursor-not-allowed bg-[#06150F]/40 border-white/5'
                      : playingThis
                      ? 'bg-[#1F8A6A]/20 border-[#1F8A6A]/60 text-[#34C38F] shadow-md cursor-pointer'
                      : 'bg-[#0C2A20]/60 border-white/8 hover:bg-[#11382B] hover:border-[#1F8A6A]/40 text-[#F6F1E4] cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono opacity-40 group-hover:opacity-100 transition-opacity">
                      {String(chapter.id).padStart(3, '0')}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-serif text-sm sm:text-base truncate group-hover:text-[#34C38F] transition-colors">
                          {chapter.name_simple}
                        </span>
                        {isDl && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#34C38F]/15 text-[#34C38F] text-[9px] font-medium shrink-0">
                            <CheckCircle2 size={10} />
                            <span>Downloaded</span>
                          </span>
                        )}
                        {isUnavail && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/40 text-[#A8BFB3] text-[9px] font-medium shrink-0">
                            <WifiOff size={9} />
                            <span>Offline</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#A8BFB3] truncate">{chapter.translated_name.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span
                      className="text-sm font-quran text-[#A8BFB3] group-hover:text-[#34C38F] transition-colors hidden sm:inline"
                      dir="rtl"
                    >
                      {chapter.name_arabic}
                    </span>
                    <div onClick={e => e.stopPropagation()}>
                      <SurahDownloadButton chapter={chapter} reciter={reciter} />
                    </div>
                    <div
                      className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 transition-opacity ${
                        playingThis ? 'opacity-100 bg-[#D4AF37] text-[#06150F]' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {playingThis && isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
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

  // Sheikh Hub Main Grid View
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Search & Header */}
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-[#F6F1E4] tracking-tight">
              Reciters Sanctuary
            </h2>
            <p className="text-[#A8BFB3] mt-2 font-light text-base md:text-lg">
              Explore authentic voices across Africa, the Holy Mosques, and classical masters.
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8BFB3]" size={18} />
            <input
              type="text"
              placeholder="Search by name, country, or Arabic..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0C2A20] border border-white/8 rounded-2xl py-3.5 pl-12 pr-11 text-[#F6F1E4] placeholder-[#A8BFB3]/60 focus:outline-none focus:border-[#1F8A6A] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[#A8BFB3] hover:text-[#F6F1E4] transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Sticky Filter Chips Bar */}
        <div className="sticky top-[calc(60px+env(safe-area-inset-top,0px))] md:top-14 z-30 bg-[#06150F]/90 backdrop-blur-xl py-3 border-y border-white/8 space-y-2 -mx-4 px-4 sm:-mx-8 sm:px-8">
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {['All', ...SECTION_ORDER, ...(customReciters.length > 0 ? ['Custom'] : [])].map(sec => {
              const isSecActive = selectedSection === sec;
              return (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSecActive
                      ? 'bg-[#1F8A6A] text-white shadow-md shadow-[#1F8A6A]/25'
                      : 'bg-[#0C2A20] text-[#A8BFB3] hover:bg-[#11382B] border border-white/8 hover:text-[#F6F1E4]'
                  }`}
                >
                  {sec === 'African Masters' ? '🌍 African Masters' : sec}
                </button>
              );
            })}
          </div>

          {/* Country & Riwaya Sub-Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[#A8BFB3]/60 font-semibold uppercase tracking-wider text-[10px] shrink-0">
              Filter by:
            </span>

            {/* Country Pills */}
            <button
              onClick={() => setSelectedCountry('All')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCountry === 'All'
                  ? 'bg-[#D4AF37] text-[#06150F] font-bold'
                  : 'bg-white/5 text-[#A8BFB3] hover:text-[#F6F1E4]'
              }`}
            >
              All Countries
            </button>

            {availableCountries.map(country => (
              <button
                key={country}
                onClick={() => setSelectedCountry(country)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCountry === country
                    ? 'bg-[#D4AF37] text-[#06150F] font-bold'
                    : 'bg-white/5 text-[#A8BFB3] hover:text-[#F6F1E4]'
                }`}
              >
                <span>{getCountryFlag(country)}</span>
                <span>{country}</span>
              </button>
            ))}

            <span className="text-white/10 shrink-0">|</span>

            {/* Riwaya Pills */}
            <button
              onClick={() => setSelectedRiwaya('All')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedRiwaya === 'All'
                  ? 'bg-[#34C38F] text-[#06150F] font-bold'
                  : 'bg-white/5 text-[#A8BFB3] hover:text-[#F6F1E4]'
              }`}
            >
              All Riwayat
            </button>

            {availableRiwayat.map(riwaya => (
              <button
                key={riwaya}
                onClick={() => setSelectedRiwaya(riwaya)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedRiwaya === riwaya
                    ? 'bg-[#34C38F] text-[#06150F] font-bold'
                    : 'bg-white/5 text-[#A8BFB3] hover:text-[#F6F1E4]'
                }`}
              >
                {riwaya}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Reciters Grid */}
      {filteredReciters.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-24 text-[#A8BFB3]">
          <ImageOff size={32} className="mb-4 opacity-60 text-[#A8BFB3]" />
          <p className="text-[#F6F1E4] font-medium text-lg">No reciter matches your filters.</p>
          <p className="text-sm mt-1 text-[#A8BFB3]">Try searching by English or Arabic name, or reset filters.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSection('All');
              setSelectedCountry('All');
              setSelectedRiwaya('All');
            }}
            className="mt-6 px-6 py-2.5 rounded-xl bg-[#11382B] hover:bg-[#176B53] text-[#F6F1E4] text-sm font-medium transition-colors cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        groupedSections.map(group => (
          <div key={group.title} className="mb-14">
            <div className="flex items-center justify-between mb-6 pl-1">
              <h3 className="text-lg font-serif font-semibold text-[#F6F1E4] tracking-wide flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34C38F] shadow-[0_0_10px_rgba(52,195,143,0.6)]" />
                {group.title}
                <span className="text-xs font-normal text-[#A8BFB3]">({group.reciters.length})</span>
              </h3>
              <div className="h-px bg-white/8 flex-1 ml-4" />
            </div>

            {/* Sheikh Cards with Large Circular Portrait, Emerald Ring, Country Flag & Riwaya */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {group.reciters.map(reciter => {
                const selected = isActive(reciter);
                const flag = getCountryFlag(reciter.region);
                const riwaya = getRiwayaShort(reciter.style);

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
                    className={`group medina-card p-4 sm:p-5 flex flex-col items-center text-center cursor-pointer relative overflow-hidden transition-all duration-300 ${
                      selected
                        ? 'border-[#1F8A6A] bg-[#0C2A20] shadow-[0_0_24px_rgba(31,138,106,0.3)] ring-1 ring-[#1F8A6A]'
                        : 'bg-[#0C2A20]/80 border-white/8 hover:border-[#1F8A6A]/50 hover:bg-[#11382B]'
                    }`}
                  >
                    {/* Top Badges */}
                    <div className="w-full flex items-center justify-between mb-3 pointer-events-none">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-[#06150F]/70 text-[#A8BFB3] border border-white/5 flex items-center gap-1 font-mono">
                        <span>{flag}</span>
                        <span className="truncate max-w-[65px]">{reciter.region || 'World'}</span>
                      </span>

                      {reciter.featured && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF37] text-[#06150F] flex items-center gap-1 shadow-sm">
                          <Sparkles size={9} />
                        </span>
                      )}
                    </div>

                    {/* Circular Portrait with Emerald Ring */}
                    <div className="relative my-2">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-3 ring-[#1F8A6A] p-0.5 bg-[#0C2A20] shadow-xl overflow-hidden transition-transform duration-300 group-hover:scale-105">
                        <ReciterAvatar
                          reciter={reciter}
                          className="rounded-full border-0"
                          shape="circle"
                          contentClassName="text-3xl"
                          iconSize={28}
                        />
                      </div>

                      {selected && (
                        <span className="absolute bottom-0 right-1 bg-[#D4AF37] text-[#06150F] p-1.5 rounded-full shadow-lg">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>

                    {/* Name & Arabic Info */}
                    <div className="mt-3 w-full space-y-1">
                      <h4 className="font-serif text-sm sm:text-base font-bold text-[#F6F1E4] leading-tight line-clamp-1 group-hover:text-[#34C38F] transition-colors">
                        {reciter.name}
                      </h4>

                      {reciter.nameArabic && (
                        <p className="text-xs font-quran text-[#34C38F] truncate" dir="rtl">
                          {reciter.nameArabic}
                        </p>
                      )}

                      {/* Riwaya Badge */}
                      <div className="pt-1">
                        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#1F8A6A]/15 text-[#A8BFB3] border border-[#1F8A6A]/20">
                          {riwaya}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
