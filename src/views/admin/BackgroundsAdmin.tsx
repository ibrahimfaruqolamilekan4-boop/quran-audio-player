import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Video,
  Upload,
  Trash2,
  Save,
  RefreshCw,
  Play,
  X,
  Film,
  Globe,
  Star,
  Check,
  Sparkles,
  CloudUpload,
  AlertTriangle,
  FolderSync,
  Layers,
  ArrowUp,
  ArrowDown,
  Eye,
  Flame,
  CloudRain,
  Waves,
  Trees,
  Moon,
  Compass,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useBackgroundVideoSrc } from '../../lib/backgrounds';
import {
  validateAmbientVideo,
  extractVideoPoster,
  uploadToSupabaseStorage,
  fetchActiveBackgrounds,
  type BackgroundRow,
} from '../../lib/supabase';
import { formatBytes } from '../../lib/recitations';
import { appApi } from '../../lib/api';
import localforage from 'localforage';
import { mediaStore } from '../../lib/upload';
import type { CustomVideo } from '../../types';

type Toast = (message: string, type?: 'success' | 'error') => void;
type AskConfirm = (title: string, message: string, onConfirm: () => Promise<void> | void) => void;

interface Props {
  showToast: Toast;
  askConfirm: AskConfirm;
  ambientSettings: Record<string, string>;
  setAmbientSettings: (mapping: Record<string, string>) => void;
  onSaveAmbient: () => void;
  savingAmbient: boolean;
}

interface LocalDetectedItem {
  id: string;
  name: string;
  sizeBytes: number;
  blob?: Blob;
  videoUrl?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'fireplace', label: 'Fireplace', icon: Flame },
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'ocean', label: 'Ocean', icon: Waves },
  { id: 'forest', label: 'Forest', icon: Trees },
  { id: 'cosmos', label: 'Cosmos', icon: Compass },
  { id: 'night', label: 'Night', icon: Moon },
];

