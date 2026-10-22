import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { Search, Play, Pause, AlignLeft, Download, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { downloadSurah, isSurahDownloaded } from '../lib/offlineManager';
import { SubscriptionModal } from '../components/SubscriptionModal';
import type { Chapter } from '../types';

export function SurahLibraryView() {
  const { chapters, playChapter, currentChapter, currentReciter, allReciters, isPlaying, togglePlayPause } = usePlayer();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [downloadedMap, setDownloadedMap] = useState<Record<number, boolean>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<number, number>>({});
  const [showSubModal, setShowSubModal] = useState(false);

  const activeReciter = currentReciter || allReciters[0];

  // Check offline download status for visible chapters
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
    checkStatus();
    return () => { cancelled = true; };
  }, [chapters, activeReciter]);

  const handleDownloadClick = async (chapter: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user?.is_premium) {
      setShowSubModal(true);
      return;
    }

    if (!activeReciter) return;
    if (downloadedMap[chapter.id]) return; // already downloaded

    try {
      setDownloadProgress(prev => ({ ...prev, [chapter.id]: 1 }));
      await downloadSurah(chapter, activeReciter, (pct) => {
        setDownloadProgress(prev => ({ ...prev, [chapter.id]: pct }));
      });
      setDownloadedMap(prev => ({ ...prev, [chapter.id]: true }));
    } catch (err: any) {
      console.error('Download error:', err);
      alert(err?.message || 'Download failed. Please check your connection.');
    } finally {
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[chapter.id];
        return next;
      });
    }
  };

  const filteredChapters = chapters.filter(c => 
    c.name_simple.toLowerCase().includes(search.toLowerCase()) || 
    c.translated_name.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toString() === search
  );

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-14 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-2">Surah Library</h2>
            <p className="text-slate-400 text-base font-light max-w-2xl">
              Browse the complete Noble Quran. Listen online or download for zero-internet offline listening.
            </p>
          </div>

          {!user?.is_premium && (
            <button
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
            placeholder="Search e.g. Al-Kahf or 18" 
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
          const currentProgress = downloadProgress[chapter.id];
          const isDownloading = currentProgress !== undefined;
          
          return (
            <div 
              key={chapter.id}
              onClick={() => isCurrent ? togglePlayPause() : playChapter(chapter)}
              className={`flex items-center gap-4 sm:gap-6 p-4 sm:p-6 cursor-pointer transition-all group ${
                index !== filteredChapters.length - 1 ? 'border-b border-white/5' : ''
              } ${
                isCurrent 
                  ? 'bg-teal-500/10' 
                  : 'hover:bg-white/[0.02]'
              }`}
            >
              {/* Play / Index Button */}
              <div className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all shadow-inner shrink-0 ${
                isCurrent ? 'bg-teal-500 text-[#0A0C10] shadow-[0_0_20px_rgba(20,184,166,0.3)]' : 'bg-[#0F172A] text-slate-400 group-hover:bg-[#1E293B]'
              }`}>
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
                    <h4 className={`text-lg sm:text-xl font-serif tracking-wide truncate ${isCurrent ? 'text-teal-300' : 'text-slate-200 group-hover:text-white'}`}>
                      {chapter.name_simple}
                    </h4>
                    {isDownloaded && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-medium shrink-0">
                        <CheckCircle2 size={11} />
                        <span className="hidden sm:inline">Offline</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 font-light truncate">
                    <span className="truncate">{chapter.translated_name.name}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700 shrink-0" />
                    <span className="flex items-center gap-1.5 shrink-0"><AlignLeft size={13}/> {chapter.verses_count} Verses</span>
                  </div>
                </div>
                
                {/* Arabic Name & Action */}
                <div className="flex items-center gap-4 shrink-0 pl-2">
                  <span className={`text-2xl sm:text-3xl font-arabic leading-relaxed ${isCurrent ? 'text-teal-400' : 'text-teal-500/80'}`}>
                    {chapter.name_arabic}
                  </span>

                  {/* Download Action Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDownloadClick(chapter, e)}
                    disabled={isDownloading}
                    title={
                      isDownloaded 
                        ? 'Downloaded for offline listening' 
                        : isDownloading 
                        ? `Downloading... ${currentProgress}%` 
                        : 'Download for offline listening (Premium)'
                    }
                    className={`p-2.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                      isDownloaded
                        ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                        : isDownloading
                        ? 'text-teal-400 bg-teal-500/15'
                        : 'text-slate-500 hover:text-teal-300 hover:bg-slate-800/80'
                    }`}
                  >
                    {isDownloading ? (
                      <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-teal-300">
                        <Loader2 size={15} className="animate-spin text-teal-400" />
                        <span>{currentProgress}%</span>
                      </div>
                    ) : isDownloaded ? (
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    ) : (
                      <Download size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredChapters.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-[#0F172A] rounded-full flex items-center justify-center mx-auto mb-6 text-slate-600">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-medium text-slate-300 mb-2 font-serif">No results found</h3>
            <p className="text-slate-500 font-light">Try searching for a different surah name or number.</p>
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
