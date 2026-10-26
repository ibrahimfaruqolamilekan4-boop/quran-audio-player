import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  getDownloadedSurahsGroupedByReciter,
  deleteDownloadedSurah,
  deleteAllDownloads,
  getStorageQuotaEstimate,
  formatFileSize,
  requestPersistentStorage,
  type DownloadedSurah,
} from '../lib/offlineManager';
import { usePlayer } from '../context/PlayerContext';
import { ALL_SURAHS } from '../lib/surahs';

interface ReciterDownloadGroup {
  reciterName: string;
  reciterPhoto?: string;
  surahs: DownloadedSurah[];
  totalBytes: number;
}

export function DownloadManager() {
  const { playChapter, currentChapter, isPlaying, togglePlayPause, allReciters, setReciter } = usePlayer();
  const [groups, setGroups] = useState<Record<string, ReciterDownloadGroup>>({});
  const [quota, setQuota] = useState<{ usedBytes: number; quotaBytes: number; percentUsed: number; isPersistent: boolean }>({
    usedBytes: 0,
    quotaBytes: 0,
    percentUsed: 0,
    isPersistent: false,
  });
  const [loading, setLoading] = useState(true);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

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
    const chapterObj = ALL_SURAHS.find(s => s.id === item.surahId);
    if (!chapterObj) return;

    const fullReciter = allReciters.find(r => r.id === item.reciterId);
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
      setQuota(prev => ({ ...prev, isPersistent: true }));
    }
  };

  return (
    <div className="bg-[#0A0F1D]/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-800/80">
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
            {totalCountAll} surah{totalCountAll !== 1 ? 's' : ''} downloaded ({formatFileSize(totalBytesAll)})
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

      {/* Persistence status notice */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 mb-6 text-xs">
        <div className="flex items-center gap-2.5">
          {quota.isPersistent ? (
            <ShieldCheck size={16} className="text-teal-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
          )}
          <span className="text-slate-300">
            {quota.isPersistent
              ? 'Persistent storage granted (browser will not clear downloads)'
              : 'Standard storage active. Click to enable persistent storage protection.'}
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

      {/* Empty State */}
      {totalCountAll === 0 && !loading && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-3 text-slate-600">
            <HardDrive size={24} />
          </div>
          <h4 className="text-base font-serif font-medium text-slate-300 mb-1">No downloaded surahs yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-light">
            Go to any reciter or the Surah Library and tap the Download button next to any surah to save it for offline listening.
          </p>
        </div>
      )}

      {/* Reciter Groups */}
      <div className="space-y-6">
        {(Object.entries(groups) as [string, ReciterDownloadGroup][]).map(([reciterId, group]) => (
          <div key={reciterId} className="bg-slate-900/40 rounded-2xl p-4 sm:p-5 border border-slate-800/60">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-3">
                {group.reciterPhoto ? (
                  <img src={group.reciterPhoto} alt={group.reciterName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-teal-500/15 flex items-center justify-center text-teal-400">
                    <Disc3 size={18} />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold text-white tracking-wide">{group.reciterName}</h4>
                  <p className="text-[11px] text-slate-500">
                    {group.surahs.length} surah{group.surahs.length !== 1 ? 's' : ''} · {formatFileSize(group.totalBytes)}
                  </p>
                </div>
              </div>
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
                        {isThisPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
                      </button>

                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500">{String(surah.surahId).padStart(3, '0')}</span>
                          <span className="text-sm font-serif font-medium text-white truncate">{surah.surahName}</span>
                          <span className="text-xs font-arabic text-teal-400/80">{surah.surahNameArabic}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {formatFileSize(surah.fileSizeBytes)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteOne(surah.surahId, surah.reciterId, surah.moshafId)}
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
        ))}
      </div>
    </div>
  );
}
