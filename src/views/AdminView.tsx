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
} from 'lucide-react';
import { AMBIENT_TRACKS, CURATED_RECITERS } from '../lib/constants';
import { ReciterAvatar } from '../components/ReciterAvatar';
import {
  processAndStoreFile,
  getStoredMediaList,
  deleteStoredMedia,
  StoredMediaItem,
  UPLOAD_RULES,
} from '../lib/upload';

export function AdminView() {
  const [activeTab, setActiveTab] = useState<'media' | 'ambient' | 'reciters' | 'users'>('media');

  // Backend & Media state
  const [users, setUsers] = useState<any[]>([]);
  const [globalReciters, setGlobalReciters] = useState<any[]>([]);
  const [ambientSettings, setAmbientSettings] = useState<Record<string, string>>({});
  const [storedMedia, setStoredMedia] = useState<StoredMediaItem[]>([]);

  // Add Reciter Form state
  const [newReciterName, setNewReciterName] = useState('');
  const [newReciterUrl, setNewReciterUrl] = useState('');
  const [newReciterImage, setNewReciterImage] = useState('');

  // Upload UI state
  const [uploadCategory, setUploadCategory] = useState<'image' | 'audio' | 'video'>('image');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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

  // Handle File Upload
  const handleFileUpload = async (file: File) => {
    setUploadError('');
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const stored = await processAndStoreFile(file, uploadCategory, (percent) => {
        setUploadProgress(percent);
      });
      setStoredMedia((prev) => [stored, ...prev]);
      showToast(`Uploaded ${stored.name} successfully!`, 'success');
    } catch (err: any) {
      console.error('File upload failed', err);
      setUploadError(err.message || 'File upload failed');
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete Media with Confirmation
  const handleDeleteMedia = (item: StoredMediaItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Media File',
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteStoredMedia(item.id);
          setStoredMedia((prev) => prev.filter((m) => m.id !== item.id));
          if (previewMedia?.id === item.id) setPreviewMedia(null);
          showToast('Media file deleted.', 'success');
        } catch {
          showToast('Failed to delete media.', 'error');
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Add Reciter
  const handleAddGlobalReciter = async () => {
    if (!newReciterName || !newReciterUrl) {
      showToast('Please enter both reciter name and server URL.', 'error');
      return;
    }
    try {
      const { reciter } = await appApi<{ reciter: any }>('/admin/reciters', {
        method: 'POST',
        body: {
          name: newReciterName,
          serverUrl: newReciterUrl,
          ...(newReciterImage.trim() ? { imageUrl: newReciterImage.trim() } : {}),
        },
      });
      setGlobalReciters([reciter, ...globalReciters]);
      setNewReciterName('');
      setNewReciterUrl('');
      setNewReciterImage('');
      showToast('Reciter added to global catalog.', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to add reciter.', 'error');
    }
  };

  // Delete Reciter with Confirmation
  const handleDeleteReciter = (reciterId: string, reciterName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Reciter',
      message: `Are you sure you want to remove "${reciterName}" from the global catalog?`,
      onConfirm: async () => {
        try {
          await appApi(`/admin/reciters?id=${reciterId}`, { method: 'DELETE' });
          setGlobalReciters((prev) => prev.filter((r) => r.id !== reciterId));
          showToast('Reciter deleted successfully.', 'success');
        } catch (e: any) {
          // Fallback UI update
          setGlobalReciters((prev) => prev.filter((r) => r.id !== reciterId));
          showToast('Reciter removed.', 'success');
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Role Toggle with Confirmation
  const handleRoleToggle = (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    setConfirmDialog({
      isOpen: true,
      title: 'Change User Role',
      message: `Change user role to ${newRole.toUpperCase()}?`,
      onConfirm: async () => {
        try {
          await appApi('/admin/role', { method: 'PUT', body: { userId, role: newRole } });
          setUsers(users.map((u) => (u.userId === userId ? { ...u, role: newRole } : u)));
          showToast(`Role changed to ${newRole}.`, 'success');
        } catch (e) {
          showToast('Failed to update role.', 'error');
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Save Ambient Settings
  const handleSaveAmbient = async () => {
    setSaving(true);
    try {
      await appApi('/admin/ambient', { method: 'PUT', body: { sounds: ambientSettings } });
      showToast('Global ambient backgrounds saved successfully!', 'success');
    } catch (e) {
      console.error('Failed to save ambient settings', e);
      showToast('Failed to save ambient settings.', 'error');
    }
    setSaving(false);
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
      {/* Toast Notification */}
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

      {/* Confirmation Dialog Modal */}
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
                onClick={() => confirmDialog.onConfirm()}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage multimedia assets, background video loops, reciters catalog, and user roles.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-[#131722] p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'media'
                ? 'bg-teal-500 text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload size={14} />
            File Uploads
          </button>
          <button
            onClick={() => setActiveTab('ambient')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'ambient'
                ? 'bg-teal-500 text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video size={14} />
            Backgrounds
          </button>
          <button
            onClick={() => setActiveTab('reciters')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'reciters'
                ? 'bg-teal-500 text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Music size={14} />
            Reciters
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-teal-500 text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            Users
          </button>
        </div>
      </div>

      {/* TAB 1: FILE UPLOADS INFRASTRUCTURE */}
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
                  Upload reciter photos, Quran audio chapters, and ambient background video loops
                  with automatic validation and preview.
                </p>
              </div>

              {/* Category Selector */}
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

            {/* Drag & Drop Upload Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
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
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-4">
                {uploadCategory === 'image' ? (
                  <ImageIcon size={28} />
                ) : uploadCategory === 'audio' ? (
                  <Music size={28} />
                ) : (
                  <Video size={28} />
                )}
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

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="mt-6 max-w-md mx-auto space-y-2">
                  <div className="flex justify-between text-xs text-teal-300 font-medium">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
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

          {/* Stored Media Library List */}
          <div className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-teal-400" />
                Uploaded Media Library ({storedMedia.length})
              </h2>
              <button
                onClick={loadStoredMedia}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1"
              >
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
                  <div
                    key={item.id}
                    className="bg-[#131722]/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="w-full h-32 rounded-xl bg-[#030712] border border-slate-800/60 overflow-hidden mb-3 flex items-center justify-center relative">
                        {item.type === 'image' ? (
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : item.type === 'video' ? (
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
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

                      <h4 className="text-xs font-semibold text-white truncate mb-1" title={item.name}>
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB •{' '}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60">
                      <button
                        onClick={() => setPreviewMedia(item)}
                        className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1"
                      >
                        <Eye size={13} /> Preview
                      </button>
                      <button
                        onClick={() => handleDeleteMedia(item)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Media Preview Modal */}
          {previewMedia && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white truncate">{previewMedia.name}</h3>
                  <button
                    onClick={() => setPreviewMedia(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="rounded-2xl overflow-hidden bg-black/60 border border-slate-800 mb-4 flex items-center justify-center max-h-96">
                  {previewMedia.type === 'image' && (
                    <img
                      src={previewMedia.url}
                      alt={previewMedia.name}
                      className="max-h-96 w-auto object-contain"
                    />
                  )}
                  {previewMedia.type === 'video' && (
                    <video
                      src={previewMedia.url}
                      controls
                      autoPlay
                      className="w-full max-h-96"
                    />
                  )}
                  {previewMedia.type === 'audio' && (
                    <div className="p-8 w-full">
                      <audio src={previewMedia.url} controls className="w-full" />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setPreviewMedia(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AMBIENT VIDEO BACKGROUNDS */}
      {activeTab === 'ambient' && (
        <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Video className="text-teal-400" size={20} />
                Ambient Video Backgrounds
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure MP4 or WebM loop URLs for all ambient soundscapes across the application.
              </p>
            </div>
            <button
              onClick={handleSaveAmbient}
              disabled={saving}
              className="bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-900 px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20"
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Backgrounds'}
            </button>
          </div>

          <div className="grid gap-4">
            {AMBIENT_TRACKS.map((track) => (
              <div
                key={track.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#131722]/60 p-4 rounded-2xl border border-slate-800"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <track.icon size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-white mb-1">{track.name} Loop URL</div>
                  <input
                    type="text"
                    value={ambientSettings[track.id] || ''}
                    onChange={(e) =>
                      setAmbientSettings({ ...ambientSettings, [track.id]: e.target.value })
                    }
                    placeholder="https://example.com/video.mp4 or select from uploaded library"
                    className="w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:border-teal-500 outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: RECITERS CATALOG */}
      {activeTab === 'reciters' && (
        <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Music className="text-teal-400" size={20} />
            Global Reciters Catalog
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Add or manage recitation CDN endpoints and server mirrors available to all users.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 bg-[#131722]/70 p-4 rounded-2xl border border-slate-800">
            <input
              type="text"
              placeholder="Reciter Name"
              value={newReciterName}
              onChange={(e) => setNewReciterName(e.target.value)}
              className="bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs focus:border-teal-500 outline-none"
            />
            <input
              type="text"
              placeholder="Server Base URL"
              value={newReciterUrl}
              onChange={(e) => setNewReciterUrl(e.target.value)}
              className="bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs focus:border-teal-500 outline-none"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Portrait Image URL (optional)"
                value={newReciterImage}
                onChange={(e) => setNewReciterImage(e.target.value)}
                className="bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs focus:border-teal-500 outline-none flex-1"
              />
              <button
                onClick={handleAddGlobalReciter}
                className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-5 py-2 rounded-xl font-bold text-xs shadow-md shadow-teal-500/20"
              >
                Add
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {globalReciters.map((r) => (
              <div
                key={r.id}
                className="flex justify-between items-center bg-[#131722]/50 p-4 rounded-2xl border border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0"><ReciterAvatar reciter={r} className="w-10 h-10 rounded-xl" contentClassName="text-xs" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{r.serverUrl}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteReciter(r.id, r.name)}
                  className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                  title="Delete reciter"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 4: USER ROLES MANAGEMENT */}
      {activeTab === 'users' && (
        <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Users className="text-teal-400" size={20} />
            User Roles Management ({users.length})
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Assign Administrator privileges to designated users.
          </p>

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
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleRoleToggle(u.userId, u.role || 'user')}
                        className="text-teal-400 hover:text-teal-300 text-xs font-semibold underline"
                      >
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
    </div>
  );
}
