import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { Search, Play, Pause, AlignLeft, CheckCircle2, Sparkles, WifiOff } from 'lucide-react';
import { isSurahDownloaded } from '../lib/offlineManager';
import { SurahDownloadButton } from '../components/SurahDownloadButton';
import { SubscriptionModal } from '../components/SubscriptionModal';
import type { Chapter } from '../types';

export function SurahLibraryView() {
  const { chapters, playChapter, currentChapter, currentReciter, allReciters, isPlaying, togglePlayPause } = usePlayer();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [downloadedMap, setDownloadedMap] = useState<Record<number, boolean>>({});
  const [showSubModal, setShowSubModal] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeReciter = currentReciter || allReciters[0];

  // Refresh download status map for the active reciter
  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      if (!activeReciter) return;
      const statusObj: Record<number, boolean> = {};
      for (const ch of chapters) {
        if (cancelled) return;
        const exists = await isSurahDownloaded(ch.id, activeReciter.id);
        if (exists) statusObj[ch.id] = true;
      }
      if (!cancelled) setDownloadedMap(statusObj);
    }

    void checkStatus();

    const handleDownloadsChanged = () => {
      void checkStatus();
    };

    window.addEventListener('quran-downloads-changed', handleDownloadsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('quran-downloads-changed', handleDownloadsChanged);
    };
  }, [chapters, activeReciter]);

  const handleRowClick = (chapter: Chapter) => {
    const isDownloaded = Boolean(downloadedMap[chapter.id]);

    // Offline guard: if offline and not downloaded, show clear message
    if (!isOnline && !isDownloaded) {
      setOfflineNotice(`Surah ${chapter.name_simple} is not downloaded. Connect to the internet to listen.`);
      setTimeout(() => setOfflineNotice(null), 4000);
      return;
    }

    if (currentChapter?.id === chapter.id) {
      togglePlayPause();
    } else {
      playChapter(chapter, activeReciter);
    }
  };

  const filteredChapters = chapters.filter(c =>
    c.name_simple.toLowerCase().includes(search.toLowerCase()) ||
    c.translated_name.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toString() === search
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Offline Alert Toast */}
      {offlineNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-amber-950/95 border border-amber-500/40 text-amber-200 shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-4">
          <WifiOff size={16} className="text-amber-400 shrink-0" />
          <span>{offlineNotice}</span>
        </div>
      )}

      <header className="mb-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-white tracking-tight">Surah Library</h2>
              {!isOnline && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
                  <WifiOff size={13} /> Offline Mode
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm sm:text-base font-light max-w-2xl">
              {activeReciter ? (
                <>Recitation by <span className="text-teal-400 font-medium">{activeReciter.name}</span>. Listen online or download for offline playback.</>
              ) : (
                'Browse the complete Noble Quran. Listen online or download for zero-internet offline listening.'
              )}
            </p>
          </div>

          {!user?.is_premium && (
            <button
              type="button"
              onClick={() => setShowSubModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-500/40 text-teal-300 text-xs font-semibold tracking-wide transition-all shrink-0 cursor-pointer shadow-[0_0_20px_rgba(20,184,166,0.15)]"
            >
              <Sparkles size={14} className="text-teal-400" />
              <span>Unlock Offline Downloads</span>
            </button>
          )}
        </div>

        <div className="relative group max-w-2xl">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search e.g. Al-Kahf or 18..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0F172A] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500/40 focus:bg-[#161A22] transition-all text-base shadow-inner"
          />
        </div>
      </header>

      <div className="bg-[#0D1017] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        {filteredChapters.map((chapter, index) => {
          const isCurrent = currentChapter?.id === chapter.id;
          const isDownloaded = Boolean(downloadedMap[chapter.id]);
          const isUnavailableOffline = !isOnline && !isDownloaded;

          return (
            <div
              key={chapter.id}
              onClick={() => handleRowClick(chapter)}
              className={`flex items-center gap-4 sm:gap-6 p-4 sm:p-5 transition-all group ${
                index !== filteredChapters.length - 1 ? 'border-b border-white/5' : ''
              } ${
                isUnavailableOffline
                  ? 'opacity-40 cursor-not-allowed bg-transparent'
                  : isCurrent
                  ? 'bg-teal-500/10 cursor-pointer'
                  : 'hover:bg-white/[0.02] cursor-pointer'
              }`}
            >
              {/* Play / Index Button */}
              <div
                className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all shadow-inner shrink-0 ${
                  isCurrent
                    ? 'bg-teal-500 text-[#0A0C10] shadow-[0_0_20px_rgba(20,184,166,0.3)]'
                    : 'bg-[#0F172A] text-slate-400 group-hover:bg-[#1E293B]'
                }`}
              >
                {isCurrent && isPlaying ? (
                  <Pause size={18} className="fill-current" />
                ) : isCurrent && !isPlaying ? (
                  <Play size={18} className="fill-current ml-0.5" />
                ) : (
                  <span className="font-medium text-sm">{chapter.id}</span>
                )}
              </div>

              {/* Title & Info */}
              <div className="flex-1 flex justify-between items-center min-w-0">
                <div className="space-y-0.5 truncate">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-base sm:text-lg font-serif tracking-wide truncate ${
                        isCurrent ? 'text-teal-300' : 'text-slate-200 group-hover:text-white'
                      }`}
                    >
                      {chapter.name_simple}
                    </h4>

                    {/* Downloaded Badge */}
                    {isDownloaded && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-medium shrink-0">
                        <CheckCircle2 size={11} />
                        <span className="hidden sm:inline">Downloaded</span>
                      </span>
                    )}

                    {/* Offline Unavailable Badge */}
                    {isUnavailableOffline && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 text-[10px] font-medium shrink-0">
                        <WifiOff size={10} />
                        <span>Not downloaded</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 font-light truncate">
                    <span className="truncate">{chapter.translated_name.name}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700 shrink-0" />
                    <span className="flex items-center gap-1.5 shrink-0">
                      <AlignLeft size={13} /> {chapter.verses_count} Verses
                    </span>
                  </div>
                </div>

                {/* Arabic Name & Action */}
                <div className="flex items-center gap-4 shrink-0 pl-2">
                  <span className={`text-2xl sm:text-3xl font-arabic leading-relaxed ${isCurrent ? 'text-teal-400' : 'text-teal-500/80'}`}>
                    {chapter.name_arabic}
                  </span>

                  {/* Download Action Button */}
                  {activeReciter && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <SurahDownloadButton chapter={chapter} reciter={activeReciter} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredChapters.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-[#0F172A] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
              <Search size={28} />
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-1 font-serif">No results found</h3>
            <p className="text-slate-500 text-sm font-light">Try searching for a different surah name or number.</p>
          </div>
        )}
      </div>

      {/* Subscription Paywall Modal */}
      <SubscriptionModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        onSuccess={() => setShowSubModal(false)}
      />
    </div>
  );
}
