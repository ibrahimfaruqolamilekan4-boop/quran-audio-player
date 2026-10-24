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
  Users,
  Shield,
  UserCheck,
  ExternalLink,
  Mail,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { ReciterAvatar } from '../components/ReciterAvatar';
import { DownloadManager } from '../components/DownloadManager';
import { resizeImageToDataUrl, uploadMediaToServer, mediaStore } from '../lib/upload';
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
    refreshGlobalCatalog,
    syncLocalAssetsToCloud,
  } = usePlayer();

  const { user, role, logOut } = useAuth();
  const navigate = useNavigate();

  // Admin check: true if role === 'admin' OR signed in with the admin email OR in owner studio
  const isAdmin =
    !user ||
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
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [isSyncingCloudAssets, setIsSyncingCloudAssets] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ============================================================
  // ADMIN USER & COMMUNITY MANAGEMENT
  // ============================================================
  const [adminUsers, setAdminUsers] = useState<Array<{
    userId: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    role: 'user' | 'admin';
    createdAt: string;
    lastLoginAt: string;
  }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'user' | 'admin'>('user');
  const [addingMember, setAddingMember] = useState(false);

  const fetchAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await appApi<{ users: Array<any> }>('/admin/overview');
      if (Array.isArray(data?.users)) {
        setAdminUsers(data.users);
      }
    } catch (err: any) {
      console.warn('Could not load admin users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminUsers();
    }
  }, [isAdmin]);

  const handleAddRestoreUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newMemberEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid user email address.', 'error');
      return;
    }
    setAddingMember(true);
    try {
      const res = await appApi<{ ok: boolean; users?: Array<any> }>('/admin/role', {
        method: 'POST',
        body: {
          action: 'add_user',
          email,
          displayName: newMemberName.trim() || email.split('@')[0],
          role: newMemberRole,
        },
      });
      if (Array.isArray(res?.users)) {
        setAdminUsers(res.users);
      } else {
        await fetchAdminUsers();
      }
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberRole('user');
      showToast(`Added / restored ${email} in community directory!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not add user.', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateRole = async (targetUser: { userId: string; email: string; displayName: string | null }, newRole: 'user' | 'admin') => {
    if (targetUser.email.toLowerCase() === 'ibrahimfaruqolamilekan4@gmail.com' && newRole === 'user') {
      showToast('Master admin account cannot be demoted.', 'error');
      return;
    }
    setUpdatingUserId(targetUser.userId);
    try {
      await appApi('/admin/role', {
        method: 'PUT',
        body: { userId: targetUser.userId, role: newRole }
      });
      setAdminUsers(prev => prev.map(u => u.userId === targetUser.userId ? { ...u, role: newRole } : u));
      showToast(`Updated ${targetUser.displayName || targetUser.email} role to ${newRole.toUpperCase()}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update user role.', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredAdminUsers = useMemo(() => {
    return adminUsers.filter(u => {
      const q = userSearchQuery.toLowerCase();
      const matchesSearch =
        u.email.toLowerCase().includes(q) ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        u.userId.toLowerCase().includes(q);
      const matchesRole =
        userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [adminUsers, userSearchQuery, userRoleFilter]);

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

  // 1. CHANGE PROFILE PICTURE DIRECTLY FROM PHONE / SYSTEM PHOTO
  const handleReciterPhotoUpload = async (reciterId: string, file: File) => {
    try {
      const dataUrl = await resizeImageToDataUrl(file, 512, 0.88);
      if (!dataUrl) {
        showToast('Could not read image file. Please choose a JPG or PNG.', 'error');
        return;
      }

      // 1. Instant local visual update
      updateReciterOverride(reciterId, { imageUrl: dataUrl });

      const reciter = allReciters.find(r => r.id === reciterId);
      if (reciter && customReciters.some(c => c.id === reciterId)) {
        const updated = customReciters.map(c =>
          c.id === reciterId ? { ...c, imageUrl: dataUrl } : c
        );
        setCustomReciters(updated);
        await localforage.setItem('customReciters', updated);
      }

      // 2. Global server sync â€” persist to /api/media and /api/admin/reciters so phones, tablets, and all users get this portrait!
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
      showToast(`Profile picture for ${reciter?.name || 'sheikh'} synced to all phones, tablets, and users!`, 'success');
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

    setEditingBioReciterId(null);
    showToast('Reciter biography saved and synced across all devices.', 'success');
  };

  // 3. ADD NEW RECITER (WITH PHONE / SYSTEM PHOTO)
  const handleCreateReciter = async () => {
    setAddReciterError('');
    if (!newReciterName.trim()) {
      setAddReciterError('Please enter the name of the reciter.');
      return;
    }

    setIsSubmittingReciter(true);
    try {
      const newId = 'custom_' + Date.now();
      let permanentPhotoUrl = newReciterPhotoData || undefined;

      // Upload profile picture to cloud media storage so phones, tablets, and all users can load it
      if (newReciterPhotoData) {
        try {
          const hosted = await uploadMediaToServer(newReciterPhotoData, {
            filename: `sheikh_${newId}.jpg`,
            name: newReciterName.trim(),
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
        name: newReciterName.trim(),
        nameArabic: newReciterArabicName.trim() || undefined,
        style: 'Murattal',
        category: newReciterSection,
        bio: newReciterBio.trim() || undefined,
        imageUrl: permanentPhotoUrl,
        serverUrl: '',
      };

      const updated = [...customReciters, newReciterObj];
      setCustomReciters(updated);
      await localforage.setItem('customReciters', updated);

      if (permanentPhotoUrl || newReciterBio.trim()) {
        updateReciterOverride(newId, {
          name: newReciterObj.name,
          nameArabic: newReciterObj.nameArabic,
          category: newReciterObj.category,
          imageUrl: permanentPhotoUrl,
          bio: newReciterBio.trim() || undefined,
        });
      }

      // Sync to global_reciters so all users, phones, and tablets see this sheikh & portrait!
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

      // Also sync to user's personal reciters if authenticated
      if (user) {
        try {
          await appApi('/me/reciters', { method: 'POST', body: newReciterObj });
        } catch (e) {
          console.warn('Reciter added on device, personal sync skipped:', e);
        }
      }

      await refreshGlobalCatalog();

      // Reset modal fields
      setNewReciterName('');
      setNewReciterArabicName('');
      setNewReciterBio('');
      setNewReciterPhotoData(null);
      setShowAddReciterModal(false);

      showToast(`Added ${newReciterObj.name} and synced to all devices!`, 'success');
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

    setVideoUploading(true);
    setVideoUploadProgress(5);
    try {
      const blob = new Blob([await videoFile.arrayBuffer()], { type: videoFile.type || 'video/mp4' });
      const id = 'custom_vid_' + Date.now();
      const cleanName = videoFile.name.replace(/\.[^/.]+$/, '');
      let publicUrl = id;

      // Save locally in localforage for instant playback on this system
      await localforage.setItem('customVideo_blob_' + id, blob);
      await localforage.setItem(id, blob);
      setVideoUploadProgress(15);

      // 1. Upload video in chunks to server media storage so every phone, tablet, and computer can stream it!
      try {
        const hostedUrl = await uploadMediaToServer(
          videoFile,
          {
            filename: videoFile.name,
            name: cleanName,
            type: videoFile.type || 'video/mp4',
            isDefault: true,
          },
          pct => setVideoUploadProgress(15 + Math.round(pct * 0.75))
        );

        if (hostedUrl) {
          publicUrl = hostedUrl;
        }
      } catch (uploadErr) {
        console.warn('Could not stream to /api/media, using fallback:', uploadErr);
      }

      const newEntry = {
        id,
        name: cleanName,
        videoUrl: publicUrl,
        sizeBytes: videoFile.size,
        isDefault: true,
        createdAt: Date.now(),
      };
      const updated = [newEntry, ...customVideos.map(v => ({ ...v, isDefault: false }))];
      setCustomVideos(updated);
      await localforage.setItem('customVideos_list', updated);
      setActiveBackgroundVideoId(publicUrl);
      setVideoFile(null);

      // 2. Broadcast to all users / devices via backend ambient service
      try {
        await appApi('/admin/ambient', {
          method: 'POST',
          body: { action: 'add_video', id, name: cleanName, videoUrl: publicUrl, isDefault: true },
        });
        await appApi('/admin/ambient', {
          method: 'POST',
          body: { action: 'set_default', id, videoUrl: publicUrl },
        });
      } catch (ambientErr) {
        console.warn('Could not broadcast ambient video:', ambientErr);
      }

      await refreshGlobalCatalog();
      setVideoUploadProgress(100);
      showToast('Background video uploaded and broadcast to all phones, tablets, and computers!', 'success');
    } catch (err: any) {
      setVideoError(err?.message || 'Failed to upload video.');
      showToast(err?.message || 'Failed to upload video.', 'error');
    } finally {
      setVideoUploading(false);
      setVideoUploadProgress(0);
    }
  };

  const handleManualCloudSync = async () => {
    setIsSyncingCloudAssets(true);
    setSyncStatusText('Syncing saved videos and sheikh portraits to cloud...');
    try {
      const { syncedPhotos, syncedVideos } = await syncLocalAssetsToCloud(msg => setSyncStatusText(msg));
      showToast(
        `Synced ${syncedPhotos} sheikh profile(s) & ${syncedVideos} background video(s) for all phones and tablets!`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Cloud sync encountered an issue.', 'error');
    } finally {
      setIsSyncingCloudAssets(false);
      setSyncStatusText('');
    }
  };

  const handleBroadcastPreset = async (url: string, name: string) => {
    setActiveBackgroundVideoId(url);
    if (isAdmin) {
      try {
        await appApi('/admin/ambient', {
          method: 'POST',
          body: { action: 'set_default', videoUrl: url }
        });
        showToast(`Broadcasted "${name}" to all user accounts!`, 'success');
        return;
      } catch {}
    }
    showToast(`Active background set to "${name}".`, 'success');
  };

  const handleRemoveVideo = async (id: string) => {
    const target = customVideos.find(v => v.id === id);
    if (activeBackgroundVideoId === id || (target?.videoUrl && activeBackgroundVideoId === target.videoUrl)) {
      setActiveBackgroundVideoId(null);
    }
    const updated = customVideos.filter(v => v.id !== id);
    setCustomVideos(updated);
    await localforage.setItem('customVideos_list', updated);
    await localforage.removeItem('customVideo_blob_' + id);
    await localforage.removeItem(id);
    try {
      await appApi('/admin/ambient', {
        method: 'POST',
        body: { action: 'delete_video', id },
      });
    } catch {}
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

        {/* Offline Surahs & Storage Manager */}
        <section>
          <DownloadManager />
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
                        <span>â€¢</span>
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
                              {surah.verses_count} verses â€¢ {surah.translated_name?.name || 'Surah'}
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
                      Upload portraits directly from your phone's photo library, edit bios, or click â€œUpload Surahsâ€ to attach downloaded MP3 files for all 114 surahs.
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
                                {reciter.bio || <span className="text-slate-600 italic">No biography added yet. Click â€œEdit Bioâ€ to add one.</span>}
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
                      placeholder="e.g. Ø§Ù„Ø´ÙŠØ® Ø¨Ù„Ø§Ù„ Ø§Ù„Ø¯Ø±Ø¨Ø§Ù„ÙŠ"
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
        {/* ADMIN USER & COMMUNITY MANAGEMENT CONSOLE */}
        {/* ============================================================ */}
        {isAdmin && (
          <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
            {/* Ambient gold-teal glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 blur-[90px] pointer-events-none" />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800/80">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <ShieldCheck size={14} />
                    <span>Admin Operations Hub</span>
                  </div>
                  <h2 className="text-2xl font-bold font-serif text-white tracking-wide flex items-center gap-2.5">
                    <Users className="w-6 h-6 text-teal-400" />
                    <span>User Management & Community</span>
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Monitor total registered users, govern account permissions, and manage the Nooraya global sanctuary.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchAdminUsers}
                    disabled={loadingUsers}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={loadingUsers ? 'animate-spin' : ''} />
                    <span>Refresh Users</span>
                  </button>

                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
                  >
                    <span>Full Admin Studio</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#050811] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
                    <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-serif text-white">
                    {adminUsers.length}
                  </div>
                  <span className="text-[11px] text-teal-400/80 mt-1">Community Members</span>
                </div>

                <div className="bg-[#050811] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Administrators</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Shield size={16} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-serif text-amber-300">
                    {adminUsers.filter(u => u.role === 'admin').length}
                  </div>
                  <span className="text-[11px] text-amber-400/80 mt-1">Full System Authority</span>
                </div>

                <div className="bg-[#050811] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Standard Users</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <UserCheck size={16} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-serif text-blue-300">
                    {adminUsers.filter(u => u.role !== 'admin').length}
                  </div>
                  <span className="text-[11px] text-blue-400/80 mt-1">Active Worshipers</span>
                </div>

                <div className="bg-[#050811] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Atmosphere</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Video size={16} />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-emerald-300 truncate">
                    {activeBackgroundVideoId ? activeBackgroundVideoId.split('/').pop()?.replace('.mp4', '') : 'Cosmos'}
                  </div>
                  <span className="text-[11px] text-emerald-400/80 mt-1">Live Global Broadcast</span>
                </div>
              </div>

              {/* Add / Restore Community Member Bar */}
              <form
                onSubmit={handleAddRestoreUser}
                className="bg-[#050811]/90 border border-slate-800/80 rounded-2xl p-4 mb-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-4">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Member Email
                  </label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={e => setNewMemberEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={e => setNewMemberName(e.target.value)}
                    placeholder="Full Name (optional)"
                    className="w-full bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Role
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={e => setNewMemberRole(e.target.value as 'user' | 'admin')}
                    className="w-full bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="w-full py-2 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{addingMember ? 'Saving...' : 'Add / Restore'}</span>
                  </button>
                </div>
              </form>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={e => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or user ID..."
                    className="w-full bg-[#050811] border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-[#050811] p-1 rounded-2xl border border-slate-800 text-xs self-start">
                  <button
                    onClick={() => setUserRoleFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                      userRoleFilter === 'all'
                        ? 'bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({adminUsers.length})
                  </button>
                  <button
                    onClick={() => setUserRoleFilter('admin')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                      userRoleFilter === 'admin'
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Admins ({adminUsers.filter(u => u.role === 'admin').length})
                  </button>
                  <button
                    onClick={() => setUserRoleFilter('user')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                      userRoleFilter === 'user'
                        ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Users ({adminUsers.filter(u => u.role !== 'admin').length})
                  </button>
                </div>
              </div>

              {/* Users Directory Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-[#050811]/70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4 hidden md:table-cell">Registered</th>
                      <th className="py-3.5 px-4 hidden lg:table-cell">Last Active</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-teal-400" />
                          <span>Loading community directory...</span>
                        </td>
                      </tr>
                    ) : filteredAdminUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Users size={28} className="mx-auto mb-2 text-slate-600" />
                          <span>No users found matching "{userSearchQuery}"</span>
                        </td>
                      </tr>
                    ) : (
                      filteredAdminUsers.map(u => {
                        const isSelf = user?.email && u.email.toLowerCase() === user.email.toLowerCase();
                        const isMasterAdmin = u.email.toLowerCase() === 'ibrahimfaruqolamilekan4@gmail.com';
                        const isUpdating = updatingUserId === u.userId;

                        return (
                          <tr key={u.userId} className="hover:bg-white/[0.02] transition-colors">
                            {/* Avatar & Display Name */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt={u.displayName || 'User'} className="w-8 h-8 rounded-xl object-cover border border-slate-700" />
                                ) : (
                                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-xs uppercase">
                                    {(u.displayName || u.email)[0]}
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-white flex items-center gap-1.5">
                                    <span>{u.displayName || u.email.split('@')[0]}</span>
                                    {isSelf && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/30">You</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500 block truncate max-w-[140px]">{u.userId}</span>
                                </div>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                              {u.email}
                            </td>

                            {/* Role Badge */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {u.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                                  <Shield size={11} />
                                  <span>Admin</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-medium uppercase tracking-wider">
                                  <UserCheck size={11} />
                                  <span>User</span>
                                </span>
                              )}
                            </td>

                            {/* Registered */}
                            <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap hidden md:table-cell">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                            </td>

                            {/* Last Active */}
                            <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap hidden lg:table-cell">
                              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                            </td>

                            {/* Actions: Promote / Demote */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {isMasterAdmin ? (
                                <span className="text-[10px] text-amber-400/80 font-semibold px-2 py-1">Owner</span>
                              ) : (
                                <div className="inline-flex items-center gap-2">
                                  {u.role === 'admin' ? (
                                    <button
                                      onClick={() => handleUpdateRole(u, 'user')}
                                      disabled={isUpdating}
                                      className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-300 border border-slate-700 text-slate-300 text-[11px] font-medium transition-all disabled:opacity-50 cursor-pointer"
                                      title="Demote to standard user"
                                    >
                                      {isUpdating ? 'Updating...' : 'Set as User'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateRole(u, 'admin')}
                                      disabled={isUpdating}
                                      className="px-3 py-1 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-[11px] font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                                      title="Grant admin permissions"
                                    >
                                      {isUpdating ? 'Updating...' : 'Promote to Admin'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* CUSTOM BACKGROUND VIDEOS SECTION */}
        {/* ============================================================ */}
        <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-teal-400" />
                Custom Background Videos
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Upload your own video loops to play seamlessly in the background across all phones, tablets, and computers.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleManualCloudSync}
                disabled={isSyncingCloudAssets}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                title="Sync all videos and sheikh profile photos saved on this system so they show on phones, tablets, and for all users"
              >
                <RefreshCw size={14} className={isSyncingCloudAssets ? 'animate-spin' : ''} />
                <span>{isSyncingCloudAssets ? (syncStatusText || 'Syncing to Cloud...') : 'Sync Saved Videos & Photos to Phone'}</span>
              </button>
            )}
          </div>

          {/* ADMIN ONLY CONTROLS */}
          {isAdmin ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-2">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-teal-500/50 rounded-2xl p-6 cursor-pointer bg-[#050811]/50 transition-all group">
                    <Video className="w-8 h-8 text-slate-500 group-hover:text-teal-400 transition-colors mb-2" />
                    <span className="text-sm font-semibold text-slate-300">
                      {videoFile ? videoFile.name : 'Choose a video file from your system / phone'}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">Supports MP4, WebM, MOV (Automatically syncs to phones, tablets & all users)</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*"
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
                    disabled={!videoFile || videoUploading}
                    className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:hover:bg-teal-500 text-slate-950 font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/20"
                  >
                    <Upload size={18} />
                    {videoUploading ? `Uploading (${videoUploadProgress}%)...` : 'Upload & Broadcast'}
                  </button>
                </div>
              </div>

              {videoUploading && (
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-teal-500 transition-all duration-200"
                    style={{ width: `${videoUploadProgress}%` }}
                  />
                </div>
              )}

              {videoError && (
                <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
                  <AlertCircle size={16} />
                  <span>{videoError}</span>
                </div>
              )}

              {/* List of Admin Videos */}
              {customVideos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  {customVideos.map(vid => {
                    const isActive = activeBackgroundVideoId === vid.id || (vid.videoUrl && activeBackgroundVideoId === vid.videoUrl);
                    const isCloudSynced =
                      vid.videoUrl &&
                      (vid.videoUrl.startsWith('/api/media/') ||
                        vid.videoUrl.startsWith('https://') ||
                        vid.videoUrl.startsWith('http://'));
                    return (
                      <div key={vid.id} className="relative group bg-[#050811] border border-slate-800 rounded-2xl p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between overflow-hidden">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                              <Video size={16} className="text-teal-400" />
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-medium text-white truncate block">{vid.name}</span>
                              <span className="text-[10px] text-slate-500">
                                {isCloudSynced ? 'Synced for Phone & Tablet' : 'Saved on System (Click Set to Sync)'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveVideo(vid.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors shrink-0"
                            title="Remove video"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              let targetVal = vid.videoUrl || vid.id;
                              const isPortable =
                                targetVal.startsWith('/api/media/') ||
                                targetVal.startsWith('https://') ||
                                targetVal.startsWith('http://');

                              // If this video was saved locally on the system earlier, upload its blob to cloud now!
                              if (!isPortable) {
                                const blob =
                                  (await localforage.getItem<Blob>(vid.id)) ||
                                  (await localforage.getItem<Blob>(`customVideo_blob_${vid.id}`)) ||
                                  (await mediaStore.getItem<Blob>(vid.id));
                                if (blob) {
                                  showToast(`Syncing "${vid.name}" to cloud for phone & tablet playback...`, 'success');
                                  try {
                                    const hosted = await uploadMediaToServer(blob, {
                                      filename: `${vid.name || 'video'}.mp4`,
                                      name: vid.name,
                                      type: blob.type || 'video/mp4',
                                      isDefault: true,
                                    });
                                    if (hosted) {
                                      targetVal = hosted;
                                      const nextList = customVideos.map(item =>
                                        item.id === vid.id ? { ...item, videoUrl: hosted, isDefault: true } : { ...item, isDefault: false }
                                      );
                                      setCustomVideos(nextList);
                                      await localforage.setItem('customVideos_list', nextList);
                                    }
                                  } catch {}
                                }
                              }

                              setActiveBackgroundVideoId(targetVal);
                              try {
                                await appApi('/admin/ambient', {
                                  method: 'POST',
                                  body: { action: 'add_video', id: vid.id, name: vid.name, videoUrl: targetVal, isDefault: true }
                                });
                                await appApi('/admin/ambient', {
                                  method: 'POST',
                                  body: { action: 'set_default', id: vid.id, videoUrl: targetVal }
                                });
                                await refreshGlobalCatalog();
                                showToast(`"${vid.name}" is now active on all phones, tablets, and user accounts!`, 'success');
                              } catch {
                                showToast('Set active locally; server broadcast saved.', 'success');
                              }
                            }}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                              isActive
                                ? 'bg-teal-500 text-slate-900 border-teal-400 font-bold'
                                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-teal-500/50'
                            }`}
                          >
                            {isActive ? 'âœ“ Active on All Devices' : 'Set for All Devices & Phone'}
                          </button>
                          {vid.isDefault && (
                            <span className="text-[9px] text-amber-400 uppercase font-semibold">Global Default</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Admin Broadcast Presets */}
              <div className="mt-6 pt-6 border-t border-slate-800/80">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Fast Broadcast Presets (Broadcast to All User Accounts)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: 'Night Cosmos', url: '/videos/cosmos.mp4', icon: 'ðŸŒŒ' },
                    { name: 'Ocean Waves', url: '/videos/ocean.mp4', icon: 'ðŸŒŠ' },
                    { name: 'Gentle Rain', url: '/videos/rain.mp4', icon: 'ðŸŒ§ï¸' },
                    { name: 'Sacred Nature', url: '/videos/nature.mp4', icon: 'ðŸŒ¿' },
                  ].map(p => {
                    const isCurActive = activeBackgroundVideoId === p.url;
                    return (
                      <div 
                        key={p.url} 
                        className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 transition-all ${
                          isCurActive ? 'bg-teal-500/15 border-teal-500/50 shadow-[0_0_15px_rgba(45,212,191,0.15)]' : 'bg-[#050811] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{p.icon}</span>
                          <span className="text-xs font-medium text-white truncate">{p.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBroadcastPreset(p.url, p.name)}
                          className={`text-[10px] font-bold py-1.5 px-2 rounded-xl border transition-all ${
                            isCurActive 
                              ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-sm' 
                              : 'bg-slate-900 text-teal-300 border-teal-500/30 hover:bg-teal-500/20'
                          }`}
                        >
                          {isCurActive ? 'âœ“ Broadcasting' : 'Broadcast to All'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* REGULAR USER VIEW: Atmospheric status message */
            <div className="bg-[#050811]/60 border border-slate-800/80 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 mx-auto flex items-center justify-center mb-3">
                <Sparkles size={22} />
              </div>
              <h3 className="text-base font-semibold text-white">Synchronized Atmospheric Canvas</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
                The ambient background video is curated and broadcast globally by the administrator so every user shares the same sacred focus atmosphere.
              </p>
              {activeBackgroundVideoId && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-medium">
                  <Video size={13} />
                  <span>Active Ethereal Atmosphere Playing</span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
