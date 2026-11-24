import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings as SettingsIcon,
  User as UserIcon,
  Mic,
  Video,
  Users,
  ShieldCheck,
  Check,
  AlertCircle,
} from 'lucide-react';
import localforage from 'localforage';
import { usePlayer } from '../../context/PlayerContext';
import { useAuth } from '../../context/AuthContext';
import { appApi } from '../../lib/api';
import { ALL_SURAHS } from '../../lib/surahs';
import { resizeImageToDataUrl, uploadMediaToServer } from '../../lib/upload';
import {
  uploadRecitation,
  replaceRecitation,
  deleteRecitation,
  StoredRecitation,
} from '../../lib/recitations';
import type { Reciter, Chapter } from '../../types';

import { ProfileSection } from './ProfileSection';
import { ReciterManager, SECTION_OPTIONS } from './ReciterManager';
import { SurahUploadManager } from './SurahUploadManager';
import { BackgroundManager } from './BackgroundManager';
import { AdminUsersSection } from './AdminUsersSection';
import { AddReciterModal } from './components/AddReciterModal';

export type SettingsTab = 'profile' | 'reciters' | 'atmosphere' | 'admin';

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
    refreshGlobalCatalog,
    syncLocalAssetsToCloud,
  } = usePlayer();

  const { user, role, logOut, refreshUser } = useAuth();

  const isAdmin = Boolean(
    user &&
      (role === 'admin' ||
        (user.email && user.email.toLowerCase() === 'ibrahimfaruqolamilekan4@gmail.com'))
  );

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Managing 114 Surahs for a specific Reciter
  const [managingReciterId, setManagingReciterId] = useState<string | null>(null);
  const [uploadingSurahId, setUploadingSurahId] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Add Reciter Modal
  const [showAddReciterModal, setShowAddReciterModal] = useState(false);
  const [addReciterError, setAddReciterError] = useState('');
  const [isSubmittingReciter, setIsSubmittingReciter] = useState(false);

  // Toast & confirmation
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => Promise<void> | void } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const surahsList = useMemo(() => {
    return chapters && chapters.length === 114 ? chapters : ALL_SURAHS;
  }, [chapters]);

  const managingReciter = useMemo(() => {
    if (!managingReciterId) return null;
    return allReciters.find(r => r.id === managingReciterId) || null;
  }, [allReciters, managingReciterId]);

  const reciterSurahMap = useMemo(() => {
    if (!managingReciterId) return new Map<number, StoredRecitation>();
    const map = new Map<number, StoredRecitation>();
    recitations
      .filter(r => r.reciterId === managingReciterId)
      .forEach(r => map.set(r.surah, r));
    return map;
  }, [recitations, managingReciterId]);

  // PHOTO UPLOAD
  const handleReciterPhotoUpload = async (reciterId: string, file: File) => {
    try {
      const dataUrl = await resizeImageToDataUrl(file, 512, 0.88);
      if (!dataUrl) {
        showToast('Could not read image file. Please choose a JPG or PNG.', 'error');
        return;
      }

      updateReciterOverride(reciterId, { imageUrl: dataUrl });

      const reciter = allReciters.find(r => r.id === reciterId);
      if (reciter && customReciters.some(c => c.id === reciterId)) {
        const updated = customReciters.map(c =>
          c.id === reciterId ? { ...c, imageUrl: dataUrl } : c
        );
        setCustomReciters(updated);
        await localforage.setItem('customReciters', updated);
      }

      let permanentUrl = dataUrl;
      try {
        const hostedUrl = await uploadMediaToServer(dataUrl, {
          filename: `sheikh_${reciterId.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`,
          name: reciter?.name || reciterId,
          type: 'image/jpeg',
        });
        if (hostedUrl) {
          permanentUrl = hostedUrl;
          updateReciterOverride(reciterId, { imageUrl: permanentUrl });
          if (customReciters.some(c => c.id === reciterId)) {
            const updatedWithHosted = customReciters.map(c =>
              c.id === reciterId ? { ...c, imageUrl: permanentUrl } : c
            );
            setCustomReciters(updatedWithHosted);
            await localforage.setItem('customReciters', updatedWithHosted);
          }
        }
      } catch (mediaErr) {
        console.warn('Portrait media upload fallback:', mediaErr);
      }

      try {
        await appApi('/admin/reciters', {
          method: 'POST',
          body: {
            id: reciterId,
            name: reciter?.name || reciterId,
            nameArabic: reciter?.nameArabic,
            category: reciter?.category,
            style: reciter?.style || 'Murattal',
            serverUrl: reciter?.serverUrl || '',
            imageUrl: permanentUrl,
            bio: reciter?.bio,
          },
        });
      } catch (adminErr) {
        console.warn('Could not sync to /admin/reciters:', adminErr);
      }

      await refreshGlobalCatalog();
      showToast(`Profile picture for ${reciter?.name || 'sheikh'} synced to all devices!`, 'success');
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      showToast('Failed to update picture. Please try again.', 'error');
    }
  };

  // BIO SAVE
  const handleSaveBio = async (reciterId: string, bioText: string) => {
    const trimmed = bioText.trim();
    updateReciterOverride(reciterId, { bio: trimmed || undefined });

    const reciter = allReciters.find(r => r.id === reciterId);
    if (reciter && customReciters.some(c => c.id === reciterId)) {
      const updated = customReciters.map(c =>
        c.id === reciterId ? { ...c, bio: trimmed || undefined } : c
      );
      setCustomReciters(updated);
      await localforage.setItem('customReciters', updated);
    }

    try {
      await appApi('/admin/reciters', {
        method: 'POST',
        body: {
          id: reciterId,
          name: reciter?.name || reciterId,
          nameArabic: reciter?.nameArabic,
          category: reciter?.category,
          style: reciter?.style || 'Murattal',
          serverUrl: reciter?.serverUrl || '',
          imageUrl: reciter?.imageUrl,
          bio: trimmed || undefined,
        },
      });
      await refreshGlobalCatalog();
    } catch {}

    showToast('Reciter biography saved and synced across all devices.', 'success');
  };

  // CREATE RECITER
  const handleCreateReciter = async (data: {
    name: string;
    nameArabic: string;
    section: string;
    bio: string;
    photoData: string | null;
  }) => {
    setAddReciterError('');
    if (!data.name.trim()) {
      setAddReciterError('Please enter the name of the reciter.');
      return;
    }

    setIsSubmittingReciter(true);
    try {
      const newId = 'custom_' + Date.now();
      let permanentPhotoUrl = data.photoData || undefined;

      if (data.photoData) {
        try {
          const hosted = await uploadMediaToServer(data.photoData, {
            filename: `sheikh_${newId}.jpg`,
            name: data.name.trim(),
            type: 'image/jpeg',
          });
          if (hosted) {
            permanentPhotoUrl = hosted;
          }
        } catch (photoErr) {
          console.warn('New reciter photo upload fallback:', photoErr);
        }
      }

      const newReciterObj: Reciter = {
        id: newId,
        name: data.name.trim(),
        nameArabic: data.nameArabic.trim() || undefined,
        style: 'Murattal',
        category: data.section,
        bio: data.bio.trim() || undefined,
        imageUrl: permanentPhotoUrl,
        serverUrl: '',
      };

      const updated = [...customReciters, newReciterObj];
      setCustomReciters(updated);
      await localforage.setItem('customReciters', updated);

      if (permanentPhotoUrl || data.bio.trim()) {
        updateReciterOverride(newId, {
          name: newReciterObj.name,
          nameArabic: newReciterObj.nameArabic,
          category: newReciterObj.category,
          imageUrl: permanentPhotoUrl,
          bio: data.bio.trim() || undefined,
        });
      }

      try {
        await appApi('/admin/reciters', {
          method: 'POST',
          body: {
            id: newId,
            name: newReciterObj.name,
            nameArabic: newReciterObj.nameArabic,
            style: newReciterObj.style,
            category: newReciterObj.category,
            bio: newReciterObj.bio,
            imageUrl: permanentPhotoUrl,
            serverUrl: '',
          },
        });
      } catch (e) {
        console.warn('Global reciter sync note:', e);
      }

      if (user) {
        try {
          await appApi('/me/reciters', { method: 'POST', body: newReciterObj });
        } catch (e) {
          console.warn('Reciter added on device, personal sync skipped:', e);
        }
      }

      await refreshGlobalCatalog();
      setShowAddReciterModal(false);
      showToast(`Added ${newReciterObj.name} and synced to all devices!`, 'success');
      setManagingReciterId(newId);
      setActiveTab('reciters');
    } catch (err: any) {
      setAddReciterError(err?.message || 'Could not create reciter.');
    } finally {
      setIsSubmittingReciter(false);
    }
  };

  // DELETE RECITER
  const handleDeleteCustomReciter = (reciter: Reciter) => {
    setPendingConfirm({
      message: `Delete "${reciter.name}" from your catalog?`,
      onConfirm: async () => {
        const updated = customReciters.filter(r => r.id !== reciter.id);
        setCustomReciters(updated);
        await localforage.setItem('customReciters', updated);

        const toRemove = recitations.filter(r => r.reciterId === reciter.id);
        for (const rec of toRemove) {
          await deleteRecitation(rec.id);
        }
        setRecitations(recitations.filter(r => r.reciterId !== reciter.id));

        if (managingReciterId === reciter.id) {
          setManagingReciterId(null);
        }

        try {
          await appApi('/admin/reciters', {
            method: 'POST',
            body: { id: reciter.id, action: 'delete' },
          });
        } catch {}

        if (user) {
          try {
            await appApi(`/me/reciters/${encodeURIComponent(reciter.id)}`, { method: 'DELETE' });
          } catch (e) {
            console.warn('Server delete failed', e);
          }
        }

        await refreshGlobalCatalog();
        showToast(`Removed "${reciter.name}".`, 'success');
      },
    });
  };

  // UPLOAD SURAH
  const handleUploadSurahFile = async (chapter: Chapter, file: File) => {
    if (!managingReciter) return;

    setUploadingSurahId(chapter.id);
    setUploadProgress(0);

    try {
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

      showToast(`Surah ${chapter.id}. ${chapter.name_simple} saved from your phone!`, 'success');
    } catch (err: any) {
      console.error('Surah upload error:', err);
      showToast(err?.message || 'Failed to upload surah audio file.', 'error');
    } finally {
      setUploadingSurahId(null);
      setUploadProgress(0);
    }
  };

  // DELETE SURAH AUDIO
  const handleDeleteSurahAudio = (chapterId: number) => {
    const existing = reciterSurahMap.get(chapterId);
    if (!existing) return;

    setPendingConfirm({
      message: `Delete the uploaded audio for Surah ${chapterId}?`,
      onConfirm: async () => {
        try {
          await deleteRecitation(existing.id);
          setRecitations(recitations.filter(r => r.id !== existing.id));
          showToast(`Removed audio for Surah ${chapterId}.`, 'success');
        } catch {
          showToast('Could not delete audio.', 'error');
        }
      },
    });
  };

  const activeVideoName = useMemo(() => {
    if (!activeBackgroundVideoId) return 'Sacred Canvas';
    const match = customVideos.find(
      v => v.videoUrl === activeBackgroundVideoId || v.id === activeBackgroundVideoId
    );
    if (match) return match.name;
    return activeBackgroundVideoId.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Sacred Canvas';
  }, [activeBackgroundVideoId, customVideos]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto pb-32"
    >
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

      {/* Confirmation Dialog */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D121F] border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <p className="text-sm text-white font-medium">{pendingConfirm.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = pendingConfirm.onConfirm;
                  setPendingConfirm(null);
                  await fn();
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 flex items-center justify-center border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.15)]">
            <SettingsIcon className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-white tracking-tight">Admin &amp; Settings</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Personal sanctuary preferences, custom recitations, and atmospheric controls.
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold self-start sm:self-auto">
            <ShieldCheck size={16} className="text-teal-400" />
            <span>Admin Authority Active</span>
          </div>
        )}
      </div>

      {/* Clean Tab Navigation */}
      <div className="flex items-center gap-2 p-1 bg-[#050811] border border-slate-800 rounded-2xl mb-8 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab('profile');
            setManagingReciterId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-[#1F8A6A] text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <UserIcon size={15} />
          <span>General &amp; Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reciters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'reciters'
              ? 'bg-[#1F8A6A] text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Mic size={15} />
          <span>Sheikhs &amp; Audio ({allReciters.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('atmosphere');
            setManagingReciterId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'atmosphere'
              ? 'bg-[#1F8A6A] text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Video size={15} />
          <span>Atmosphere ({customVideos.length})</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setManagingReciterId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <Users size={15} />
            <span>Community &amp; Users</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'profile' && (
          <ProfileSection
            user={user}
            isAdmin={isAdmin}
            onSignOut={logOut}
            onRefreshUser={refreshUser}
            showToast={showToast}
          />
        )}

        {activeTab === 'reciters' && (
          <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-teal-900/40 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

            {managingReciter ? (
              <SurahUploadManager
                managingReciter={managingReciter}
                surahsList={surahsList}
                reciterSurahMap={reciterSurahMap}
                onBack={() => setManagingReciterId(null)}
                onPhotoUpload={handleReciterPhotoUpload}
                onUploadSurah={handleUploadSurahFile}
                onDeleteSurah={handleDeleteSurahAudio}
                uploadingSurahId={uploadingSurahId}
                uploadProgress={uploadProgress}
                showToast={showToast}
              />
            ) : (
              <ReciterManager
                allReciters={allReciters}
                customReciters={customReciters}
                recitations={recitations}
                onManageSurahs={id => setManagingReciterId(id)}
                onPhotoUpload={handleReciterPhotoUpload}
                onSaveBio={handleSaveBio}
                onDeleteCustomReciter={handleDeleteCustomReciter}
                onOpenAddModal={() => setShowAddReciterModal(true)}
              />
            )}
          </section>
        )}

        {activeTab === 'atmosphere' && (
          <BackgroundManager
            customVideos={customVideos}
            setCustomVideos={setCustomVideos}
            activeBackgroundVideoId={activeBackgroundVideoId}
            setActiveBackgroundVideoId={setActiveBackgroundVideoId}
            isAdmin={isAdmin}
            refreshGlobalCatalog={refreshGlobalCatalog}
            syncLocalAssetsToCloud={syncLocalAssetsToCloud}
            showToast={showToast}
          />
        )}

        {activeTab === 'admin' && isAdmin && (
          <AdminUsersSection
            isAdmin={isAdmin}
            activeBackgroundVideoName={activeVideoName}
            showToast={showToast}
          />
        )}
      </div>

      {/* Add Reciter Modal */}
      <AddReciterModal
        isOpen={showAddReciterModal}
        onClose={() => setShowAddReciterModal(false)}
        onSubmit={handleCreateReciter}
        isSubmitting={isSubmittingReciter}
        error={addReciterError}
        sectionOptions={SECTION_OPTIONS}
      />
    </motion.div>
  );
}