export function BackgroundsAdmin({
  showToast,
  askConfirm,
  ambientSettings,
  setAmbientSettings,
  onSaveAmbient,
  savingAmbient,
}: Props) {
  const {
    customVideos,
    setCustomVideos,
    activeBackgroundVideoId,
    setActiveBackgroundVideoId,
    refreshGlobalCatalog,
  } = usePlayer();

  // Cloud Backgrounds from Supabase / Postgres
  const [cloudBackgrounds, setCloudBackgrounds] = useState<BackgroundRow[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  // Local laptop detected backgrounds
  const [detectedLocal, setDetectedLocal] = useState<LocalDetectedItem[]>([]);
  const [scanningLocal, setScanningLocal] = useState(false);
  const [migratingId, setMigratingId] = useState<string | null>(null);
  const [isMigratingAll, setIsMigratingAll] = useState(false);

  // Upload new background form state
  const [bgNameEn, setBgNameEn] = useState('');
  const [bgNameAr, setBgNameAr] = useState('');
  const [bgCategory, setBgCategory] = useState('fireplace');
  const [bgVideoUrl, setBgVideoUrl] = useState('');
  const [bgPosterUrl, setBgPosterUrl] = useState('');
  const [bgIsPremium, setBgIsPremium] = useState(false);
  const [bgSortOrder, setBgSortOrder] = useState(0);

  const [bgUploading, setBgUploading] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgValidationWarning, setBgValidationWarning] = useState<string | null>(null);
  const [bgError, setBgError] = useState('');

  // Editing modal
  const [editingBg, setEditingBg] = useState<BackgroundRow | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // 1. Load cloud backgrounds
  const loadCloudCatalog = async () => {
    setLoadingCloud(true);
    try {
      const res = await fetch('/api/admin/supabase-backgrounds');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.backgrounds)) {
          setCloudBackgrounds(data.backgrounds);
          return;
        }
      }
      // Fallback
      const fallback = await fetchActiveBackgrounds(true);
      setCloudBackgrounds(fallback);
    } catch (err: any) {
      console.warn('Could not fetch cloud backgrounds:', err);
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadCloudCatalog();
    scanLaptopBackgrounds();
  }, []);

  // 2. Scan laptop storage (IndexedDB, localforage, mediaStore) for saved backgrounds
  const scanLaptopBackgrounds = async () => {
    setScanningLocal(true);
    try {
      const detected: LocalDetectedItem[] = [];
      const seenIds = new Set<string>();

      // Check localforage 'customVideos_list'
      const list = await localforage.getItem<CustomVideo[]>('customVideos_list');
      if (Array.isArray(list)) {
        for (const item of list) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            // check if blob exists
            let blob = await localforage.getItem<Blob>(item.id);
            if (!blob) blob = await localforage.getItem<Blob>(`customVideo_blob_${item.id}`);
            detected.push({
              id: item.id,
              name: item.name || 'Custom Background',
              sizeBytes: item.sizeBytes || (blob ? blob.size : 0),
              blob: blob || undefined,
              videoUrl: item.videoUrl,
            });
          }
        }
      }

      // Check mediaStore ('NoorayaMediaStorage')
      try {
        await mediaStore.iterate((val: any, key: string) => {
          if (val && !seenIds.has(key) && (val.type === 'video' || val.mimeType?.startsWith('video'))) {
            seenIds.add(key);
            detected.push({
              id: key,
              name: val.name || key,
              sizeBytes: val.sizeBytes || val.blob?.size || 0,
              blob: val.blob instanceof Blob ? val.blob : undefined,
              videoUrl: val.url,
            });
          }
        });
      } catch {}

      // Check all localforage keys for customVideo_blob_*
      try {
        const keys = await localforage.keys();
        for (const k of keys) {
          if (k.startsWith('customVideo_blob_') || k.startsWith('custom_vid_')) {
            const rawId = k.replace('customVideo_blob_', '');
            if (!seenIds.has(rawId)) {
              seenIds.add(rawId);
              const blob = await localforage.getItem<Blob>(k);
              if (blob instanceof Blob) {
                detected.push({
                  id: rawId,
                  name: rawId.includes('fireplace') ? 'Fireplace Ambient' : `Laptop Video (${rawId.slice(0, 8)})`,
                  sizeBytes: blob.size,
                  blob,
                });
              }
            }
          }
        }
      } catch {}

      setDetectedLocal(detected);
    } catch (err) {
      console.warn('Error scanning laptop backgrounds:', err);
    } finally {
      setScanningLocal(false);
    }
  };

  // 3. Migrate a single laptop background to Supabase Cloud
  const handleMigrateLaptopItem = async (item: LocalDetectedItem) => {
    setMigratingId(item.id);
    try {
      let videoBlob = item.blob;
      if (!videoBlob) {
        videoBlob =
          (await localforage.getItem<Blob>(item.id)) ||
          (await localforage.getItem<Blob>(`customVideo_blob_${item.id}`)) ||
          (await mediaStore.getItem<Blob>(item.id));
      }

      if (!videoBlob && item.videoUrl?.startsWith('http')) {
        // Already hosted
        showToast(`"${item.name}" is already available via URL. Adding to cloud catalog...`, 'success');
        await appApi('/admin/supabase-backgrounds', {
          method: 'POST',
          body: {
            action: 'add',
            id: item.id,
            name_en: item.name,
            category: item.name.toLowerCase().includes('fire') ? 'fireplace' : 'general',
            video_url: item.videoUrl,
            size_bytes: item.sizeBytes,
            is_active: true,
          },
        });
        await loadCloudCatalog();
        return;
      }

      if (!videoBlob) {
        throw new Error(`Video data not found in laptop storage for "${item.name}".`);
      }

      // Generate unique cloud filename: e.g. fireplace-a8f9c2.mp4
      const safeBase = item.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24);
      const hash = Math.random().toString(36).substring(2, 8);
      const videoFilename = `${safeBase}_${hash}.mp4`;
      const posterFilename = `${safeBase}_${hash}_poster.jpg`;

      // Extract poster thumbnail
      let posterBlob: Blob | null = null;
      try {
        posterBlob = await extractVideoPoster(videoBlob);
      } catch (posterErr) {
        console.warn('Poster generation fallback:', posterErr);
      }

      // Upload video to Supabase Storage
      const uploadedVideoUrl = await uploadToSupabaseStorage(
        videoBlob,
        `videos/${videoFilename}`,
        'video/mp4'
      );

      // Upload poster if available
      let uploadedPosterUrl: string | null = null;
      if (posterBlob) {
        try {
          uploadedPosterUrl = await uploadToSupabaseStorage(
            posterBlob,
            `posters/${posterFilename}`,
            'image/jpeg'
          );
        } catch {}
      }

      // Insert row into 'backgrounds' table
      const category = item.name.toLowerCase().includes('fire')
        ? 'fireplace'
        : item.name.toLowerCase().includes('rain')
        ? 'rain'
        : item.name.toLowerCase().includes('ocean')
        ? 'ocean'
        : item.name.toLowerCase().includes('forest')
        ? 'forest'
        : 'general';

      await appApi('/admin/supabase-backgrounds', {
        method: 'POST',
        body: {
          action: 'add',
          id: `bg_${safeBase}_${hash}`,
          name_en: item.name,
          category,
          video_url: uploadedVideoUrl,
          poster_url: uploadedPosterUrl,
          size_bytes: videoBlob.size,
          is_active: true,
          is_premium: false,
        },
      });

      showToast(`Migrated "${item.name}" to cloud! Now playable on all phones & tablets.`, 'success');
      await loadCloudCatalog();
      await refreshGlobalCatalog();
    } catch (err: any) {
      showToast(err?.message || 'Migration failed.', 'error');
    } finally {
      setMigratingId(null);
    }
  };

  // 4. Migrate ALL detected laptop backgrounds
  const handleMigrateAllLaptop = async () => {
    if (detectedLocal.length === 0) return;
    setIsMigratingAll(true);
    let successCount = 0;
    try {
      for (const item of detectedLocal) {
        try {
          await handleMigrateLaptopItem(item);
          successCount++;
        } catch (e) {
          console.error('Failed to migrate', item.name, e);
        }
      }
      showToast(`Successfully migrated ${successCount} backgrounds to cloud for all devices!`, 'success');
      await scanLaptopBackgrounds();
    } finally {
      setIsMigratingAll(false);
    }
  };

  // 5. Upload new background from file
  const handleUploadNewFile = async (file: File) => {
    setBgError('');
    setBgValidationWarning(null);
    setBgUploading(true);
    setBgProgress(10);

    try {
      // Validate video constraints
      const validation = await validateAmbientVideo(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Video validation failed.');
      }
      if (validation.warning) {
        setBgValidationWarning(validation.warning);
      }

      setBgProgress(30);

      // Extract poster
      let posterBlob: Blob | null = null;
      try {
        posterBlob = await extractVideoPoster(file);
      } catch (pErr) {
        console.warn('Poster extraction note:', pErr);
      }

      setBgProgress(50);

      // Upload to Supabase Storage
      const safeName = (bgNameEn.trim() || file.name.replace(/\.[^/.]+$/, ''))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      const hash = Math.random().toString(36).substring(2, 8);
      const videoFilename = `${safeName}_${hash}.mp4`;
      const posterFilename = `${safeName}_${hash}_poster.jpg`;

      const videoUrl = await uploadToSupabaseStorage(file, `videos/${videoFilename}`, 'video/mp4');
      setBgProgress(80);

      let posterUrl: string | null = null;
      if (posterBlob) {
        try {
          posterUrl = await uploadToSupabaseStorage(posterBlob, `posters/${posterFilename}`, 'image/jpeg');
        } catch {}
      }

      setBgProgress(90);

      // Save row to 'backgrounds' table
      const id = `bg_${safeName}_${hash}`;
      await appApi('/admin/supabase-backgrounds', {
        method: 'POST',
        body: {
          action: 'add',
          id,
          name_en: bgNameEn.trim() || file.name.replace(/\.[^/.]+$/, ''),
          name_ar: bgNameAr.trim() || null,
          category: bgCategory,
          video_url: videoUrl,
          poster_url: posterUrl,
          size_bytes: file.size,
          sort_order: bgSortOrder,
          is_active: true,
          is_premium: bgIsPremium,
        },
      });

      setBgProgress(100);
      showToast(`Added background "${bgNameEn || file.name}" to cloud for all devices!`, 'success');

      // Reset form
      setBgNameEn('');
      setBgNameAr('');
      setBgVideoUrl('');
      setBgPosterUrl('');
      setBgSortOrder(0);
      setBgIsPremium(false);
      if (fileRef.current) fileRef.current.value = '';

      await loadCloudCatalog();
      await refreshGlobalCatalog();
    } catch (err: any) {
      setBgError(err?.message || 'Upload failed');
      showToast(err?.message || 'Upload failed', 'error');
    } finally {
      setBgUploading(false);
    }
  };

  // 6. Delete background
  const handleDeleteBackground = (id: string, name: string) => {
    askConfirm(
      'Delete Ambient Background',
      `Are you sure you want to delete "${name}"? It will no longer play on user devices.`,
      async () => {
        try {
          await appApi('/admin/supabase-backgrounds', {
            method: 'POST',
            body: { action: 'delete', id },
          });
          showToast(`Deleted "${name}".`, 'success');
          await loadCloudCatalog();
          await refreshGlobalCatalog();
        } catch (err: any) {
          showToast(err?.message || 'Delete failed', 'error');
        }
      }
    );
  };

  // 7. Toggle active / inactive
  const handleToggleActive = async (bg: BackgroundRow) => {
    try {
      await appApi('/admin/supabase-backgrounds', {
        method: 'POST',
        body: {
          action: 'update',
          id: bg.id,
          is_active: !bg.is_active,
        },
      });
      showToast(`"${bg.name_en}" is now ${!bg.is_active ? 'active' : 'inactive'}.`, 'success');
      await loadCloudCatalog();
      await refreshGlobalCatalog();
    } catch (err: any) {
      showToast(err?.message || 'Update failed', 'error');
    }
  };

  // 8. Move sort order
  const handleReorder = async (bg: BackgroundRow, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? Math.max(0, bg.sort_order - 1) : bg.sort_order + 1;
    try {
      await appApi('/admin/supabase-backgrounds', {
        method: 'POST',
        body: {
          action: 'update',
          id: bg.id,
          sort_order: newOrder,
        },
      });
      await loadCloudCatalog();
    } catch (err: any) {
      showToast(err?.message || 'Reorder failed', 'error');
    }
  };

  // 9. Save Edit Modal
  const handleSaveEdit = async () => {
    if (!editingBg) return;
    try {
      await appApi('/admin/supabase-backgrounds', {
        method: 'POST',
        body: {
          action: 'update',
          id: editingBg.id,
          name_en: editingBg.name_en,
          name_ar: editingBg.name_ar,
          category: editingBg.category,
          video_url: editingBg.video_url,
          poster_url: editingBg.poster_url,
          sort_order: editingBg.sort_order,
          is_active: editingBg.is_active,
          is_premium: editingBg.is_premium,
        },
      });
      showToast('Background metadata updated.', 'success');
      setEditingBg(null);
      await loadCloudCatalog();
      await refreshGlobalCatalog();
    } catch (err: any) {
      showToast(err?.message || 'Save failed', 'error');
    }
  };

  // Filtered backgrounds
  const filteredBackgrounds = cloudBackgrounds.filter(b => {
    if (activeCategory === 'all') return true;
    return b.category.toLowerCase() === activeCategory.toLowerCase();
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-900/30 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video className="text-emerald-400" size={26} />
            Ambient Backgrounds (Cloud Source of Truth)
          </h2>
          <p className="text-xs text-emerald-200/70 mt-1 max-w-2xl">
            All backgrounds stored in Supabase Storage and database table. Synced in real-time across all devices,
            including iPhone, iPad, Android PWAs, and desktop browsers with battery-saving background decoupling.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadCloudCatalog();
            scanLaptopBackgrounds();
          }}
          disabled={loadingCloud || scanningLocal}
          className="px-4 py-2 rounded-xl bg-emerald-900/30 border border-emerald-700/40 text-xs font-semibold text-emerald-200 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw size={14} className={loadingCloud || scanningLocal ? 'animate-spin' : ''} />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {/* SECTION 1: LAPTOP LOCAL BACKGROUNDS DETECTED (MIGRATION TOOL) */}
      <div className="bg-gradient-to-br from-amber-950/30 via-emerald-950/20 to-black/40 border border-amber-600/30 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <FolderSync size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Laptop Saved Backgrounds Detected
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
                  {detectedLocal.length} Available
                </span>
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Saved on this laptop (Fireplace and others). Click below to migrate them to Supabase Storage so every
                phone, tablet, and user can play them seamlessly!
              </p>
            </div>
          </div>
          {detectedLocal.length > 0 && (
            <button
              type="button"
              onClick={handleMigrateAllLaptop}
              disabled={isMigratingAll}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <CloudUpload size={16} />
              <span>{isMigratingAll ? 'Migrating to Cloud...' : 'Migrate All to Supabase Cloud'}</span>
            </button>
          )}
        </div>

        {detectedLocal.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-amber-500/20">
            {detectedLocal.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/20 flex items-center justify-between gap-3"
              >
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                    {item.name.toLowerCase().includes('fire') && <Flame size={13} className="text-orange-400" />}
                    <span>{item.name}</span>
                  </div>
                  <div className="text-[10px] text-amber-300/70 mt-0.5">
                    {item.sizeBytes > 0 ? formatBytes(item.sizeBytes) : 'Local Storage Blob'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleMigrateLaptopItem(item)}
                  disabled={migratingId === item.id || isMigratingAll}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
                >
                  {migratingId === item.id ? 'Uploading...' : 'Sync to Cloud'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-amber-500/10 text-xs text-amber-200/60">
            No un-migrated backgrounds found on this browser. All backgrounds are stored in the cloud catalog below.
          </div>
        )}
      </div>

      {/* SECTION 2: UPLOAD & ADD NEW BACKGROUND */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
          <Upload size={18} className="text-emerald-400" />
          Upload New Ambient Background
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">
              English Name *
            </label>
            <input
              type="text"
              value={bgNameEn}
              onChange={(e) => setBgNameEn(e.target.value)}
              placeholder="e.g. Cozy Fireplace Hearth"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white placeholder-emerald-700 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">
              Arabic Name (Optional)
            </label>
            <input
              type="text"
              value={bgNameAr}
              onChange={(e) => setBgNameAr(e.target.value)}
              placeholder="e.g. دفء الموقد"
              dir="rtl"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white placeholder-emerald-700 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">
              Category *
            </label>
            <select
              value={bgCategory}
              onChange={(e) => setBgCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="fireplace">Fireplace (Hearth & Campfire)</option>
              <option value="rain">Rain (Sanctuary Roof & Lake)</option>
              <option value="ocean">Ocean (Waves & Sunset Coast)</option>
              <option value="forest">Forest (Canopy & Mountain Stream)</option>
              <option value="cosmos">Cosmos (Night Sky & Deep Galaxy)</option>
              <option value="night">Night (Starry Midnight)</option>
              <option value="general">General Sacred</option>
            </select>
          </div>
        </div>

        {/* Video File Pick & Validation */}
        <div className="mt-4 pt-4 border-t border-emerald-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadNewFile(f);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={bgUploading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Upload size={15} />
              <span>{bgUploading ? 'Processing & Uploading...' : 'Pick Video File (H.264 MP4)'}</span>
            </button>
            <div className="text-[11px] text-emerald-400/80 mt-1.5">
              Requirements: MP4 format, 720p max resolution, no audio track, target 3–8 MB for smooth mobile looping.
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-emerald-200 cursor-pointer">
              <input
                type="checkbox"
                checked={bgIsPremium}
                onChange={(e) => setBgIsPremium(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Premium Only</span>
            </label>
          </div>
        </div>

        {bgUploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-emerald-300 mb-1">
              <span>Uploading to Supabase Storage & generating poster thumbnail...</span>
              <span>{bgProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${bgProgress}%` }}
              />
            </div>
          </div>
        )}

        {bgValidationWarning && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{bgValidationWarning}</span>
          </div>
        )}

        {bgError && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            {bgError}
          </div>
        )}
      </div>

      {/* SECTION 3: CLOUD CATALOG MANAGEMENT */}
      <div className="space-y-4">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSel = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  isSel
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-black/30 border border-emerald-900/40 text-emerald-200/70 hover:border-emerald-600'
                }`}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Background Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBackgrounds.map((bg, idx) => {
            const isCurrentBroadcast =
              activeBackgroundVideoId === bg.video_url || activeBackgroundVideoId === bg.id;

            return (
              <div
                key={bg.id}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${
                  isCurrentBroadcast
                    ? 'bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_20px_rgba(31,138,106,0.15)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-emerald-900/50'
                }`}
              >
                <div>
                  {/* Poster Thumbnail or Gradient */}
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/60 border border-emerald-900/30 group">
                    {bg.poster_url ? (
                      <img
                        src={bg.poster_url}
                        alt={bg.name_en}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-950 to-black text-emerald-400">
                        <Film size={28} />
                      </div>
                    )}

                    {/* Preview Button Overlay */}
                    <button
                      type="button"
                      onClick={() => setPreviewVideoUrl(bg.video_url)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2 text-xs font-semibold cursor-pointer"
                    >
                      <Play size={20} className="fill-white" />
                      <span>Preview Loop</span>
                    </button>

                    {/* Category Badge */}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-semibold text-emerald-300 uppercase tracking-wider border border-white/10">
                      {bg.category}
                    </span>

                    {/* Premium Badge */}
                    {bg.is_premium && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                        PREMIUM
                      </span>
                    )}
                  </div>

                  {/* Titles */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white truncate">{bg.name_en}</h4>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleReorder(bg, 'up')}
                          title="Move Up"
                          className="p-1 rounded text-emerald-400/80 hover:text-white cursor-pointer"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(bg, 'down')}
                          title="Move Down"
                          className="p-1 rounded text-emerald-400/80 hover:text-white cursor-pointer"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </div>
                    {bg.name_ar && (
                      <div className="text-xs text-emerald-300/80 mt-0.5" dir="rtl">
                        {bg.name_ar}
                      </div>
                    )}
                    <div className="text-[11px] text-emerald-400/60 mt-1">
                      Order: {bg.sort_order} • Size: {bg.size_bytes ? formatBytes(bg.size_bytes) : 'CDN Stream'}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-emerald-900/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(bg)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        bg.is_active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-black/40 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {bg.is_active ? 'Active' : 'Disabled'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingBg(bg)}
                      className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-emerald-900/30 text-emerald-300 text-[11px] font-medium border border-emerald-900/40 cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBackgroundVideoId(bg.video_url);
                        showToast(`Broadcasted "${bg.name_en}" to all devices!`, 'success');
                      }}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                        isCurrentBroadcast
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'bg-emerald-900/40 hover:bg-emerald-600 text-emerald-200 hover:text-white'
                      }`}
                    >
                      {isCurrentBroadcast ? '✓ Live' : 'Broadcast'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBackground(bg.id, bg.name_en)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredBackgrounds.length === 0 && (
          <div className="text-center py-12 text-xs text-emerald-300/60 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl">
            No backgrounds found in category "{activeCategory}". Upload an MP4 above to get started!
          </div>
        )}
      </div>

      {/* PREVIEW VIDEO MODAL */}
      <AnimatePresence>
        {previewVideoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewVideoUrl(null)}
          >
            <div
              className="relative max-w-3xl w-full bg-black border border-emerald-900/60 rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewVideoUrl(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black cursor-pointer"
              >
                <X size={16} />
              </button>
              <video
                src={previewVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full aspect-video object-cover"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT METADATA MODAL */}
      <AnimatePresence>
        {editingBg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setEditingBg(null)}
          >
            <div
              className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-emerald-900/30 pb-3">
                <h3 className="text-sm font-bold text-white">Edit Background Metadata</h3>
                <button
                  type="button"
                  onClick={() => setEditingBg(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-300 mb-1">English Name</label>
                <input
                  type="text"
                  value={editingBg.name_en}
                  onChange={(e) => setEditingBg({ ...editingBg, name_en: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-300 mb-1">Arabic Name</label>
                <input
                  type="text"
                  value={editingBg.name_ar || ''}
                  onChange={(e) => setEditingBg({ ...editingBg, name_ar: e.target.value })}
                  dir="rtl"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-300 mb-1">Category</label>
                <select
                  value={editingBg.category}
                  onChange={(e) => setEditingBg({ ...editingBg, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white"
                >
                  <option value="fireplace">Fireplace</option>
                  <option value="rain">Rain</option>
                  <option value="ocean">Ocean</option>
                  <option value="forest">Forest</option>
                  <option value="cosmos">Cosmos</option>
                  <option value="night">Night</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-300 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={editingBg.sort_order}
                  onChange={(e) => setEditingBg({ ...editingBg, sort_order: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingBg.is_premium}
                    onChange={(e) => setEditingBg({ ...editingBg, is_premium: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  <span>Premium Only</span>
                </label>
              </div>

              <div className="pt-4 border-t border-emerald-900/30 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBg(null)}
                  className="px-4 py-2 rounded-xl bg-black/40 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BackgroundsAdmin;
