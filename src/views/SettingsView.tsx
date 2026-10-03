import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { appApi } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import {
  Plus,
  Trash2,
  Upload,
  Settings as SettingsIcon,
  AlertCircle,
  Play,
  Pause,
  X,
  Video,
  Check,
  Camera,
  Music,
  BookOpen,
  Search,
  ArrowLeft,
  RefreshCw,
  FileAudio,
  ShieldCheck,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';
import { ReciterAvatar } from '../components/ReciterAvatar';
import { resizeImageToDataUrl } from '../lib/upload';
import {
  uploadRecitation,
  replaceRecitation,
  deleteRecitation,
  recitationObjectUrl,
  formatBytes,
  formatDuration,
  StoredRecitation,
} from '../lib/recitations';
import { ALL_SURAHS } from '../lib/surahs';
import type { Reciter, Chapter } from '../types';

const SECTION_OPTIONS = [
  "Sweet Voices",
  "Madinah (Prophet's Mosque)",
  "Makkah (Masjid al-Haram)",
  "Classic Masters",
  "Community & Custom",
];

export function SettingsView() {
  const {
    allReciters,
    customReciters,
    setCustomReciters,
    updateReciterOverride,
    recitations,
    setRecitations,
    chapters,
    customVideos,
    setCustomVideos,
    activeBackgroundVideoId,
    setActiveBackgroundVideoId,
    ambientVideoMapping,
    setAmbientVideoMapping,
  } = usePlayer();

  const { user, role, logOut } = useAuth();
  const navigate = useNavigate();

  // Admin check: true if role === 'admin' OR if user is signed in with the admin email
  const isAdmin =
    role === 'admin' ||
    (user?.email && user.email.toLowerCase() === 'ibrahimfaruqolamilekan4@gmail.com');

  // Search & Filter state for Reciters List
  const [reciterSearch, setReciterSearch] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('All');

  // Managing 114 Surahs for a specific Reciter
  const [managingReciterId, setManagingReciterId] = useState<string | null>(null);
  const [surahSearch, setSurahSearch] = useState('');
  const [surahFilterTab, setSurahFilterTab] = useState<'all' | 'uploaded' | 'missing'>('all');

  // Inline Bio Editing state
  const [editingBioReciterId, setEditingBioReciterId] = useState<string | null>(null);
  const [bioInputText, setBioInputText] = useState('');

  // Add Reciter Modal / Form state
  const [showAddReciterModal, setShowAddReciterModal] = useState(false);
  const [newReciterName, setNewReciterName] = useState('');
  const [newReciterArabicName, setNewReciterArabicName] = useState('');
  const [newReciterSection, setNewReciterSection] = useState(SECTION_OPTIONS[0]);
  const [newReciterBio, setNewReciterBio] = useState('');
  const [newReciterPhotoData, setNewReciterPhotoData] = useState<string | null>(null);
  const [addReciterError, setAddReciterError] = useState('');
  const [isSubmittingReciter, setIsSubmittingReciter] = useState(false);

  // Audio Preview state for uploaded Surahs
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewSurahId, setPreviewSurahId] = useState<number | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Uploading state for Surah audio files
  const [uploadingSurahId, setUploadingSurahId] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Background Videos state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState('');
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Complete 114 surahs list (uses player chapters or robust static fallback)
  const surahsList = useMemo(() => {
    return chapters && chapters.length === 114 ? chapters : ALL_SURAHS;
  }, [chapters]);

  // Load background thumbnails
  useEffect(() => {
    let isMounted = true;
    async function loadThumbnails() {
      const urls: Record<string, string> = {};
      const mappedIds = Object.values(ambientVideoMapping) as string[];
      for (const vId of mappedIds) {
        if (!vId) continue;
        try {
          const blob = await localforage.getItem<Blob>(vId);
          if (blob) {
            urls[vId] = URL.createObjectURL(blob);
          }
        } catch (e) {
          console.error('Error loading ambient thumbnail', e);
        }
      }
      if (isMounted) setVideoUrls(urls);
    }
    loadThumbnails();
    return () => {
      isMounted = false;
      Object.values(videoUrls).forEach(url => URL.revokeObjectURL(url as string));
    };
  }, [ambientVideoMapping]);

  // Audio preview teardown
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  // Filtered Reciters
  const filteredReciters = useMemo(() => {
    const q = reciterSearch.trim().toLowerCase();
    return allReciters.filter(r => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.nameArabic || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q);

      const matchesCategory =
        selectedSectionFilter === 'All' ||
        (selectedSectionFilter === 'Custom' && (!r.category || r.category === 'Custom' || r.category === 'Community & Custom')) ||
        (r.category && r.category.toLowerCase().includes(selectedSectionFilter.toLowerCase()));

      return matchesSearch && matchesCategory;
    });
  }, [allReciters, reciterSearch, selectedSectionFilter]);

  // Currently managed reciter
  const managingReciter = useMemo(() => {
    if (!managingReciterId) return null;
    return allReciters.find(r => r.id === managingReciterId) || null;
  }, [allReciters, managingReciterId]);

  // Map of surahs uploaded for the currently selected reciter
  const reciterSurahMap = useMemo(() => {
    if (!managingReciterId) return new Map<number, StoredRecitation>();
    const map = new Map<number, StoredRecitation>();
    recitations
      .filter(r => r.reciterId === managingReciterId)
      .forEach(r => map.set(r.surah, r));
    return map;
  }, [recitations, managingReciterId]);

  // Filtered surahs for the 114 manager
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

  // 1. CHANGE PROFILE PICTURE DIRECTLY FROM PHONE PHOTO
  const handleReciterPhotoUpload = async (reciterId: string, file: File) => {
    try {
      const dataUrl = await resizeImageToDataUrl(file, 512, 0.88);
      if (!dataUrl) {
        showToast('Could not read image file. Please choose a JPG or PNG.', 'error');
        return;
      }

      // Update override in PlayerContext + localforage
      updateReciterOverride(reciterId, { imageUrl: dataUrl });

      // If it is a custom reciter, also update customReciters list
      const reciter = allReciters.find(r => r.id === reciterId);
      if (reciter && customReciters.some(c => c.id === reciterId)) {
        const updated = customReciters.map(c =>
          c.id === reciterId ? { ...c, imageUrl: dataUrl } : c
        );
        setCustomReciters(updated);
        await localforage.setItem('customReciters', updated);
      }

      showToast(`Profile picture for ${reciter?.name || 'sheikh'} updated from phone!`, 'success');
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      showToast('Failed to update picture. Please try again.', 'error');
    }
  };

  // 2. SAVE RECITERS BIO
  const handleSaveBio = async (reciterId: string) => {
    const trimmed = bioInputText.trim();
    updateReciterOverride(reciterId, { bio: trimmed || undefined });

    const reciter = allReciters.find(r => r.id === reciterId);
    if (reciter && customReciters.some(c => c.id === reciterId)) {
      const updated = customReciters.map(c =>
        c.id === reciterId ? { ...c, bio: trimmed || undefined } : c
      );
      setCustomReciters(updated);
      await localforage.setItem('customReciters', updated);
    }

    setEditingBioReciterId(null);
    showToast(`Biography saved for ${reciter?.name || 'sheikh'}!`, 'success');
  };

  // 3. ADD NEW RECITER (WITH PHONE PHOTO)
  const handleCreateReciter = async () => {
    setAddReciterError('');
    if (!newReciterName.trim()) {
      setAddReciterError('Please enter the name of the reciter.');
      return;
    }

    setIsSubmittingReciter(true);
    try {
      const newId = 'custom_' + Date.now();
      const newReciterObj: Reciter = {
        id: newId,
        name: newReciterName.trim(),
        nameArabic: newReciterArabicName.trim() || undefined,
        style: 'Murattal',
        category: newReciterSection,
        bio: newReciterBio.trim() || undefined,
        imageUrl: newReciterPhotoData || undefined,
      };

      const updated = [...customReciters, newReciterObj];
      setCustomReciters(updated);
      await localforage.setItem('customReciters', updated);

      if (newReciterPhotoData || newReciterBio.trim()) {
        updateReciterOverride(newId, {
          imageUrl: newReciterPhotoData || undefined,
          bio: newReciterBio.trim() || undefined,
        });
      }

      // Sync to backend if authenticated
      if (user) {
        try {
          await appApi('/me/reciters', { method: 'POST', body: newReciterObj });
        } catch (e) {
          console.warn('Reciter added on device, sync skipped:', e);
        }
      }

      // Reset modal fields
      setNewReciterName('');
      setNewReciterArabicName('');
      setNewReciterBio('');
      setNewReciterPhotoData(null);
      setShowAddReciterModal(false);

      showToast(`Added ${newReciterObj.name}! Now upload your downloaded surahs.`, 'success');
      // Automatically open Surah upload manager for this new sheikh
      setManagingReciterId(newId);
    } catch (err: any) {
      setAddReciterError(err?.message || 'Could not create reciter.');
    } finally {
      setIsSubmittingReciter(false);
    }
  };

  // 4. DELETE CUSTOM RECITER
  const handleDeleteCustomReciter = async (reciter: Reciter) => {
    if (!window.confirm(`Delete "${reciter.name}" from your catalog?`)) return;

    const updated = customReciters.filter(r => r.id !== reciter.id);
    setCustomReciters(updated);
    await localforage.setItem('customReciters', updated);

    // Delete associated recitations from device
    const toRemove = recitations.filter(r => r.reciterId === reciter.id);
    for (const rec of toRemove) {
      await deleteRecitation(rec.id);
    }
    setRecitations(recitations.filter(r => r.reciterId !== reciter.id));

    if (managingReciterId === reciter.id) {
      setManagingReciterId(null);
    }

    if (user) {
      try {
        await appApi(`/me/reciters/${encodeURIComponent(reciter.id)}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Server delete failed', e);
      }
    }

    showToast(`Removed "${reciter.name}".`, 'success');
  };

  // 5. UPLOAD SURAH AUDIO DOWNLOADED TO PHONE
  const handleUploadSurahFile = async (chapter: Chapter, file: File) => {
    if (!managingReciter) return;

    setUploadingSurahId(chapter.id);
    setUploadProgress(0);

    try {
      // Check if existing recitation exists to replace
      const existing = reciterSurahMap.get(chapter.id);
      let entry: StoredRecitation;

      if (existing) {
        const replaced = await replaceRecitation(existing.id, file, setUploadProgress);
        if (!replaced) throw new Error('Could not replace existing audio file.');
        entry = replaced;
        setRecitations(recitations.map(r => (r.id === existing.id ? entry : r)));
      } else {
        entry = await uploadRecitation(
          file,
          {
            reciterId: managingReciter.id,
            reciterName: managingReciter.name,
            surah: chapter.id,
            surahName: chapter.name_simple,
          },
          setUploadProgress
        );
        setRecitations([entry, ...recitations]);
      }

      showToast(`Surah ${chapter.id}. ${chapter.name_simple} saved from your phone! Users can now play it.`, 'success');
    } catch (err: any) {
      console.error('Surah upload error:', err);
      showToast(err?.message || 'Failed to upload surah audio file.', 'error');
    } finally {
      setUploadingSurahId(null);
      setUploadProgress(0);
    }
  };

  // 6. DELETE STORED SURAH AUDIO
  const handleDeleteSurahAudio = async (chapterId: number) => {
    const existing = reciterSurahMap.get(chapterId);
    if (!existing) return;

    if (!window.confirm(`Delete the uploaded audio for Surah ${chapterId}?`)) return;

    try {
      await deleteRecitation(existing.id);
      setRecitations(recitations.filter(r => r.id !== existing.id));
      if (previewSurahId === chapterId && previewAudioRef.current) {
        previewAudioRef.current.pause();
        setPreviewAudioUrl(null);
        setPreviewSurahId(null);
        setIsPreviewPlaying(false);
      }
      showToast(`Removed audio for Surah ${chapterId}.`, 'success');
    } catch (err) {
      showToast('Could not delete audio.', 'error');
    }
  };

  // 7. PREVIEW UPLOADED SURAH AUDIO
  const handleToggleAudioPreview = async (chapterId: number) => {
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
      setPreviewAudioUrl(url);
      setPreviewSurahId(chapterId);
      setIsPreviewPlaying(true);

      audio.onended = () => setIsPreviewPlaying(false);
      audio.onerror = () => {
        setIsPreviewPlaying(false);
        showToast('Playback error on preview.', 'error');
      };
      await audio.play();
    } catch (err) {
      showToast('Audio preview error.', 'error');
    }
  };

  // Background Videos Handlers
  const handleUploadVideo = async () => {
    setVideoError('');
    if (!videoFile) {
      setVideoError('Please select a video file.');
      return;
    }
    if (!videoFile.type.startsWith('video/')) {
      setVideoError('The selected file must be a valid video (e.g. mp4, webm).');
      return;
    }
    const blob = new Blob([videoFile], { type: videoFile.type });
    const id = 'custom_vid_' + Date.now();
    const updated = [...customVideos, { id, name: videoFile.name }];
    setCustomVideos(updated);
    await localforage.setItem('customVideos_list', updated);
    await localforage.setItem('customVideo_blob_' + id, blob);
    setVideoFile(null);
    showToast('Background video uploaded successfully!', 'success');
  };

  const handleRemoveVideo = async (id: string) => {
    if (activeBackgroundVideoId === id) {
      setActiveBackgroundVideoId(null);
    }
    const updated = customVideos.filter(v => v.id !== id);
    setCustomVideos(updated);
    await localforage.setItem('customVideos_list', updated);
    await localforage.removeItem('customVideo_blob_' + id);
    showToast('Background video removed.', 'success');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto pb-32">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50'
                : 'bg-red-950/90 text-red-200 border-red-500/40 shadow-red-950/50'
            } backdrop-blur-xl`}
          >
            {toastMessage.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 flex items-center justify-center border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.15)]">
            <SettingsIcon className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-white tracking-tight">Admin & Settings</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {isAdmin
                ? 'Admin Control: Manage sheikh portraits from phone, bios, and upload Surah MP3s.'
                : 'Account preferences and custom background videos.'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold">
            <ShieldCheck size={16} className="text-teal-400" />
            Admin Verified
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* Account Status Card */}
        <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-7 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Account Status</h2>
                {isAdmin && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Administrator
                  </span>
                )}
              </div>
              <p className="text-slate-400 mt-1 text-sm">
                {user ? `Logged in as ${user.email}` : 'Sign in with your admin account to manage reciters and upload audio.'}
              </p>
            </div>

            {user ? (
              <div className="flex items-center gap-3 bg-[#050811] border border-slate-800 rounded-2xl p-2.5 pl-4">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || 'A'}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{user.displayName || user.email?.split('@')[0]}</span>
                    <span className="text-xs text-slate-400 truncate max-w-[180px]">{user.email}</span>
                  </div>
                </div>
                <button
                  onClick={logOut}
                  className="px-4 py-2 ml-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-2xl font-bold transition-all shadow-lg shadow-teal-500/20"
              >
                Sign In as Admin
              </button>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* ADMIN CONTROL: RECITERS, PHONE PHOTOS, BIOS & 114 SURAHS */}
        {/* ============================================================ */}
        {isAdmin && (
          <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-teal-900/40 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* 114 SURAHS MANAGER VIEW (WHEN A RECITER IS SELECTED) */}
            {managingReciter ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setManagingReciterId(null)}
                      className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center justify-center shrink-0"
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
                        if (file) handleReciterPhotoUpload(managingReciter.id, file);
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
                      onClick={() => setSurahFilterTab('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        surahFilterTab === 'all' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All 114
                    </button>
                    <button
                      onClick={() => setSurahFilterTab('uploaded')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        surahFilterTab === 'uploaded' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Uploaded ({reciterSurahMap.size})
                    </button>
                    <button
                      onClick={() => setSurahFilterTab('missing')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                              uploaded ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {surah.id}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-sm">{surah.name_simple}</span>
                              <span className="font-amiri text-xs text-teal-400/90" dir="rtl">
                                {surah.name_arabic}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {surah.verses_count} verses • {surah.translated_name?.name || 'Surah'}
                            </span>
                          </div>
                        </div>

                        {/* Status & Upload Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {uploaded ? (
                            <>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium">
                                <Check size={14} className="text-emerald-400" />
                                <span>Uploaded ({formatBytes(uploaded.sizeBytes)})</span>
                              </div>

                              {/* Play preview */}
                              <button
                                onClick={() => handleToggleAudioPreview(surah.id)}
                                className={`p-2 rounded-xl border transition-all ${
                                  isPreviewThis && isPreviewPlaying
                                    ? 'bg-teal-500 text-slate-950 border-teal-400'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                }`}
                                title="Play preview"
                              >
                                {isPreviewThis && isPreviewPlaying ? <Pause size={15} /> : <Play size={15} />}
                              </button>

                              {/* Replace button */}
                              <label className="cursor-pointer p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all" title="Replace with new MP3 from phone">
                                <RefreshCw size={15} />
                                <input
                                  type="file"
                                  accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadSurahFile(surah, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>

                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteSurahAudio(surah.id)}
                                className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 transition-all"
                                title="Remove uploaded audio"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-semibold transition-all">
                              <Upload size={14} />
                              <span>{isUploadingThis ? `Uploading ${uploadProgress}%` : 'Upload from Phone'}</span>
                              <input
                                type="file"
                                accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
                                disabled={isUploadingThis}
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadSurahFile(surah, file);
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
            ) : (
              /* RECITERS CATALOG LIST VIEW */
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-white tracking-wide">
                      Reciters & Sheikhs Directory ({allReciters.length})
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                      Upload portraits directly from your phone's photo library, edit bios, or click “Upload Surahs” to attach downloaded MP3 files for all 114 surahs.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddReciterModal(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all self-start sm:self-auto shrink-0"
                  >
                    <Plus size={18} />
                    + Add New Sheikh
                  </button>
                </div>

                {/* Search & Section Filter Bar */}
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="relative flex-1">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search reciters by English or Arabic name..."
                      value={reciterSearch}
                      onChange={e => setReciterSearch(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                    {['All', 'Madinah', 'Makkah', 'Classic Masters', 'Sweet Voices', 'Custom'].map(sec => (
                      <button
                        key={sec}
                        onClick={() => setSelectedSectionFilter(sec)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                          selectedSectionFilter === sec
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reciters Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredReciters.map(reciter => {
                    const isCustom = customReciters.some(c => c.id === reciter.id);
                    const uploadedSurahCount = recitations.filter(r => r.reciterId === reciter.id).length;
                    const isEditingBio = editingBioReciterId === reciter.id;

                    return (
                      <div
                        key={reciter.id}
                        className="bg-[#050811]/80 border border-slate-800/80 hover:border-slate-700/90 rounded-3xl p-5 flex flex-col justify-between transition-all shadow-lg group"
                      >
                        <div>
                          {/* Top Card Bar */}
                          <div className="flex items-start gap-4">
                            {/* Avatar with Quick Upload Overlay */}
                            <div className="relative group/avatar shrink-0 w-16 h-16 rounded-2xl overflow-hidden border border-slate-700 shadow-md">
                              <ReciterAvatar reciter={reciter} shape="rounded" className="w-full h-full rounded-none" />
                              <label
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-semibold"
                                title="Upload photo from phone"
                              >
                                <Camera size={18} className="mb-0.5 text-teal-400" />
                                <span>Change</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) handleReciterPhotoUpload(reciter.id, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-serif font-bold text-white text-base truncate group-hover:text-teal-300 transition-colors">
                                  {reciter.name}
                                </h3>
                                {isCustom && (
                                  <button
                                    onClick={() => handleDeleteCustomReciter(reciter)}
                                    className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                                    title="Delete custom reciter"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>

                              {reciter.nameArabic && (
                                <p className="text-xs font-amiri text-teal-400 mt-0.5" dir="rtl">
                                  {reciter.nameArabic}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300">
                                  {reciter.category || 'General'}
                                </span>
                                {uploadedSurahCount > 0 ? (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[11px] font-medium">
                                    {uploadedSurahCount} surahs from phone
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 text-[11px]">
                                    CDN 114 Surahs
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bio preview / editor */}
                          <div className="mt-4 pt-3 border-t border-slate-800/60">
                            {isEditingBio ? (
                              <div className="space-y-2">
                                <textarea
                                  value={bioInputText}
                                  onChange={e => setBioInputText(e.target.value)}
                                  placeholder="Write a short biography (country of birth, mosque, style)..."
                                  rows={3}
                                  className="w-full bg-[#0D121F] border border-teal-500/40 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingBioReciterId(null)}
                                    className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveBio(reciter.id)}
                                    className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
                                  >
                                    Save Bio
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                {reciter.bio || <span className="text-slate-600 italic">No biography added yet. Click “Edit Bio” to add one.</span>}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {/* Photo picker from phone */}
                            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all">
                              <Camera size={14} className="text-teal-400" />
                              <span>Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleReciterPhotoUpload(reciter.id, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>

                            {/* Bio toggle */}
                            <button
                              onClick={() => {
                                if (isEditingBio) {
                                  setEditingBioReciterId(null);
                                } else {
                                  setEditingBioReciterId(reciter.id);
                                  setBioInputText(reciter.bio || '');
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all"
                            >
                              Bio
                            </button>
                          </div>

                          {/* 114 Surahs Upload button */}
                          <button
                            onClick={() => {
                              setManagingReciterId(reciter.id);
                              setSurahSearch('');
                              setSurahFilterTab('all');
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all"
                          >
                            <FileAudio size={14} />
                            <span>Upload Surahs (114)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ============================================================ */}
        {/* ADD RECITER MODAL */}
        {/* ============================================================ */}
        <AnimatePresence>
          {showAddReciterModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-[#0D121F] border border-slate-800 rounded-3xl p-6 lg:p-7 shadow-2xl relative"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <h3 className="text-xl font-serif font-bold text-white">Add New Sheikh / Reciter</h3>
                  <button
                    onClick={() => setShowAddReciterModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4 mt-5">
                  {/* Photo from Phone */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#050811] border border-slate-800">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-700 shrink-0">
                      {newReciterPhotoData ? (
                        <img src={newReciterPhotoData} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={24} className="text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Profile Photo</p>
                      <p className="text-xs text-slate-400 mt-0.5">Upload a picture directly from your phone</p>
                      <label className="cursor-pointer inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors">
                        <Upload size={14} />
                        Choose Photo from Phone
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const dataUrl = await resizeImageToDataUrl(file);
                              if (dataUrl) setNewReciterPhotoData(dataUrl);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Reciter Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Sheikh / Reciter Name <span className="text-teal-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sheikh Bilal Al Dirbali"
                      value={newReciterName}
                      onChange={e => setNewReciterName(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Arabic Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Arabic Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. الشيخ بلال الدربالي"
                      dir="rtl"
                      value={newReciterArabicName}
                      onChange={e => setNewReciterArabicName(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-amiri"
                    />
                  </div>

                  {/* Section / Category */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">App Section</label>
                    <select
                      value={newReciterSection}
                      onChange={e => setNewReciterSection(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                    >
                      {SECTION_OPTIONS.map(opt => (
                        <option key={opt} value={opt} className="bg-slate-900 text-white">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Biography */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Biography / Information (Optional)
                    </label>
                    <textarea
                      placeholder="Country of birth, where they lead prayer, recitation style..."
                      value={newReciterBio}
                      onChange={e => setNewReciterBio(e.target.value)}
                      rows={3}
                      className="w-full bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {addReciterError && (
                    <div className="flex items-center gap-2 text-red-400 text-xs">
                      <AlertCircle size={15} />
                      <span>{addReciterError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => setShowAddReciterModal(false)}
                      className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateReciter}
                      disabled={isSubmittingReciter}
                      className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
                    >
                      {isSubmittingReciter ? 'Saving...' : 'Create & Upload Surahs'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ============================================================ */}
        {/* CUSTOM BACKGROUND VIDEOS SECTION */}
        {/* ============================================================ */}
        <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-teal-400" />
                Custom Background Videos
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Upload your own video loops to play seamlessly in the background during recitation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-teal-500/50 rounded-2xl p-6 cursor-pointer bg-[#050811]/50 transition-all group">
                <Video className="w-8 h-8 text-slate-500 group-hover:text-teal-400 transition-colors mb-2" />
                <span className="text-sm font-semibold text-slate-300">
                  {videoFile ? videoFile.name : 'Choose a video file from your phone / device'}
                </span>
                <span className="text-xs text-slate-500 mt-1">Supports MP4, WebM (Max 150MB)</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setVideoFile(f);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-col justify-end">
              <button
                onClick={handleUploadVideo}
                disabled={!videoFile}
                className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:hover:bg-teal-500 text-slate-950 font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/20"
              >
                <Upload size={18} />
                Upload Background
              </button>
            </div>
          </div>

          {videoError && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
              <AlertCircle size={16} />
              <span>{videoError}</span>
            </div>
          )}

          {/* List of Uploaded Videos */}
          {customVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {customVideos.map(vid => (
                <div key={vid.id} className="relative group bg-[#050811] border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                      <Video size={18} className="text-teal-400" />
                    </div>
                    <span className="text-sm font-medium text-white truncate">{vid.name}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveVideo(vid.id)}
                    className="p-2 rounded-xl text-slate-500 hover:text-red-400 transition-colors"
                    title="Remove video"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
