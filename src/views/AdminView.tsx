import React, { useState, useEffect, useRef } from 'react';
import { appApi } from '../lib/api';
import {
  Shield,
  Users,
  Video,
  Music,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Image as ImageIcon,
  Save,
  RefreshCw,
  Pencil,
  ImagePlus,
  X,
} from 'lucide-react';
import { CURATED_RECITERS } from '../lib/constants';
import { ReciterAvatar } from '../components/ReciterAvatar';
import {
  processAndStoreFile,
  getStoredMediaList,
  deleteStoredMedia,
  resizeImageToDataUrl,
  StoredMediaItem,
  UPLOAD_RULES,
} from '../lib/upload';
import { usePlayer } from '../context/PlayerContext';
import { countRecitationsByReciter } from '../lib/recitations';
import { RecitationsAdmin } from './admin/RecitationsAdmin';
import { BackgroundsAdmin } from './admin/BackgroundsAdmin';
import localforage from 'localforage';
import type { Reciter } from '../types';

type TabId = 'reciters' | 'recitations' | 'backgrounds' | 'media' | 'users';

type Toast = (message: string, type?: 'success' | 'error') => void;
type AskConfirm = (title: string, message: string, onConfirm: () => Promise<void> | void) => void;

export function AdminView() {
  const {
    allReciters,
    customReciters,
    setCustomReciters,
    recitations,
    updateReciterOverride,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<TabId>('reciters');

  // Backend & Media state
  const [users, setUsers] = useState<any[]>([]);
  const [globalReciters, setGlobalReciters] = useState<any[]>([]);
  const [ambientSettings, setAmbientSettings] = useState<Record<string, string>>({});
  const [storedMedia, setStoredMedia] = useState<StoredMediaItem[]>([]);

  // Upload UI state (media library tab)
  const [uploadCategory, setUploadCategory] = useState<'image' | 'audio' | 'video'>('image');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reciter editor state
  const [editing, setEditing] = useState<Reciter | null>(null);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editServerUrl, setEditServerUrl] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editPhotoData, setEditPhotoData] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewMedia, setPreviewMedia] = useState<StoredMediaItem | null>(null);

  // Confirmation Modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast: Toast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const askConfirm: AskConfirm = (title, message, onConfirm) =>
    setConfirmDialog({ isOpen: true, title, message, onConfirm });

  const runConfirm = async () => {
    try {
      await confirmDialog.onConfirm();
    } finally {
      // Every confirmation closes itself once its action settles.
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  useEffect(() => {
    fetchAdminData();
    loadStoredMedia();
  }, []);

  const loadStoredMedia = async () => {
    try {
      const items = await getStoredMediaList();
      setStoredMedia(items);
    } catch (err) {
      console.warn('Failed to load media files', err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const data = await appApi<{
        users: any[];
        globalReciters: any[];
        ambientSounds: Record<string, string>;
      }>('/admin/overview');
      setUsers(data.users || []);
      setGlobalReciters(data.globalReciters || []);
      setAmbientSettings(data.ambientSounds || {});
    } catch (e) {
      console.error('Failed to fetch admin data', e);
    }
    setLoading(false);
  };

  // Media library tab: browse from device -> validate -> store
  const handleFileUpload = async (file: File) => {
    setUploadError('');
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const stored = await processAndStoreFile(file, uploadCategory, setUploadProgress);
      setStoredMedia((prev) => [stored, ...prev]);
      showToast(`Uploaded ${stored.name} successfully!`, 'success');
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteMedia = (item: StoredMediaItem) => {
    askConfirm(
      'Delete Media File',
      `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      async () => {
        try {
          await deleteStoredMedia(item.id);
          setStoredMedia((prev) => prev.filter((m) => m.id !== item.id));
          if (previewMedia?.id === item.id) setPreviewMedia(null);
          showToast('Media file deleted.', 'success');
        } catch {
          showToast('Failed to delete media.', 'error');
        }
      }
    );
  };

  // Reciters tab (prompt 3.1)
  const recitationCounts = countRecitationsByReciter(recitations);
  const isCuratedId = (id: string) => CURATED_RECITERS.some((r) => r.id === id);

  const openEditReciter = (reciter: Reciter) => {
    setEditing(reciter);
    setEditName(reciter.name);
    setEditBio(reciter.bio || '');
    setEditServerUrl(reciter.serverUrl || '');
    setEditPhotoUrl(reciter.imageUrl?.startsWith('http') ? reciter.imageUrl : '');
    setEditPhotoData('');
  };

  const handlePickPhoto = async (file: File) => {
    const dataUrl = await resizeImageToDataUrl(file);
    if (!dataUrl) {
      showToast('Could not read that image. Try a JPG or PNG.', 'error');
      return;
    }
    setEditPhotoData(dataUrl);
    showToast('Photo ready — save the reciter to apply it.', 'success');
  };

  const handleSaveReciter = async () => {
    if (!editing) return;
    const isCurated = isCuratedId(editing.id);
    const name = editName.trim();
    const serverUrl = editServerUrl.trim();
    if (!isCurated && (!name || !serverUrl)) {
      showToast('Name and server URL are required.', 'error');
      return;
    }
    const photoUrl = editPhotoData || editPhotoUrl.trim();
    setEditSaving(true);
    try {
      // 1) Device-local + instant (portrait + bio for any sheikh, curated included).
      updateReciterOverride(editing.id, {
        bio: editBio.trim() || undefined,
        ...(photoUrl ? { imageUrl: photoUrl } : {}),
      });
      // 2) Global catalog — visible to every visitor. Only absolute http(s) photos
      //    pass the server-side image sanitiser, so a device upload stays local.
      if (photoUrl.startsWith('http')) {
        await appApi('/admin/reciters', {
          method: 'POST',
          body: {
            id: editing.id,
            name: name || editing.name,
            serverUrl: serverUrl || editing.serverUrl,
            imageUrl: photoUrl,
          },
        });
      } else if (!isCurated) {
        await appApi('/admin/reciters', {
          method: 'POST',
          body: { id: editing.id, name, serverUrl },
        });
        const updated = customReciters.some((r) => r.id === editing.id)
          ? customReciters.map((r) => (r.id === editing.id ? { ...r, name, serverUrl } : r))
          : [...customReciters, { id: editing.id, name, style: 'Custom', serverUrl }];
        setCustomReciters(updated);
        await localforage.setItem('customReciters', updated);
      }
      await fetchAdminData();
      showToast(`Saved ${name || editing.name}.`, 'success');
      setEditing(null);
    } catch (e: any) {
      showToast(e?.message || 'Saved on this device only — the server rejected the change.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteReciter = (reciter: Reciter) => {
    askConfirm(
      'Delete Reciter',
      `Remove "${reciter.name}" from the catalog? Their uploaded recitation files stay on this device.`,
      async () => {
        try {
          await appApi(`/admin/reciters?id=${encodeURIComponent(reciter.id)}`, { method: 'DELETE' });
        } catch {
          // Not in the global catalog (device-local only) — local removal is enough.
        }
        const updated = customReciters.filter((r) => r.id !== reciter.id);
        setCustomReciters(updated);
        await localforage.setItem('customReciters', updated);
        setGlobalReciters((prev) => prev.filter((r: any) => r.id !== reciter.id));
        showToast('Reciter deleted.', 'success');
      }
    );
  };

  // Ambient sound -> video URL mapping (global)
  const handleSaveAmbient = async () => {
    setSaving(true);
    try {
      await appApi('/admin/ambient', { method: 'PUT', body: { sounds: ambientSettings } });
      showToast('Ambient backgrounds saved successfully!', 'success');
    } catch {
      showToast('Failed to save ambient settings.', 'error');
    }
    setSaving(false);
  };

  // Users tab
  const handleRoleToggle = (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    askConfirm('Change User Role', `Change user role to ${newRole.toUpperCase()}?`, async () => {
      try {
        await appApi('/admin/role', { method: 'PUT', body: { userId, role: newRole } });
        setUsers(users.map((u) => (u.userId === userId ? { ...u, role: newRole } : u)));
        showToast(`Role changed to ${newRole}.`, 'success');
      } catch {
        showToast('Failed to update role.', 'error');
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 text-teal-400 gap-3">
        <RefreshCw className="animate-spin" size={20} />
        <span>Loading Admin Panel...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold border backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 ${
            toast.type === 'success'
              ? 'bg-teal-950/90 text-teal-300 border-teal-500/40'
              : 'bg-red-950/90 text-red-300 border-red-500/40'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-400 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={runConfirm}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage reciters, recitation audio, ambient backgrounds, media, and user roles.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-[#131722] p-1.5 rounded-2xl border border-slate-800">
          {([
            ['reciters', 'Reciters', Users],
            ['recitations', 'Recitations', Music],
            ['backgrounds', 'Backgrounds', Video],
            ['media', 'File Library', Upload],
          ] as Array<[TabId, string, any]>).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === id ? 'bg-teal-500 text-slate-900 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB: RECITERS */}
      {activeTab === 'reciters' && (
        <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="text-teal-400" size={20} />
                Reciters ({allReciters.length})
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Every sheikh in the app: the curated hall of fame, your device additions, and the global
                catalog. Upload a portrait from your phone or paste a link, add a bio, and manage each profile.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {allReciters.map((reciter) => (
              <div
                key={reciter.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#131722]/60 p-4 rounded-2xl border border-slate-800"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 shrink-0">
                    <ReciterAvatar reciter={reciter} className="w-12 h-12 rounded-xl" contentClassName="text-sm" shape="circle" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{reciter.name}</h3>
                      {isCuratedId(reciter.id) && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Curated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {reciter.style || 'Reciter'}
                      {reciter.serverUrl ? ` · ${reciter.serverUrl}` : ''}
                    </p>
                    {reciter.bio && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{reciter.bio}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400">
                    {recitationCounts[reciter.id] || 0} recitation{recitationCounts[reciter.id] === 1 ? '' : 's'}
                  </span>
                  <button
                    onClick={() => openEditReciter(reciter)}
                    className="text-teal-400 hover:text-teal-300 p-2 rounded-lg hover:bg-teal-500/10 transition-colors"
                    title="Edit reciter"
                  >
                    <Pencil size={16} />
                  </button>
                  {!isCuratedId(reciter.id) && (
                    <button
                      onClick={() => handleDeleteReciter(reciter)}
                      className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete reciter"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB: RECITATIONS */}
      {activeTab === 'recitations' && (
        <RecitationsAdmin showToast={showToast} askConfirm={askConfirm} />
      )}

      {/* TAB: BACKGROUNDS */}
      {activeTab === 'backgrounds' && (
        <BackgroundsAdmin
          showToast={showToast}
          askConfirm={askConfirm}
          ambientSettings={ambientSettings}
          setAmbientSettings={setAmbientSettings}
          onSaveAmbient={handleSaveAmbient}
          savingAmbient={saving}
        />
      )}

      {/* TAB: MEDIA LIBRARY */}
      {activeTab === 'media' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Upload size={18} className="text-teal-400" />
                  Multimedia Upload Infrastructure
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Upload reciter photos, Quran audio, and ambient background video loops
                  with automatic validation and preview.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#131722] p-1 rounded-xl border border-slate-800">
                {(['image', 'audio', 'video'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setUploadCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      uploadCategory === cat
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat === 'image' ? 'Images' : cat === 'audio' ? 'Audio' : 'Video'}
                  </button>
                ))}
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-teal-400 bg-teal-500/10'
                  : 'border-slate-700/80 hover:border-teal-500/50 bg-[#131722]/50 hover:bg-[#131722]/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={UPLOAD_RULES[uploadCategory].allowedTypes.join(',')}
                onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
              />

              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-4">
                {uploadCategory === 'image' ? <ImageIcon size={28} /> : uploadCategory === 'audio' ? <Music size={28} /> : <Video size={28} />}
              </div>

              <h3 className="text-sm font-semibold text-white mb-1">
                Drop your {UPLOAD_RULES[uploadCategory].categoryName} here, or browse
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Max size: {UPLOAD_RULES[uploadCategory].maxSizeMB} MB. Allowed formats:{' '}
                {uploadCategory === 'image'
                  ? 'JPG, PNG, WEBP, GIF'
                  : uploadCategory === 'audio'
                  ? 'MP3, WAV, M4A, OGG'
                  : 'MP4, WebM'}
              </p>

              {isUploading && (
                <div className="mt-6 max-w-md mx-auto space-y-2">
                  <div className="flex justify-between text-xs text-teal-300 font-medium">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="mt-4 text-xs text-red-400 bg-red-500/10 py-2 px-4 rounded-xl inline-block border border-red-500/20">
                  {uploadError}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-teal-400" />
                Uploaded Media Library ({storedMedia.length})
              </h2>
              <button onClick={loadStoredMedia} className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {storedMedia.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No files uploaded yet. Drag and drop a file above to add to your library.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {storedMedia.map((item) => (
                  <div key={item.id} className="bg-[#131722]/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
                    <div>
                      <div className="w-full h-32 rounded-xl bg-[#030712] border border-slate-800/60 overflow-hidden mb-3 flex items-center justify-center relative">
                        {item.type === 'image' ? (
                          <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                        ) : item.type === 'video' ? (
                          <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-teal-400">
                            <Music size={32} />
                            <span className="text-[10px] text-slate-500">Audio Track</span>
                          </div>
                        )}
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-black/60 text-white backdrop-blur-md">
                          {item.type}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate mb-1" title={item.name}>{item.name}</h4>
                      <p className="text-[10px] text-slate-500">
                        {(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60">
                      <button onClick={() => setPreviewMedia(item)} className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1">
                        <Eye size={13} /> Preview
                      </button>
                      <button onClick={() => handleDeleteMedia(item)} className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1">
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {previewMedia && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white truncate">{previewMedia.name}</h3>
                  <button onClick={() => setPreviewMedia(null)} className="text-xs text-slate-400 hover:text-white">Close</button>
                </div>
                <div className="rounded-2xl overflow-hidden bg-black/60 border border-slate-800 mb-4 flex items-center justify-center max-h-96">
                  {previewMedia.type === 'image' && <img src={previewMedia.url} alt={previewMedia.name} className="max-h-96 w-auto object-contain" />}
                  {previewMedia.type === 'video' && <video src={previewMedia.url} controls autoPlay className="w-full max-h-96" />}
                  {previewMedia.type === 'audio' && (
                    <div className="p-8 w-full"><audio src={previewMedia.url} controls className="w-full" /></div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setPreviewMedia(null)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white">Done</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: USERS */}
      {activeTab === 'users' && (
        <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Users className="text-teal-400" size={20} />
            User Roles Management ({users.length})
          </h2>
          <p className="text-xs text-slate-400 mb-6">Assign Administrator privileges to designated users.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-4">User</th>
                  <th className="pb-3 px-4">Email</th>
                  <th className="pb-3 px-4">Role</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-teal-400 font-bold flex items-center justify-center text-xs">
                            {(u.displayName || u.email || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-semibold text-white">{u.displayName || 'Unnamed User'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button onClick={() => handleRoleToggle(u.userId, u.role || 'user')} className="text-teal-400 hover:text-teal-300 text-xs font-semibold underline">
                        Toggle Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reciter editor modal (prompt 3.1: name, bio, device photo upload, preview) */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white">Edit Reciter</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-5">
              <div className="w-20 h-20 shrink-0">
                <ReciterAvatar
                  reciter={{ name: editName || editing.name, imageUrl: editPhotoData || editPhotoUrl || editing.imageUrl }}
                  className="w-20 h-20 rounded-2xl"
                  contentClassName="text-xl"
                  shape="circle"
                />
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-semibold hover:bg-teal-500/25 transition-colors"
                >
                  <ImagePlus size={14} /> Upload photo from device
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePickPhoto(f); }}
                />
                <p className="text-[10px] text-slate-500 max-w-[220px]">
                  JPG/PNG from your phone or computer. Images are resized to 512px automatically.
                  Photos uploaded here are stored on this device; a pasted link syncs to every visitor.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isCuratedId(editing.id)}
                  className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Bio / Description</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  placeholder="A line or two about this sheikh, shown across the app."
                  className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Server Base URL</label>
                <input
                  value={editServerUrl}
                  onChange={(e) => setEditServerUrl(e.target.value)}
                  disabled={isCuratedId(editing.id)}
                  placeholder="https://server.net/"
                  className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono outline-none focus:border-teal-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Portrait link (optional, syncs to every visitor)</label>
                <input
                  value={editPhotoUrl}
                  onChange={(e) => { setEditPhotoUrl(e.target.value); setEditPhotoData(''); }}
                  placeholder="https://site.net/sheikh.jpg"
                  className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={handleSaveReciter}
                disabled={editSaving}
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-900 text-xs font-bold flex items-center gap-2"
              >
                <Save size={14} /> {editSaving ? 'Saving...' : 'Save reciter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
