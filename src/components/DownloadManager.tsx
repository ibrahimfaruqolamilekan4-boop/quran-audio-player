import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  Trash2,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Disc3,
  RefreshCw,
  Download,
  Lock,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  getDownloadedSurahsGroupedByReciter,
  deleteDownloadedSurah,
  deleteAllDownloads,
  getStorageQuotaEstimate,
  formatFileSize,
  requestPersistentStorage,
  downloadSurah,
  FREE_DOWNLOAD_LIMIT,
  type DownloadedSurah,
} from '../lib/offlineManager';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { ALL_SURAHS } from '../lib/surahs';
import { isSurahAvailable } from '../lib/audio';
import { SubscriptionModal } from './SubscriptionModal';
import type { Reciter } from '../types';

interface ReciterDownloadGroup {
  reciterName: string;
  reciterPhoto?: string;
  surahs: DownloadedSurah[];
  totalBytes: number;
}

export function DownloadManager() {
  const { playChapter, currentChapter, isPlaying, allReciters, setReciter } = usePlayer();
  const { user, isPremium } = useAuth();

  const [groups, setGroups] = useState<Record<string, ReciterDownloadGroup>>({});
  const [quota, setQuota] = useState<{
    usedBytes: number;
    quotaBytes: number;
    percentUsed: number;
    isPersistent: boolean;
  }>({
    usedBytes: 0,
    quotaBytes: 0,
    percentUsed: 0,
    isPersistent: false,
  });
  const [loading, setLoading] = useState(true);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  // Batch download state for "Download Entire Reciter"
  const [batchReciterId, setBatchReciterId] = useState<string | null>(null);
  const [batchCurrentSurah, setBatchCurrentSurah] = useState<number | null>(null);
  const [batchTotalSurahs, setBatchTotalSurahs] = useState<number>(0);
  const [batchCompletedCount, setBatchCompletedCount] = useState<number>(0);
  const batchCancelledRef = useRef<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [grouped, q] = await Promise.all([
        getDownloadedSurahsGroupedByReciter(),
        getStorageQuotaEstimate(),
      ]);
      setGroups(grouped as Record<string, ReciterDownloadGroup>);
      setQuota(q);
    } catch (e) {
      console.warn('Failed to load downloads data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    const handleEvent = () => {
      void loadData();
    };

    window.addEventListener('quran-downloads-changed', handleEvent);
    return () => {
      window.removeEventListener('quran-downloads-changed', handleEvent);
    };
  }, []);

  const groupList = Object.values(groups) as ReciterDownloadGroup[];
  const totalBytesAll = groupList.reduce((acc, g) => acc + (g.totalBytes || 0), 0);
  const totalCountAll = groupList.reduce((acc, g) => acc + (g.surahs?.length || 0), 0);

  const handleDeleteOne = async (surahId: number, reciterId: string, moshafId?: string) => {
    await deleteDownloadedSurah(surahId, reciterId, moshafId);
    await loadData();
  };

  const handleDeleteAll = async () => {
    await deleteAllDownloads();
    setConfirmDeleteAll(false);
    await loadData();
  };

  const handlePlaySurah = (item: DownloadedSurah) => {
    const chapterObj = ALL_SURAHS.find((s) => s.id === item.surahId);
    if (!chapterObj) return;

    const fullReciter = allReciters.find((r) => r.id === item.reciterId);
    if (fullReciter) {
      setReciter(fullReciter);
      playChapter(chapterObj, fullReciter);
    } else {
      playChapter(chapterObj);
    }
  };

  const handleRequestPersistence = async () => {
    const granted = await requestPersistentStorage();
    if (granted) {
      setQuota((prev) => ({ ...prev, isPersistent: true }));
    }
  };

  // Download entire reciter logic
  const handleDownloadEntireReciter = async (reciter: Reciter) => {
    if (!isPremium) {
      setShowSubModal(true);
      return;
    }

    const availableSurahList = ALL_SURAHS.filter((s) => isSurahAvailable(reciter, s.id));
    const alreadyDownloadedSet = new Set(
      (groups[reciter.id]?.surahs || []).map((s) => s.surahId)
    );
    const surahsToDownload = availableSurahList.filter((s) => !alreadyDownloadedSet.has(s.id));

    if (surahsToDownload.length === 0) return;

    batchCancelledRef.current = false;
    setBatchReciterId(reciter.id);
    setBatchTotalSurahs(surahsToDownload.length);
    setBatchCompletedCount(0);

    for (let i = 0; i < surahsToDownload.length; i++) {
      if (batchCancelledRef.current) break;
      const chapter = surahsToDownload[i];
      setBatchCurrentSurah(chapter.id);

      try {
        await downloadSurah(chapter, reciter, user);
      } catch (e: any) {
        if (e?.message === 'UPGRADE_REQUIRED') {
          setShowSubModal(true);
          break;
        }
      }
      setBatchCompletedCount(i + 1);
    }

    setBatchReciterId(null);
    setBatchCurrentSurah(null);
    await loadData();
  };

  const handleCancelBatch = () => {
    batchCancelledRef.current = true;
    setBatchReciterId(null);
    setBatchCurrentSurah(null);
  };

  return (
    <div className="bg-[#0A0F1D]/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
      {/* Top Header & Tier Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 flex items-center justify-center text-teal-400">
              <HardDrive size={18} />
            </div>
            <h3 className="text-xl font-serif font-semibold text-white tracking-wide">
              Downloaded Surahs & Storage
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-light">
            {totalCountAll} surah{totalCountAll !== 1 ? 's' : ''} saved offline (
            {formatFileSize(totalBytesAll)})
            {quota.quotaBytes > 0 && ` · ${quota.percentUsed}% of device storage used`}
          </p>
        </div>

        {totalCountAll > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {confirmDeleteAll ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                >
                  Confirm Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-all cursor-pointer border border-rose-500/20"
              >
                <Trash2 size={14} />
                <span>Delete All</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Free vs Premium Download Allowance Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isPremium ? 'bg-amber-500/20 text-amber-400' : 'bg-teal-500/20 text-teal-300'
            }`}
          >
            {isPremium ? <Sparkles size={20} /> : <HardDrive size={20} />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>{isPremium ? 'Premium Unlimited Offline Storage' : 'Free Tier Offline Downloads'}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  isPremium
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-white/10 text-slate-300'
                }`}
              >
                {isPremium ? 'Active (₦500)' : `${totalCountAll} / ${FREE_DOWNLOAD_LIMIT} Surahs`}
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {isPremium
                ? 'Download complete 114-surah reciters and listen anytime with zero internet data.'
                : 'Free tier allows up to 3 downloaded surahs. Upgrade for ₦500 to download unlimited surahs.'}
            </p>
          </div>
        </div>

        {!isPremium && (
          <button
            type="button"
            onClick={() => setShowSubModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
          >
            Upgrade to Unlimited (₦500)
          </button>
        )}
      </div>

      {/* Persistence status notice */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className="flex items-center gap-2.5">
          {quota.isPersistent ? (
            <ShieldCheck size={16} className="text-teal-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
          )}
          <span className="text-slate-300">
            {quota.isPersistent
              ? 'Persistent storage granted (browser will preserve your offline files)'
              : 'Standard storage active. Click Protect to prevent browser cache auto-eviction.'}
          </span>
        </div>
        {!quota.isPersistent && (
          <button
            type="button"
            onClick={handleRequestPersistence}
            className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[11px] font-semibold transition-colors shrink-0 ml-2 cursor-pointer"
          >
            Protect
          </button>
        )}
      </div>

      {/* Batch Downloading Banner */}
      {batchReciterId && (
        <div className="p-4 rounded-2xl bg-teal-950/50 border border-teal-500/40 flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <RefreshCw size={20} className="animate-spin text-teal-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">
                Downloading Reciter: {batchCompletedCount} of {batchTotalSurahs} surahs completed
                {batchCurrentSurah && ` (Surah ${batchCurrentSurah})`}
              </p>
              <div className="w-48 sm:w-64 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-teal-400 transition-all duration-300"
                  style={{
                    width: `${Math.round((batchCompletedCount / (batchTotalSurahs || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelBatch}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Empty State */}
      {totalCountAll === 0 && !loading && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-3 text-slate-600">
            <HardDrive size={24} />
          </div>
          <h4 className="text-base font-serif font-medium text-slate-300 mb-1">
            No downloaded surahs yet
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-light">
            Go to any reciter or the Surah Library and tap the Download button next to any surah to
            save it for offline listening.
          </p>
        </div>
      )}

      {/* Reciter Groups */}
      <div className="space-y-6">
        {(Object.entries(groups) as [string, ReciterDownloadGroup][]).map(([reciterId, group]) => {
          const matchedReciter = allReciters.find((r) => r.id === reciterId);

          return (
            <div
              key={reciterId}
              className="bg-slate-900/40 rounded-2xl p-4 sm:p-5 border border-slate-800/60 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                  {group.reciterPhoto ? (
                    <img
                      src={group.reciterPhoto}
                      alt={group.reciterName}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center text-teal-400">
                      <Disc3 size={18} />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-white tracking-wide">
                      {group.reciterName}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {group.surahs.length} surah{group.surahs.length !== 1 ? 's' : ''} saved ·{' '}
                      {formatFileSize(group.totalBytes)}
                    </p>
                  </div>
                </div>

                {matchedReciter && (
                  <button
                    type="button"
                    onClick={() => handleDownloadEntireReciter(matchedReciter)}
                    disabled={batchReciterId === reciterId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 self-start sm:self-center"
                  >
                    <Download size={13} />
                    <span>Download Entire Reciter</span>
                    {!isPremium && <Lock size={11} className="text-amber-400 ml-1" />}
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-800/40">
                {group.surahs.map((surah) => {
                  const isThisPlaying = currentChapter?.id === surah.surahId && isPlaying;

                  return (
                    <div
                      key={surah.storageKey}
                      className="flex items-center justify-between py-2.5 px-1 hover:bg-white/[0.02] rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handlePlaySurah(surah)}
                          title={isThisPlaying ? 'Pause' : 'Play offline'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            isThisPlaying
                              ? 'bg-teal-500 text-slate-950'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-teal-500/20 hover:text-teal-300'
                          }`}
                        >
                          {isThisPlaying ? (
                            <Pause size={14} className="fill-current" />
                          ) : (
                            <Play size={14} className="fill-current ml-0.5" />
                          )}
                        </button>

                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500">
                              {String(surah.surahId).padStart(3, '0')}
                            </span>
                            <span className="text-sm font-serif font-medium text-white truncate">
                              {surah.surahName}
                            </span>
                            <span className="text-xs font-arabic text-teal-400/80">
                              {surah.surahNameArabic}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatFileSize(surah.fileSizeBytes)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteOne(surah.surahId, surah.reciterId, surah.moshafId)
                        }
                        title="Delete offline file"
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription Modal for Paywall Gating */}
      <SubscriptionModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
      />
    </div>
  );
}
