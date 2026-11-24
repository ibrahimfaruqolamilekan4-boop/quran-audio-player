import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Camera,
  Search,
  FileAudio,
  Play,
  Pause,
  Upload,
  Trash2,
  RefreshCw,
  Check,
} from 'lucide-react';
import { ReciterAvatar } from '../../components/ReciterAvatar';
import {
  StoredRecitation,
  recitationObjectUrl,
  formatBytes,
  formatDuration,
} from '../../lib/recitations';
import type { Reciter, Chapter } from '../../types';

interface SurahUploadManagerProps {
  managingReciter: Reciter;
  surahsList: Chapter[];
  reciterSurahMap: Map<number, StoredRecitation>;
  onBack: () => void;
  onPhotoUpload: (reciterId: string, file: File) => Promise<void>;
  onUploadSurah: (chapter: Chapter, file: File) => Promise<void>;
  onDeleteSurah: (chapterId: number) => void;
  uploadingSurahId: number | null;
  uploadProgress: number;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

export function SurahUploadManager({
  managingReciter,
  surahsList,
  reciterSurahMap,
  onBack,
  onPhotoUpload,
  onUploadSurah,
  onDeleteSurah,
  uploadingSurahId,
  uploadProgress,
  showToast,
}: SurahUploadManagerProps) {
  const [surahSearch, setSurahSearch] = useState('');
  const [surahFilterTab, setSurahFilterTab] = useState<'all' | 'uploaded' | 'missing'>('all');

  // Audio Preview state
  const [previewSurahId, setPreviewSurahId] = useState<number | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const filteredSurahs = useMemo(() => {
    const q = surahSearch.trim().toLowerCase();
    return surahsList.filter(s => {
      const matchesSearch =
        !q ||
        s.id.toString() === q ||
        s.name_simple.toLowerCase().includes(q) ||
        s.name_arabic.includes(q);

      const isUploaded = reciterSurahMap.has(s.id);
      if (surahFilterTab === 'uploaded') return matchesSearch && isUploaded;
      if (surahFilterTab === 'missing') return matchesSearch && !isUploaded;
      return matchesSearch;
    });
  }, [surahsList, surahSearch, surahFilterTab, reciterSurahMap]);

  const handleTogglePreview = async (chapterId: number) => {
    const existing = reciterSurahMap.get(chapterId);
    if (!existing) return;

    if (previewSurahId === chapterId && previewAudioRef.current) {
      if (isPreviewPlaying) {
        previewAudioRef.current.pause();
        setIsPreviewPlaying(false);
      } else {
        previewAudioRef.current.play();
        setIsPreviewPlaying(true);
      }
      return;
    }

    try {
      const url = await recitationObjectUrl(existing);
      if (!url) {
        showToast('Could not load audio for preview.', 'error');
        return;
      }

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }

      const audio = new Audio(url);
      previewAudioRef.current = audio;
      setPreviewSurahId(chapterId);
      setIsPreviewPlaying(true);

      audio.onended = () => setIsPreviewPlaying(false);
      audio.onerror = () => {
        setIsPreviewPlaying(false);
        showToast('Playback error on preview.', 'error');
      };
      await audio.play();
    } catch {
      showToast('Audio preview error.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center justify-center shrink-0 cursor-pointer"
            title="Back to all reciters"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-14 h-14 shrink-0 rounded-2xl overflow-hidden border border-teal-500/30 shadow-md">
            <ReciterAvatar reciter={managingReciter} shape="rounded" className="w-full h-full rounded-none" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-serif font-bold text-white">{managingReciter.name}</h2>
              {managingReciter.nameArabic && (
                <span className="text-sm font-amiri text-teal-400" dir="rtl">
                  ({managingReciter.nameArabic})
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>{managingReciter.category || 'General'}</span>
              <span>•</span>
              <span className="text-teal-400 font-semibold">
                {reciterSurahMap.size} of 114 Surahs uploaded from phone
              </span>
            </div>
          </div>
        </div>

        {/* Change Photo shortcut */}
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-semibold transition-all">
          <Camera size={16} />
          Change Photo from Phone
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onPhotoUpload(managingReciter.id, file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Surah List Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search 114 Surahs by name or number (e.g. Al-Kahf, 18, Yasin)..."
            value={surahSearch}
            onChange={e => setSurahSearch(e.target.value)}
            className="w-full bg-[#050811] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-[#050811] border border-slate-800 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setSurahFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              surahFilterTab === 'all' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All 114
          </button>
          <button
            type="button"
            onClick={() => setSurahFilterTab('uploaded')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              surahFilterTab === 'uploaded' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Uploaded ({reciterSurahMap.size})
          </button>
          <button
            type="button"
            onClick={() => setSurahFilterTab('missing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              surahFilterTab === 'missing' ? 'bg-slate-700/50 text-slate-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Missing ({114 - reciterSurahMap.size})
          </button>
        </div>
      </div>

      {/* 114 Surahs List */}
      <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
        {filteredSurahs.map(surah => {
          const uploaded = reciterSurahMap.get(surah.id);
          const isUploadingThis = uploadingSurahId === surah.id;
          const isPreviewThis = previewSurahId === surah.id;

          return (
            <div
              key={surah.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all gap-3 ${
                uploaded
                  ? 'bg-emerald-950/20 border-emerald-900/40 hover:border-emerald-700/50'
                  : 'bg-[#050811]/70 border-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-slate-800/90 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                  {surah.id}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{surah.name_simple}</span>
                    <span className="text-xs font-amiri text-slate-400" dir="rtl">
                      {surah.name_arabic}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{surah.verses_count} Verses</span>
                    {uploaded && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400 font-medium">
                          {formatBytes(uploaded.sizeBytes)}
                        </span>
                        {uploaded.durationSec ? (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">
                              {formatDuration(uploaded.durationSec)}
                            </span>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Surah Action Area */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                {isUploadingThis ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Uploading ({uploadProgress}%)...</span>
                  </div>
                ) : uploaded ? (
                  <div className="flex items-center gap-1.5">
                    {/* Audio Preview Button */}
                    <button
                      type="button"
                      onClick={() => handleTogglePreview(surah.id)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        isPreviewThis && isPreviewPlaying
                          ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md'
                          : 'bg-slate-800 hover:bg-slate-700 text-teal-400 border-slate-700'
                      }`}
                      title={isPreviewThis && isPreviewPlaying ? 'Pause preview' : 'Play audio preview'}
                    >
                      {isPreviewThis && isPreviewPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>

                    {/* Replace audio */}
                    <label className="cursor-pointer p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all">
                      <RefreshCw size={14} />
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) onUploadSurah(surah, file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {/* Delete audio */}
                    <button
                      type="button"
                      onClick={() => onDeleteSurah(surah.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800/50 transition-all cursor-pointer"
                      title="Delete audio"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  /* Upload file */
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-semibold transition-all">
                    <Upload size={14} />
                    <span>Upload MP3</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) onUploadSurah(surah, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
