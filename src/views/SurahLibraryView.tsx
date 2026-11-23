import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { Search, Play, Pause, AlignLeft, CheckCircle2, Sparkles, WifiOff } from 'lucide-react';
import { isSurahDownloaded } from '../lib/offlineManager';
import { isSurahAvailable } from '../lib/audio';
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
    // Availability guard: if this reciter did not record this surah
    if (activeReciter && !isSurahAvailable(activeReciter, chapter.id)) {
      const fallbackId = activeReciter.fallbackReciterId || 'afs';
      const fallback =
        allReciters.find(r => r.id === fallbackId) ||
        allReciters.find(r => r.id === 'afs');
      if (!fallback || !isSurahAvailable(fallback, chapter.id)) {
        setOfflineNotice(`Surah ${chapter.name_simple} was not recorded by ${activeReciter.name}. Please select another reciter.`);
        setTimeout(() => setOfflineNotice(null), 4000);
        return;
      }
    }

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
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--text-primary)] tracking-tight">Surah Library</h2>
              {!isOnline && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium">
                  <WifiOff size={13} /> Offline Mode
                </span>
              )}
            </div>
            <p className="text-[var(--text-secondary)] text-sm sm:text-base font-normal max-w-2xl">
              {activeReciter ? (
                <>Recitation by <span className="text-[var(--primary-emerald)] font-semibold">{activeReciter.name}</span>. Listen online or download for offline playback.</>
              ) : (
                'Browse the complete Noble Quran. Listen online or download for zero-internet offline listening.'
              )}
            </p>
            {activeReciter?.isPartial && (
              <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold text-[10px] uppercase tracking-wide shrink-0">
                    Partial ({activeReciter.surahCount || 0}/114)
                  </span>
                  <span className="truncate">
                    Sheikh {activeReciter.name} recorded {activeReciter.surahCount || 0} surahs. Unrecorded surahs stream via fallback reciter.
                  </span>
                </div>
              </div>
            )}
          </div>

          {!user?.is_premium && (
            <button
              type="button"
              onClick={() => setShowSubModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--primary-subtle)] hover:opacity-90 border border-[var(--primary-emerald)]/40 text-[var(--primary-emerald)] text-xs font-semibold tracking-wide transition-all shrink-0 cursor-pointer shadow-sm"
            >
              <Sparkles size={14} className="text-[var(--primary-emerald)]" />
              <span>Unlock Offline Downloads</span>
            </button>
          )}
        </div>

        <div className="relative group max-w-2xl">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary-emerald)] transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search e.g. Al-Kahf or 18..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-color-highlight)] rounded-2xl py-4 pl-14 pr-6 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-emerald)] transition-all text-base shadow-sm"
          />
        </div>
      </header>

      <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-color)] overflow-hidden shadow-xl">
        {filteredChapters.map((chapter, index) => {
          const isCurrent = currentChapter?.id === chapter.id;
          const isRecorded = isSurahAvailable(activeReciter, chapter.id);
          const isDownloaded = isRecorded && Boolean(downloadedMap[chapter.id]);
          const isUnavailableOffline = !isOnline && !isDownloaded;
          const isDisabled = !isRecorded || isUnavailableOffline;

          return (
            <div
              key={chapter.id}
              onClick={() => handleRowClick(chapter)}
              className={`flex items-center gap-4 sm:gap-6 p-4 sm:p-5 transition-all group ${
                index !== filteredChapters.length - 1 ? 'border-b border-[var(--border-color)]' : ''
              } ${
                !isRecorded
                  ? 'opacity-40 cursor-not-allowed bg-transparent'
                  : isUnavailableOffline
                  ? 'opacity-45 cursor-not-allowed bg-transparent'
                  : isCurrent
                  ? 'bg-[var(--primary-subtle)] cursor-pointer'
                  : 'hover:bg-[var(--bg-surface-raised)]/60 cursor-pointer'
              }`}
            >
              {/* Play / Index Button */}
              <div
                className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${
                  isCurrent
                    ? 'bg-[var(--primary-emerald)] text-white shadow-[0_0_20px_rgba(20,184,166,0.25)]'
                    : isDisabled
                    ? 'bg-[var(--bg-surface-raised)]/60 text-[var(--text-muted)]'
                    : 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]'
                }`}
              >
                {isCurrent && isPlaying ? (
                  <Pause size={18} className="fill-current" />
                ) : isCurrent && !isPlaying ? (
                  <Play size={18} className="fill-current ml-0.5" />
                ) : (
                  <span className="font-semibold text-sm">{chapter.id}</span>
                )}
              </div>

              {/* Title & Info */}
              <div className="flex-1 flex justify-between items-center min-w-0">
                <div className="space-y-0.5 truncate">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-base sm:text-lg font-serif tracking-wide truncate ${
                        !isRecorded
                          ? 'text-[var(--text-muted)]'
                          : isCurrent
                          ? 'text-[var(--primary-emerald)] font-semibold'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {chapter.name_simple}
                    </h4>

                    {!isRecorded && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/20 text-amber-300 text-[10px] font-medium shrink-0">
                        <span>Fallback stream</span>
                      </span>
                    )}
                    {/* Downloaded Badge */}
                    {isRecorded && isDownloaded && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-[var(--primary-emerald)] text-[10px] font-medium shrink-0">
                        <CheckCircle2 size={11} />
                        <span className="hidden sm:inline">Downloaded</span>
                      </span>
                    )}

                    {/* Not Recorded Badge */}
                    {!isRecorded && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface-raised)] text-[var(--text-muted)] text-[10px] font-medium shrink-0">
                        <span>Not recorded</span>
                      </span>
                    )}

                    {/* Offline Unavailable Badge */}
                    {isRecorded && isUnavailableOffline && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface-raised)] text-[var(--text-muted)] text-[10px] font-medium shrink-0">
                        <WifiOff size={10} />
                        <span>Not downloaded</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs sm:text-sm text-[var(--text-muted)] font-normal truncate">
                    <span className="truncate">{chapter.translated_name.name}</span>
                    <span className="w-1 h-1 rounded-full bg-[var(--border-color-highlight)] shrink-0" />
                    <span className="flex items-center gap-1.5 shrink-0">
                      <AlignLeft size={13} /> {chapter.verses_count} Verses
                    </span>
                  </div>
                </div>

                {/* Arabic Name & Action */}
                <div className="flex items-center gap-4 shrink-0 pl-2">
                  <span className={`text-2xl sm:text-3xl font-arabic leading-relaxed ${!isRecorded ? 'text-[var(--text-muted)]' : 'text-[var(--primary-emerald)]'}`}>
                    {chapter.name_arabic}
                  </span>

                  {/* Download Action Button */}
                  {activeReciter && isRecorded && (
                    <div onClick={(e) => e.stopPropagation()}>
                      {isRecorded ? (
                        <SurahDownloadButton chapter={chapter} reciter={activeReciter} />
                      ) : (
                        <span className="text-[10px] text-slate-500 italic px-1 hidden sm:inline">Unrecorded</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredChapters.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-[var(--bg-surface-raised)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--text-muted)]">
              <Search size={28} />
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1 font-serif">No results found</h3>
            <p className="text-[var(--text-muted)] text-sm font-normal">Try searching for a different surah name or number.</p>
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
