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
  Sparkles,
  AlertTriangle,
  Layers,
  ArrowUp,
  ArrowDown,
  Flame,
  CloudRain,
  Waves,
  Trees,
  Moon,
  Compass,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import {
  validateAmbientVideo,
  extractVideoPoster,
  uploadToSupabaseStorage,
  fetchActiveBackgrounds,
  verifyVideoPlayable,
  testSupabaseConnection,
  subscribeToBackgrounds,
  type BackgroundRow,
  type SupabaseDiagnosticResult,
} from '../../lib/supabase';
import { formatBytes } from '../../lib/recitations';
import { appApi } from '../../lib/api';

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

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'fireplace', label: 'Fireplace', icon: Flame },
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'ocean', label: 'Ocean', icon: Waves },
  { id: 'forest', label: 'Forest', icon: Trees },
  { id: 'cosmos', label: 'Cosmos', icon: Compass },
  { id: 'night', label: 'Night', icon: Moon },
];

interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  category: string;
  status: 'validating' | 'uploading' | 'verifying' | 'done' | 'error';
  progress: number;
  error?: string;
  warning?: string;
}

export function BackgroundsAdmin({
  showToast,
  askConfirm,
}: Props) {
  const {
    activeBackgroundVideoId,
    setActiveBackgroundVideoId,
    refreshGlobalCatalog,
  } = usePlayer();

  // Cloud Backgrounds from Supabase / Postgres
  const [cloudBackgrounds, setCloudBackgrounds] = useState<BackgroundRow[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  // Single / Batch upload queue state
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Single upload form fields
  const [bgNameEn, setBgNameEn] = useState('');
  const [bgNameAr, setBgNameAr] = useState('');
  const [bgCategory, setBgCategory] = useState('fireplace');
  const [bgIsPremium, setBgIsPremium] = useState(false);
  const [bgSortOrder, setBgSortOrder] = useState(0);

  // Modals & diagnostics
  const [editingBg, setEditingBg] = useState<BackgroundRow | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [diagResult, setDiagResult] = useState<SupabaseDiagnosticResult | null>(null);
  const [testingConn, setTestingConn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Load catalog & subscribe to Realtime updates
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
    // Subscribe to Supabase Realtime changes
    const unsubscribe = subscribeToBackgrounds((updated) => {
      setCloudBackgrounds(updated);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Test Supabase connection
  const handleTestConnection = async () => {
    setTestingConn(true);
    try {
      const result = await testSupabaseConnection();
      setDiagResult(result);
      if (result.tableReachable && result.bucketReachable) {
        showToast('Supabase connection verified: Table and Storage bucket active!', 'success');
      } else if (!result.urlConfigured || !result.anonKeyConfigured) {
        showToast('Supabase environment variables missing on host.', 'error');
      } else {
        showToast(`Diagnostics: ${result.errorMessage || 'Check bucket and table setup.'}`, 'error');
      }
    } catch (e: any) {
      showToast(`Diagnostic check failed: ${e?.message || 'Network error'}`, 'error');
    } finally {
      setTestingConn(false);
    }
  };

  // 3. Process video upload with strict validation, poster extraction, and playback verification
  const processUploadItem = async (file: File, customNameEn?: string, categoryOverride?: string) => {
    const rawBase = (customNameEn || file.name.replace(/\.[^/.]+$/, '')).trim();
    const safeBase = rawBase.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) || 'ambient';
    const queueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newItem: UploadQueueItem = {
      id: queueId,
      file,
      name: rawBase,
      category: categoryOverride || bgCategory,
      status: 'validating',
      progress: 10,
    };

    setUploadQueue((prev) => [newItem, ...prev]);

    try {
      // Step A: Validate video constraints
      const validation = await validateAmbientVideo(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Video validation failed.');
      }

      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, status: 'uploading', progress: 30, warning: validation.warning }
            : it
        )
      );

      // Step B: Generate Poster Thumbnail via Canvas
      let posterBlob: Blob | null = null;
      try {
        posterBlob = await extractVideoPoster(file);
      } catch (pErr) {
        console.warn('Poster thumbnail extraction fallback:', pErr);
      }

      // Step C: Generate unique salt filename
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const videoFilename = `bg_${safeBase}_${uniqueSuffix}.mp4`;
      const posterFilename = `poster_${safeBase}_${uniqueSuffix}.jpg`;

      // Step D: Upload video to Supabase Storage ('ambient-backgrounds' bucket) with cacheControl: 31536000
      const uploadedVideoUrl = await uploadToSupabaseStorage(
        file,
        `videos/${videoFilename}`,
        'video/mp4'
      );

      setUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, status: 'verifying', progress: 75 } : it))
      );

      // Step E: Verify browser can stream and play the uploaded public URL before saving
      const isPlayable = await verifyVideoPlayable(uploadedVideoUrl);
      if (!isPlayable) {
        throw new Error(
          `Video uploaded to storage, but browser playback check timed out. Ensure H.264 video encoding.`
        );
      }

      // Step F: Upload poster if available
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

      // Step G: Insert row into Supabase 'backgrounds' table
      const id = `bg_${safeBase}_${uniqueSuffix}`;
      await appApi('/admin/supabase-backgrounds', {
        method: 'POST',
        body: {
          action: 'add',
          id,
          name_en: rawBase,
          name_ar: bgNameAr.trim() || null,
          category: categoryOverride || bgCategory,
          video_url: uploadedVideoUrl,
          poster_url: uploadedPosterUrl,
          size_bytes: file.size,
          sort_order: bgSortOrder,
          is_active: true,
          is_premium: bgIsPremium,
        },
      });

      setUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, status: 'done', progress: 100 } : it))
      );

      showToast(`Uploaded and published "${rawBase}" to all devices!`, 'success');
      await loadCloudCatalog();
      await refreshGlobalCatalog();
    } catch (err: any) {
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, status: 'error', progress: 100, error: err?.message || 'Upload failed.' }
            : it
        )
      );
      showToast(err?.message || 'Upload failed.', 'error');
    }
  };

  // 4. Multi-file handler
  const handleFilesSelected = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setIsProcessingQueue(true);
    for (const f of list) {
      // Automatic category inference if multiple files
      let autoCategory = bgCategory;
      const lower = f.name.toLowerCase();
      if (lower.includes('fire') || lower.includes('flame')) autoCategory = 'fireplace';
      else if (lower.includes('rain') || lower.includes('waterfall')) autoCategory = 'rain';
      else if (lower.includes('ocean') || lower.includes('sea') || lower.includes('wave')) autoCategory = 'ocean';
      else if (lower.includes('forest') || lower.includes('tree') || lower.includes('nature')) autoCategory = 'forest';
      else if (lower.includes('star') || lower.includes('space') || lower.includes('cosmos')) autoCategory = 'cosmos';
      else if (lower.includes('night') || lower.includes('moon')) autoCategory = 'night';

      await processUploadItem(f, list.length === 1 ? bgNameEn : undefined, autoCategory);
    }
    setIsProcessingQueue(false);

    // Reset single upload inputs
    setBgNameEn('');
    setBgNameAr('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 5. Delete background
  const handleDeleteBackground = (id: string, name: string) => {
    askConfirm(
      'Delete Ambient Background',
      `Are you sure you want to delete "${name}"? It will be removed from Supabase and will no longer play on any device.`,
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

  // 6. Toggle active / inactive
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

  // 7. Move sort order
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

  // 8. Save edit modal
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
  const filteredBackgrounds = cloudBackgrounds.filter((b) => {
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
            Ambient Backgrounds (Supabase Single Source of Truth)
          </h2>
          <p className="text-xs text-emerald-200/70 mt-1 max-w-2xl">
            Live storage and catalog managed directly in Supabase Storage and database table. Synced in real-time
            across all mobile phones, tablets, and desktop browsers without manual refreshes or redeploys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConn}
            className="px-4 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-semibold text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles size={14} className={testingConn ? 'animate-spin' : ''} />
            <span>{testingConn ? 'Testing...' : 'Test Connection'}</span>
          </button>
          <button
            type="button"
            onClick={loadCloudCatalog}
            disabled={loadingCloud}
            className="px-4 py-2 rounded-xl bg-emerald-900/30 border border-emerald-700/40 text-xs font-semibold text-emerald-200 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} className={loadingCloud ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* DIAGNOSTIC MODAL / BANNER */}
      {diagResult && (
        <div className="p-4 rounded-2xl bg-[#0C2A20] border border-emerald-500/40 text-xs text-white space-y-2 relative shadow-2xl">
          <button
            type="button"
            onClick={() => setDiagResult(null)}
            className="absolute top-3 right-3 text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
          <div className="font-bold text-sm text-emerald-300 flex items-center gap-2">
            <Sparkles size={16} />
            Supabase Connection Diagnostic Results
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <div className="flex items-center gap-2">
              <span className={diagResult.urlConfigured ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {diagResult.urlConfigured ? '[PASS]' : '[FAIL]'}
              </span>
              <span>URL: {diagResult.urlConfigured ? 'Configured' : 'Missing VITE_SUPABASE_URL'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={diagResult.anonKeyConfigured ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {diagResult.anonKeyConfigured ? '[PASS]' : '[FAIL]'}
              </span>
              <span>Anon Key: {diagResult.anonKeyConfigured ? 'Configured' : 'Missing VITE_SUPABASE_ANON_KEY'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={diagResult.tableReachable ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {diagResult.tableReachable ? '[PASS]' : '[FAIL]'}
              </span>
              <span>Table 'backgrounds': {diagResult.tableReachable ? `Reachable (${diagResult.tableCount} rows)` : 'Unreachable / Not created'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={diagResult.bucketReachable ? (diagResult.bucketPublic ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold') : 'text-slate-400'}>
                {diagResult.bucketReachable ? (diagResult.bucketPublic ? '[PASS]' : '[WARN]') : '[INFO]'}
              </span>
              <span>Bucket 'ambient-backgrounds': {diagResult.bucketReachable ? (diagResult.bucketPublic ? 'Public & Active' : 'Private (Should be Public)') : 'Not probed or restricted'}</span>
            </div>
          </div>
          {diagResult.errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs mt-2">
              <strong>Error:</strong> {diagResult.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* MULTI-FILE DRAG & DROP UPLOAD AREA */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
        }}
        className={`relative border-2 border-dashed rounded-3xl p-8 transition-all text-center ${
          isDragging
            ? 'border-emerald-400 bg-emerald-950/40 scale-[1.005]'
            : 'border-emerald-900/50 bg-[#0A1A14]/70 hover:border-emerald-700/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4"
          multiple
          onChange={(e) => {
            if (e.target.files) handleFilesSelected(e.target.files);
          }}
          className="hidden"
        />

        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
          <Upload size={28} />
        </div>

        <h3 className="text-base font-bold text-white mb-1">
          Drag & Drop Background MP4 Videos Here
        </h3>
        <p className="text-xs text-emerald-200/70 max-w-lg mx-auto mb-5">
          Multi-file upload supported. Automatically compresses thumbnails, validates 720p H.264 constraints,
          and publishes to Supabase Storage with 1-year immutable caching.
        </p>

        {/* Upload Form Details for Single or Batch Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-5 text-left">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">
              Title (Optional for multi-file)
            </label>
            <input
              type="text"
              value={bgNameEn}
              onChange={(e) => setBgNameEn(e.target.value)}
              placeholder="e.g. Fireplace Hearth"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white placeholder-emerald-700 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">
              Category
            </label>
            <select
              value={bgCategory}
              onChange={(e) => setBgCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/40 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="fireplace">Fireplace (Hearth & Flame)</option>
              <option value="rain">Rain (Sanctuary & Droplets)</option>
              <option value="ocean">Ocean (Coast & Waves)</option>
              <option value="forest">Forest (Canopy & Stream)</option>
              <option value="cosmos">Cosmos (Deep Galaxy)</option>
              <option value="night">Night (Starry Midnight)</option>
              <option value="general">General Sacred</option>
            </select>
          </div>

          <div className="flex items-center sm:justify-center pt-3 sm:pt-0">
            <label className="flex items-center gap-2 text-xs text-emerald-200 cursor-pointer">
              <input
                type="checkbox"
                checked={bgIsPremium}
                onChange={(e) => setBgIsPremium(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Premium Background</span>
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessingQueue}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
        >
          {isProcessingQueue ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Processing Videos...</span>
            </>
          ) : (
            <>
              <Film size={16} />
              <span>Browse Video Files (MP4)</span>
            </>
          )}
        </button>
      </div>

      {/* UPLOAD QUEUE PROGRESS CARDS */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Upload Queue & Playback Verification
          </h4>
          <div className="grid grid-cols-1 gap-2.5">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-black/40 border border-emerald-900/40 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    {item.status === 'done' ? (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    ) : item.status === 'error' ? (
                      <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    ) : (
                      <Loader2 size={16} className="text-teal-400 animate-spin shrink-0" />
                    )}
                    <span className="font-semibold text-white truncate">{item.name}</span>
                    <span className="text-[10px] text-emerald-400/60 uppercase">({item.category})</span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-300">
                    {item.status === 'validating' && 'Validating H.264...'}
                    {item.status === 'uploading' && `Uploading (${item.progress}%)`}
                    {item.status === 'verifying' && 'Verifying Stream Playback...'}
                    {item.status === 'done' && 'Published Live'}
                    {item.status === 'error' && 'Failed'}
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      item.status === 'error'
                        ? 'bg-red-500'
                        : item.status === 'done'
                        ? 'bg-emerald-400'
                        : 'bg-teal-500'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>

                {item.warning && (
                  <div className="text-[11px] text-amber-300/80 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    <span>{item.warning}</span>
                  </div>
                )}
                {item.error && (
                  <div className="text-[11px] text-red-300 flex items-center gap-1.5">
                    <X size={12} />
                    <span>{item.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION: CLOUD CATALOG MANAGEMENT */}
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
          {filteredBackgrounds.map((bg) => {
            const isCurrentBroadcast =
              activeBackgroundVideoId === bg.video_url || activeBackgroundVideoId === bg.id;

            return (
              <div
                key={bg.id}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${
                  isCurrentBroadcast
                    ? 'bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_20px_rgba(31,138,106,0.15)]'
                    : 'bg-[#0A1A14]/70 border-emerald-900/40 hover:border-emerald-700/50'
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
                      Order: {bg.sort_order} • Size: {bg.size_bytes ? formatBytes(bg.size_bytes) : 'Supabase Storage'}
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

        {/* EMPTY STATE */}
        {cloudBackgrounds.length === 0 ? (
          <div className="text-center py-16 px-6 bg-[#0A1A14]/70 border border-emerald-900/40 rounded-3xl space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Video size={24} />
            </div>
            <h3 className="text-base font-semibold text-white">No Ambient Backgrounds in Cloud</h3>
            <p className="text-xs text-emerald-100/70 max-w-md mx-auto">
              Supabase Storage is ready and empty. Drag and drop your MP4 videos (such as Fireplace and others, 720p H.264,
              3–8 MB optimal) into the dropzone above to stream them live to all phones and tablets!
            </p>
          </div>
        ) : filteredBackgrounds.length === 0 ? (
          <div className="text-center py-12 text-xs text-emerald-300/60 bg-[#0A1A14]/70 border border-emerald-900/40 rounded-3xl">
            No backgrounds found in category "{activeCategory}". Pick another category tab or upload a new video.
          </div>
        ) : null}
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
              className="bg-[#0C241B] border border-emerald-900/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Video size={16} className="text-emerald-400" />
                  Edit Ambient Background Metadata
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingBg(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-emerald-300 mb-1">
                  English Name
                </label>
                <input
                  type="text"
                  value={editingBg.name_en}
                  onChange={(e) => setEditingBg({ ...editingBg, name_en: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/50 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-emerald-300 mb-1">
                  Arabic Name
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={editingBg.name_ar || ''}
                  onChange={(e) => setEditingBg({ ...editingBg, name_ar: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/50 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-emerald-300 mb-1">
                    Category
                  </label>
                  <select
                    value={editingBg.category}
                    onChange={(e) => setEditingBg({ ...editingBg, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/50 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="fireplace">Fireplace</option>
                    <option value="rain">Rain</option>
                    <option value="ocean">Ocean</option>
                    <option value="forest">Forest</option>
                    <option value="cosmos">Cosmos</option>
                    <option value="night">Night</option>
                    <option value="general">General Sacred</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-emerald-300 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={editingBg.sort_order}
                    onChange={(e) =>
                      setEditingBg({ ...editingBg, sort_order: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/50 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingBg.is_active}
                    onChange={(e) => setEditingBg({ ...editingBg, is_active: e.target.checked })}
                    className="rounded accent-emerald-500"
                  />
                  <span>Active & Broadcastable</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingBg.is_premium}
                    onChange={(e) => setEditingBg({ ...editingBg, is_premium: e.target.checked })}
                    className="rounded accent-emerald-500"
                  />
                  <span>Premium Only</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-emerald-900/40">
                <button
                  type="button"
                  onClick={() => setEditingBg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
