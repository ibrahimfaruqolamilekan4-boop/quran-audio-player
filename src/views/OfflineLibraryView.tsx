import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  WifiOff, 
  Trash2, 
  Play, 
  HardDrive, 
  Music, 
  BookOpen, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { 
  getDownloadedSurahs, 
  deleteDownloadedSurah, 
  formatFileSize, 
  type DownloadedSurah 
} from '../lib/offlineManager';
import { ALL_SURAHS } from '../lib/surahs';
import { SubscriptionModal } from '../components/SubscriptionModal';

export function OfflineLibraryView() {
  const { playChapter, currentChapter, isPlaying, allReciters } = usePlayer();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [downloadedSurahs, setDownloadedSurahs] = useState<DownloadedSurah[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubModal, setShowSubModal] = useState(false);

  const loadDownloads = async () => {
    try {
      setLoading(true);
      const list = await getDownloadedSurahs();
      setDownloadedSurahs(list);
    } catch (err) {
      console.warn('Error loading downloads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDownloads();
  }, []);

  const totalBytes = downloadedSurahs.reduce((acc, s) => acc + (s.fileSizeBytes || 0), 0);
  const formattedStorage = formatFileSize(totalBytes);

  const handlePlayDownloaded = (item: DownloadedSurah) => {
    const chapter = ALL_SURAHS.find(c => c.id === item.surahId) || {
      id: item.surahId,
      name_simple: item.surahName,
      name_arabic: item.surahNameArabic,
      translated_name: { name: item.surahName },
      verses_count: 0,
    };

    const reciter = allReciters.find(r => r.id === item.reciterId) || {
      id: item.reciterId,
      name: item.reciterName,
      style: 'Murattal',
      imageUrl: item.reciterPhoto,
    };

    playChapter(chapter, reciter);
  };

  const handleDelete = async (item: DownloadedSurah, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDownloadedSurah(item.surahId, item.reciterId);
      await loadDownloads();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 relative z-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-medium mb-3">
            <WifiOff size={13} />
            <span>Airplane Mode Ready</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-serif text-white tracking-wide">
            Offline Surah Library
          </h2>
          <p className="text-slate-400 mt-1.5 font-light text-base">
            Your stored recitations for uninterrupted spiritual connection with zero internet.
          </p>
        </div>

        {/* Storage stats badge */}
        <div className="bg-[#0F172A]/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/5 flex items-center gap-4 min-w-[240px]">
          <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400">
            <HardDrive size={22} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Device Storage</div>
            <div className="text-xl font-bold font-serif text-white mt-0.5">{formattedStorage}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{downloadedSurahs.length} Surahs Cached</div>
          </div>
        </div>
      </header>

      {/* Premium status banner if not premium */}
      {!user?.is_premium && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-teal-950/60 via-slate-900/80 to-emerald-950/60 border border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Upgrade to Nooraya Premium</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Download all 114 Surahs for infinite offline listening, ad-free focus, and all ambient video themes.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSubModal(true)}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer shadow-lg"
          >
            Upgrade with Flutterwave
          </button>
        </div>
      )}

      {/* Downloads List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          Loading your downloaded surahs...
        </div>
      ) : downloadedSurahs.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#0F172A]/40 border border-white/5 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4">
            <Music size={26} />
          </div>
          <h3 className="text-lg font-serif text-white">No Downloaded Surahs Yet</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Visit the Surah Library to download your favorite recitations for offline listening during travel or prayer times.
          </p>
          <button
            onClick={() => navigate('/dashboard/library')}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            <BookOpen size={15} />
            <span>Browse Surah Library</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {downloadedSurahs.map((item) => {
            const isCurrentlyPlaying = isPlaying && currentChapter?.id === item.surahId;

            return (
              <div
                key={`${item.reciterId}_${item.surahId}`}
                onClick={() => handlePlayDownloaded(item)}
                className={`group cursor-pointer p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  isCurrentlyPlaying
                    ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_20px_rgba(20,184,166,0.15)]'
                    : 'bg-[#0F172A]/60 border-white/5 hover:bg-[#0F172A] hover:border-white/15 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-800/80 border border-white/5 flex items-center justify-center text-teal-400 shrink-0 group-hover:bg-teal-500 group-hover:text-black transition-colors">
                    <Play size={18} className="fill-current ml-0.5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-semibold text-white text-base truncate group-hover:text-teal-300 transition-colors">
                        {item.surahName}
                      </span>
                      <span className="text-xs font-amiri text-teal-400/90 shrink-0" dir="rtl">
                        {item.surahNameArabic}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {item.reciterName}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 size={11} />
                        <span>Ready Offline</span>
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[10px] text-slate-500">
                        {formatFileSize(item.fileSizeBytes)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDelete(item, e)}
                  title="Delete from offline storage"
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 ml-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription Paywall Modal */}
      <SubscriptionModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        onSuccess={() => setShowSubModal(false)}
      />
    </div>
  );
}
