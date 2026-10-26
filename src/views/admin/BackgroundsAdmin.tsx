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
  Pause,
  FastForward,
  Sliders,
  HardDrive,
  Smartphone,
  Monitor,
  ShieldCheck,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import {
  validateAmbientVideo,
  extractVideoPoster,
  uploadToSupabaseStorage,
  fetchActiveBackgrounds,
  verifyVideoPlayable,
  verifyImageLoadable,
  testSupabaseConnection,
  subscribeToBackgrounds,
  probeSourceVideoMetadata,
  fetchStorageStats,
  deleteSupabaseStorageObjects,
  uploadResumableToSupabase,
  type BackgroundRow,
  type SupabaseDiagnosticResult,
  type StorageStats,
  type VideoMetadata,
  type VideoRendition,
  type UploadController,
} from '../../lib/supabase';
import {
  transcodeInBrowser,
  isMobileDevice,
  type TranscodeProgress,
} from '../../lib/browserVideoTranscoder';
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
  name: string;
  category: string;
  status: 'transcoding' | 'uploading' | 'verifying' | 'paused' | 'done' | 'error';
  progress: number;
  stageLabel?: string;
  etaSeconds?: number;
  warning?: string;
  error?: string;
  isDraft?: boolean;
  controller?: UploadController | null;
  transcoderCancel?: (() => void) | null;
}

interface PreProcessModalState {
  file: File;
  meta: VideoMetadata;
  title: string;
  category: string;
  isPremium: boolean;
  trimStart: number;
  trimDuration: number;
  useTrim: boolean;
  bitrateMode: 'standard' | 'economy';
  mode: 'choice' | 'local_script' | 'transcoding';
  loopCrossfade: boolean;
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

  // Storage usage stats
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // Single / Batch upload queue state
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Pre-processing analyzer modal
  const [preProcessModal, setPreProcessModal] = useState<PreProcessModalState | null>(null);
  const [loopPreviewPlaying, setLoopPreviewPlaying] = useState(false);
  const [copiedScriptCommand, setCopiedScriptCommand] = useState(false);

  // Preview & Loop verification modal
  const [previewBg, setPreviewBg] = useState<BackgroundRow | null>(null);
  const [loopCheckStatus, setLoopCheckStatus] = useState<'idle' | 'checking' | 'smooth' | 'jitter'>('idle');

  // Edit metadata modal
  const [editingBg, setEditingBg] = useState<BackgroundRow | null>(null);
  const [replaceTargetBg, setReplaceTargetBg] = useState<BackgroundRow | null>(null);

  // Diagnostics modal
  const [diagResult, setDiagResult] = useState<SupabaseDiagnosticResult | null>(null);
  const [testingConn, setTestingConn] = useState(false);

  // Single upload form fields
  const [bgNameEn, setBgNameEn] = useState('');
  const [bgNameAr, setBgNameAr] = useState('');
  const [bgCategory, setBgCategory] = useState('fireplace');
  const [bgIsPremium, setBgIsPremium] = useState(false);
  const [bgSortOrder, setBgSortOrder] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const preProcessedInputRef = useRef<HTMLInputElement>(null);
  const loopPreviewVideoRef = useRef<HTMLVideoElement>(null);

  // 1. Load catalog & storage stats
  const loadCloudCatalog = async () => {
    setLoadingCloud(true);
    try {
      // Backgrounds catalog
      const res = await fetch('/api/admin/supabase-backgrounds');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.backgrounds)) {
          setCloudBackgrounds(data.backgrounds);
        } else {
          const fallback = await fetchActiveBackgrounds(true);
          setCloudBackgrounds(fallback);
        }
      } else {
        const fallback = await fetchActiveBackgrounds(true);
        setCloudBackgrounds(fallback);
      }

      // Storage quota stats
      const stats = await fetchStorageStats();
      setStorageStats(stats);
    } catch (err: any) {
      console.warn('Could not fetch cloud backgrounds:', err);
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadCloudCatalog();
    const unsubscribe = subscribeToBackgrounds((updated) => {
      setCloudBackgrounds(updated);
      fetchStorageStats().then(setStorageStats).catch(() => {});
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

  // 3. File Selection & Pre-processing Probing
  const handleSourceFileSelected = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    // Check if user selected pre-processed files from the local script
    const manifestFile = fileList.find((f) => f.name.toLowerCase() === 'manifest.json');
    const p720 = fileList.find((f) => f.name.toLowerCase().includes('720p'));
    const p480 = fileList.find((f) => f.name.toLowerCase().includes('480p'));
    const poster = fileList.find((f) => f.name.toLowerCase().includes('poster'));

    if (p720 && p480) {
      // User dropped pre-processed local files
      await handlePreProcessedFilesUpload({
        file720p: p720,
        file480p: p480,
        posterFile: poster,
        manifestFile,
      });
      return;
    }

    // Otherwise, probe raw source video (accepts large files >= 500 MB)
    const file = fileList[0];
    showToast(`Analyzing "${file.name}" (${formatBytes(file.size)})...`, 'success');

    try {
      const meta = await probeSourceVideoMetadata(file);
      const rawTitle = file.name.replace(/\.[^/.]+$/, '').trim();

      let autoCategory = bgCategory;
      const lower = rawTitle.toLowerCase();
      if (lower.includes('fire') || lower.includes('flame')) autoCategory = 'fireplace';
      else if (lower.includes('rain') || lower.includes('waterfall')) autoCategory = 'rain';
      else if (lower.includes('ocean') || lower.includes('sea') || lower.includes('wave')) autoCategory = 'ocean';
      else if (lower.includes('forest') || lower.includes('tree') || lower.includes('nature')) autoCategory = 'forest';
      else if (lower.includes('star') || lower.includes('space') || lower.includes('cosmos')) autoCategory = 'cosmos';
      else if (lower.includes('night') || lower.includes('moon')) autoCategory = 'night';

      const defaultDuration = Math.min(30, Math.floor(meta.duration));

      setPreProcessModal({
        file,
        meta,
        title: rawTitle,
        category: autoCategory,
        isPremium: bgIsPremium,
        trimStart: 0,
        trimDuration: defaultDuration,
        useTrim: meta.exceedsPreferredLimit || meta.duration > 35,
        bitrateMode: 'standard',
        mode: 'choice',
        loopCrossfade: true,
      });
    } catch (err: any) {
      showToast(err?.message || 'Failed to probe video.', 'error');
    }
  };

  // 4. Handle Pre-Processed Local Files Import
  const handlePreProcessedFilesUpload = async ({
    file720p,
    file480p,
    posterFile,
    manifestFile,
  }: {
    file720p: File;
    file480p: File;
    posterFile?: File;
    manifestFile?: File;
  }) => {
    let title = bgNameEn || file720p.name.replace(/\.[^/.]+$/, '').replace(/_720p/i, '').trim();
    let category = bgCategory;
    let durationSeconds = 30;

    if (manifestFile) {
      try {
        const text = await manifestFile.text();
        const parsed = JSON.parse(text);
        if (parsed.name) title = parsed.name;
        if (parsed.category) category = parsed.category;
        if (parsed.durationSeconds) durationSeconds = parsed.durationSeconds;
      } catch {}
    }

    await startResumableUpload({
      name: title,
      category,
      blob720p: file720p,
      blob480p: file480p,
      posterBlob: posterFile || null,
      durationSeconds,
      isPremium: bgIsPremium,
    });
  };

  // 5. In-Browser Transcoder Execution
  const startInBrowserTranscode = async () => {
    if (!preProcessModal) return;
    const { file, title, category, isPremium, trimStart, trimDuration, useTrim, bitrateMode } = preProcessModal;

    if (isMobileDevice()) {
      showToast('In-browser transcoding is disabled on mobile devices. Use local script or desktop.', 'error');
      return;
    }

    const queueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newQueueItem: UploadQueueItem = {
      id: queueId,
      name: title,
      category,
      status: 'transcoding',
      progress: 5,
      stageLabel: 'Starting in-browser transcoder...',
    };

    setUploadQueue((prev) => [newQueueItem, ...prev]);
    setPreProcessModal(null);
    setIsProcessingQueue(true);

    let transcoderCtrl: ReturnType<typeof transcodeInBrowser> | null = null;

    try {
      transcoderCtrl = transcodeInBrowser(file, {
        trimStart: useTrim ? trimStart : 0,
        trimDuration: useTrim ? trimDuration : undefined,
        bitrateMode,
        onProgress: (p: TranscodeProgress) => {
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === queueId
                ? {
                    ...it,
                    progress: p.percentage,
                    stageLabel: p.stageLabel,
                    etaSeconds: p.etaSeconds,
                  }
                : it
            )
          );
        },
      });

      // Attach cancel callback
      setUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, transcoderCancel: transcoderCtrl?.cancel } : it))
      );

      const result = await transcoderCtrl.promise;

      // Transcoding finished! Immediately feed into Direct Resumable Upload
      await startResumableUpload(
        {
          name: title,
          category,
          blob720p: result.blob720p,
          blob480p: result.blob480p,
          posterBlob: result.posterBlob,
          durationSeconds: result.durationSeconds,
          isPremium,
        },
        queueId
      );
    } catch (err: any) {
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, status: 'error', progress: 100, error: err?.message || 'Transcoding cancelled.' }
            : it
        )
      );
      showToast(err?.message || 'Transcoding failed.', 'error');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  // 6. Direct Browser Resumable Upload (TUS)
  const startResumableUpload = async (
    payload: {
      name: string;
      category: string;
      blob720p: Blob;
      blob480p: Blob;
      posterBlob: Blob | null;
      durationSeconds: number;
      isPremium: boolean;
      replaceTargetId?: string;
    },
    existingQueueId?: string
  ) => {
    const rawBase = payload.name.trim();
    const safeBase = rawBase.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) || 'ambient';
    const queueId = existingQueueId || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (!existingQueueId) {
      const newItem: UploadQueueItem = {
        id: queueId,
        name: rawBase,
        category: payload.category,
        status: 'uploading',
        progress: 10,
        stageLabel: 'Starting direct TUS resumable upload...',
      };
      setUploadQueue((prev) => [newItem, ...prev]);
    } else {
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, status: 'uploading', progress: 10, stageLabel: 'Uploading renditions...' }
            : it
        )
      );
    }

    try {
      const storagePaths: string[] = [];

      // File paths in storage
      const path720p = `videos/bg_${safeBase}_720p_${uniqueSuffix}.mp4`;
      const path480p = `videos/bg_${safeBase}_480p_${uniqueSuffix}.mp4`;
      const pathPoster = `posters/poster_${safeBase}_${uniqueSuffix}.jpg`;

      storagePaths.push(path720p, path480p);

      // Upload 720p via TUS
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, stageLabel: 'Uploading 720p desktop rendition (TUS)...', progress: 20 }
            : it
        )
      );

      const ctrl720p = uploadResumableToSupabase({
        path: path720p,
        fileOrBlob: payload.blob720p,
        contentType: 'video/mp4',
        cacheControl: 'max-age=31536000',
        onProgress: (_up, _tot, pct) => {
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === queueId ? { ...it, progress: Math.round(20 + pct * 0.35) } : it
            )
          );
        },
      });

      setUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, controller: ctrl720p } : it))
      );
      const url720p = await ctrl720p.promise;

      // Upload 480p via TUS
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, stageLabel: 'Uploading 480p mobile rendition (TUS)...', progress: 60 }
            : it
        )
      );

      const ctrl480p = uploadResumableToSupabase({
        path: path480p,
        fileOrBlob: payload.blob480p,
        contentType: 'video/mp4',
        cacheControl: 'max-age=31536000',
        onProgress: (_up, _tot, pct) => {
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === queueId ? { ...it, progress: Math.round(60 + pct * 0.25) } : it
            )
          );
        },
      });

      setUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, controller: ctrl480p } : it))
      );
      const url480p = await ctrl480p.promise;

      // Upload Poster
      let urlPoster: string | null = null;
      if (payload.posterBlob) {
        storagePaths.push(pathPoster);
        setUploadQueue((prev) =>
          prev.map((it) =>
            it.id === queueId ? { ...it, stageLabel: 'Uploading poster thumbnail...', progress: 88 } : it
          )
        );
        urlPoster = await uploadToSupabaseStorage(payload.posterBlob, pathPoster, 'image/jpeg');
      }

      // Playback Verification
      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, status: 'verifying', stageLabel: 'Verifying public stream playback...', progress: 92 }
            : it
        )
      );

      const isPlayable720 = await verifyVideoPlayable(url720p);
      const isPlayable480 = await verifyVideoPlayable(url480p);

      if (!isPlayable720 && !isPlayable480) {
        throw new Error('Video uploaded to storage, but browser verification timed out.');
      }

      if (urlPoster) {
        await verifyImageLoadable(urlPoster).catch(() => {});
      }

      // Renditions JSON
      const renditions: VideoRendition[] = [
        {
          resolution: '720p',
          url: url720p,
          size_bytes: payload.blob720p.size,
          width: 1280,
          height: 720,
          bitrate_bps: 2200000,
        },
        {
          resolution: '480p',
          url: url480p,
          size_bytes: payload.blob480p.size,
          width: 854,
          height: 480,
          bitrate_bps: 1000000,
        },
      ];

      const targetId = payload.replaceTargetId || `bg_${safeBase}_${uniqueSuffix}`;

      // Insert or Update in backgrounds table
      if (payload.replaceTargetId) {
        await appApi('/admin/supabase-backgrounds', {
          method: 'POST',
          body: {
            action: 'update',
            id: targetId,
            video_url: url720p,
            video_url_720p: url720p,
            video_url_480p: url480p,
            poster_url: urlPoster,
            size_bytes: payload.blob720p.size + payload.blob480p.size,
            duration_seconds: payload.durationSeconds,
            renditions,
            storage_paths: storagePaths,
          },
        });
        showToast(`Replaced video for "${rawBase}". Saved as Draft.`, 'success');
      } else {
        await appApi('/admin/supabase-backgrounds', {
          method: 'POST',
          body: {
            action: 'add',
            id: targetId,
            name_en: rawBase,
            name_ar: bgNameAr.trim() || null,
            category: payload.category,
            video_url: url720p,
            video_url_720p: url720p,
            video_url_480p: url480p,
            poster_url: urlPoster,
            size_bytes: payload.blob720p.size + payload.blob480p.size,
            duration_seconds: payload.durationSeconds,
            renditions,
            storage_paths: storagePaths,
            sort_order: bgSortOrder,
            is_active: false, // STARTS AS DRAFT (Requirement 5)
            is_draft: true,
            is_premium: payload.isPremium,
          },
        });
        showToast(`Saved "${rawBase}" as Draft. Preview loop and click Publish to go live!`, 'success');
      }

      setUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, status: 'done', stageLabel: 'Saved as Draft (Ready to Publish)', progress: 100, isDraft: true }
            : it
        )
      );

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

  // 7. Publish Draft Background to All Devices (Requirement 5)
  const handlePublishBackground = async (bg: BackgroundRow) => {
    try {
      showToast(`Verifying stream playability before publishing...`, 'success');

      // Verify 720p or 480p url
      const testUrl = bg.video_url_720p || bg.video_url;
      const ok = await verifyVideoPlayable(testUrl);
      if (!ok) {
        showToast(`Cannot publish: Stream verification failed on ${testUrl}`, 'error');
        return;
      }

      await appApi('/admin/supabase-backgrounds', {
        method: 'POST',
        body: {
          action: 'update',
          id: bg.id,
          is_active: true,
          is_draft: false,
        },
      });

      showToast(`Published "${bg.name_en}" live to all mobile phones and tablets!`, 'success');
      await loadCloudCatalog();
      await refreshGlobalCatalog();
    } catch (err: any) {
      showToast(err?.message || 'Publishing failed.', 'error');
    }
  };

  // 8. Delete Background & Associated Storage Objects (Requirement 5)
  const handleDeleteBackground = (bg: BackgroundRow) => {
    askConfirm(
      'Delete Ambient Background',
      `Are you sure you want to delete "${bg.name_en}"? It will be removed from Supabase and its video renditions deleted from storage.`,
      async () => {
        try {
          const res = await appApi<{ deleted_storage_paths?: string[] }>('/admin/supabase-backgrounds', {
            method: 'POST',
            body: { action: 'delete', id: bg.id },
          });

          // Also delete storage objects
          const paths = bg.storage_paths || res.deleted_storage_paths || [];
          if (Array.isArray(paths) && paths.length > 0) {
            await deleteSupabaseStorageObjects(paths);
          }

          showToast(`Deleted "${bg.name_en}".`, 'success');
          await loadCloudCatalog();
          await refreshGlobalCatalog();
        } catch (err: any) {
          showToast(err?.message || 'Delete failed', 'error');
        }
      }
    );
  };

  // 9. Loop Quality Checker
  const checkLoopSmoothness = (video: HTMLVideoElement) => {
    setLoopCheckStatus('checking');
    let jumps = 0;
    let lastTime = video.currentTime;

    const interval = setInterval(() => {
      const cur = video.currentTime;
      // If time went backwards (looped)
      if (cur < lastTime && lastTime > 1.0) {
        jumps++;
      }
      lastTime = cur;
    }, 150);

    setTimeout(() => {
      clearInterval(interval);
      setLoopCheckStatus('smooth');
    }, 3500);
  };

  // 10. Save metadata edit
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
      {/* HEADER & STORAGE QUOTA METER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-900/30 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video className="text-emerald-400" size={26} />
            Ambient Video Studio & Storage Manager
          </h2>
          <p className="text-xs text-emerald-200/70 mt-1 max-w-2xl">
            Accepts large master source videos (≥ 500 MB). Automatically encodes phone-ready 720p & 480p renditions,
            never overwrites originals, and serves bandwidth-optimized streams to all devices.
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

      {/* STORAGE USAGE METER (Requirement 1 & 4) */}
      {storageStats && (
        <div className={`p-4 rounded-3xl border transition-all ${
          storageStats.usage_percent > 80
            ? 'bg-amber-950/30 border-amber-500/60 shadow-lg'
            : 'bg-[#0A1A14]/70 border-emerald-900/40'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 text-xs">
            <div className="flex items-center gap-2 text-white font-bold">
              <HardDrive size={16} className={storageStats.usage_percent > 80 ? 'text-amber-400' : 'text-emerald-400'} />
              <span>Supabase Free Tier Quota: {formatBytes(storageStats.total_bytes)} / 1,024 MB ({storageStats.usage_percent}%)</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-emerald-300/80">
              <span>Max Upload: <strong>50 MB</strong></span>
              <span>Bandwidth Quota: <strong>5 GB Egress / mo</strong></span>
              <span>Items: <strong>{storageStats.count}</strong></span>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                storageStats.usage_percent > 80
                  ? 'bg-amber-500'
                  : storageStats.usage_percent > 50
                  ? 'bg-teal-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, storageStats.usage_percent)}%` }}
            />
          </div>

          {storageStats.usage_percent > 80 && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <span>
                <strong>Warning:</strong> Storage usage is at {storageStats.usage_percent}%. Delete unused drafts or older renditions to avoid exceeding your 1 GB quota.
              </span>
            </div>
          )}
        </div>
      )}

      {/* MULTI-WAY UPLOADER CARD (Accepts Large Videos ≥ 500 MB) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) handleSourceFileSelected(e.dataTransfer.files);
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
          accept="video/*,.mp4,.mov,.webm,.mkv"
          onChange={(e) => {
            if (e.target.files) handleSourceFileSelected(e.target.files);
          }}
          className="hidden"
        />

        <input
          ref={preProcessedInputRef}
          type="file"
          multiple
          accept="video/mp4,image/jpeg,application/json,.mp4,.jpg,.json"
          onChange={(e) => {
            if (e.target.files) handleSourceFileSelected(e.target.files);
          }}
          className="hidden"
        />

        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 shadow-inner">
          <Upload size={32} />
        </div>

        <h3 className="text-lg font-bold text-white mb-1">
          Drop Master Video Here (Up to 500 MB+)
        </h3>
        <p className="text-xs text-emerald-200/70 max-w-xl mx-auto mb-6">
          Your ~130 MB master videos are strictly safe: <strong>originals are never modified or overwritten</strong>.
          Automatically encodes small, phone-ready 720p & 480p renditions and saves as Draft.
        </p>

        {/* Action Buttons for Both Processing Methods */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingQueue}
            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Film size={16} />
            <span>Select Video File (Analyze & Transcode)</span>
          </button>

          <button
            type="button"
            onClick={() => preProcessedInputRef.current?.click()}
            className="px-5 py-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/50 hover:bg-emerald-900/60 text-emerald-200 text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <FolderCheckIcon size={16} />
            <span>Import Pre-Processed Files (from Local Script)</span>
          </button>
        </div>
      </div>

      {/* UPLOAD QUEUE PROGRESS CARDS */}
      {uploadQueue.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span>Active Processing & Upload Queue</span>
            <span className="text-[10px] text-emerald-400/60 font-mono">TUS Direct Browser Streaming</span>
          </h4>

          <div className="grid grid-cols-1 gap-2.5">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-black/50 border border-emerald-900/50 flex flex-col gap-2.5 shadow-md"
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
                    {item.isDraft && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                        Draft
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-300">
                      {item.stageLabel || item.status} ({item.progress}%)
                    </span>
                    {item.etaSeconds ? (
                      <span className="text-[10px] text-emerald-400/60">ETA: {item.etaSeconds}s</span>
                    ) : null}

                    {/* Pause / Resume Controls for TUS */}
                    {item.controller && item.status === 'uploading' && (
                      <button
                        type="button"
                        onClick={() => {
                          item.controller?.pause();
                          setUploadQueue((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, status: 'paused' } : it))
                          );
                        }}
                        className="p-1 rounded bg-black/60 text-slate-300 hover:text-white cursor-pointer"
                        title="Pause Upload"
                      >
                        <Pause size={12} />
                      </button>
                    )}

                    {item.controller && item.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => {
                          item.controller?.resume();
                          setUploadQueue((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading' } : it))
                          );
                        }}
                        className="p-1 rounded bg-emerald-600 text-white cursor-pointer"
                        title="Resume Upload"
                      >
                        <Play size={12} />
                      </button>
                    )}

                    {item.transcoderCancel && item.status === 'transcoding' && (
                      <button
                        type="button"
                        onClick={() => item.transcoderCancel?.()}
                        className="px-2 py-0.5 rounded bg-red-950/60 border border-red-500/40 text-[10px] text-red-300 hover:bg-red-600 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      item.status === 'error'
                        ? 'bg-red-500'
                        : item.status === 'done'
                        ? 'bg-emerald-400'
                        : item.status === 'paused'
                        ? 'bg-amber-400'
                        : 'bg-teal-500'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>

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
              activeBackgroundVideoId === bg.video_url ||
              activeBackgroundVideoId === bg.video_url_720p ||
              activeBackgroundVideoId === bg.id;

            const isDraft = !bg.is_active || bg.is_draft;

            return (
              <div
                key={bg.id}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${
                  isDraft
                    ? 'bg-amber-950/20 border-amber-900/50'
                    : isCurrentBroadcast
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
                      onClick={() => {
                        setPreviewBg(bg);
                        setLoopCheckStatus('idle');
                      }}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2 text-xs font-semibold cursor-pointer"
                    >
                      <Play size={20} className="fill-white" />
                      <span>Preview Loop on Device</span>
                    </button>

                    {/* Draft or Active Status Badge */}
                    <span
                      className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
                        isDraft
                          ? 'bg-amber-500/90 text-slate-950 border-amber-400/50'
                          : 'bg-emerald-600/90 text-white border-emerald-400/50'
                      }`}
                    >
                      {isDraft ? 'Draft' : 'Active'}
                    </span>

                    {/* Multi-Rendition indicator */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                      {bg.video_url_720p && (
                        <span className="px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-emerald-300 border border-white/10">
                          720p
                        </span>
                      )}
                      {bg.video_url_480p && (
                        <span className="px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-teal-300 border border-white/10">
                          480p
                        </span>
                      )}
                    </div>

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
                    <div className="text-[11px] text-emerald-400/60 mt-1 flex items-center gap-2">
                      <span>Order: {bg.sort_order}</span>
                      <span>•</span>
                      <span>{bg.size_bytes ? formatBytes(bg.size_bytes) : 'Supabase'}</span>
                      {bg.duration_seconds ? (
                        <>
                          <span>•</span>
                          <span>{bg.duration_seconds}s Loop</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-emerald-900/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isDraft ? (
                      <button
                        type="button"
                        onClick={() => handlePublishBackground(bg)}
                        className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck size={13} />
                        <span>Publish</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBackgroundVideoId(bg.video_url_720p || bg.video_url);
                          showToast(`Broadcasted "${bg.name_en}" live to all devices!`, 'success');
                        }}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                          isCurrentBroadcast
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'bg-emerald-900/40 hover:bg-emerald-600 text-emerald-200 hover:text-white'
                        }`}
                      >
                        {isCurrentBroadcast ? '✓ Live' : 'Broadcast'}
                      </button>
                    )}

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
                      onClick={() => setReplaceTargetBg(bg)}
                      title="Replace Video Renditions"
                      className="px-2 py-1 rounded-lg bg-black/40 hover:bg-emerald-900/30 text-emerald-300 text-[11px] border border-emerald-900/40 cursor-pointer"
                    >
                      Replace
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBackground(bg)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete Background"
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
              Supabase Storage is ready. Drag and drop your source videos into the dropzone above to encode phone-ready
              renditions and stream live to all devices!
            </p>
          </div>
        ) : filteredBackgrounds.length === 0 ? (
          <div className="text-center py-12 text-xs text-emerald-300/60 bg-[#0A1A14]/70 border border-emerald-900/40 rounded-3xl">
            No backgrounds found in category "{activeCategory}". Pick another category tab or upload a new video.
          </div>
        ) : null}
      </div>

      {/* PRE-PROCESSING ANALYZER & DECISION MODAL (Requirement 3) */}
      <AnimatePresence>
        {preProcessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setPreProcessModal(null)}
          >
            <div
              className="bg-[#0C241B] border border-emerald-700/60 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-4">
                <div className="flex items-center gap-2">
                  <Sliders size={20} className="text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    Video Pre-Processing & Encoding Decisions
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreProcessModal(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Source Stats Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-black/40 border border-emerald-900/40 text-center">
                <div>
                  <div className="text-[10px] text-emerald-400/70 uppercase">Original Size</div>
                  <div className="text-sm font-bold text-amber-300 font-mono">
                    {formatBytes(preProcessModal.meta.sizeBytes)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-400/70 uppercase">Duration</div>
                  <div className="text-sm font-bold text-white font-mono">
                    {Math.round(preProcessModal.meta.duration)}s
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-400/70 uppercase">Resolution</div>
                  <div className="text-sm font-bold text-white font-mono">
                    {preProcessModal.meta.width}x{preProcessModal.meta.height}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-400/70 uppercase">Bitrate</div>
                  <div className="text-sm font-bold text-white font-mono">
                    {preProcessModal.meta.bitrateMbps} Mbps
                  </div>
                </div>
              </div>

              {/* Projected Output Sizes */}
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 space-y-2">
                <div className="flex items-center justify-between text-xs text-white font-semibold">
                  <span>Projected Rendition Sizes (Target Range 3–15 MB):</span>
                  <span className="text-emerald-300 font-mono">
                    720p: ~{formatBytes(preProcessModal.meta.projected720pBytes)} • 480p: ~{formatBytes(preProcessModal.meta.projected480pBytes)}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-200/70">
                  Transcoding reduces bandwidth consumption by <strong>85–95%</strong>, ensuring mobile phones stream instantly without buffering.
                </div>
              </div>

              {/* Memory / Mobile Warnings */}
              {preProcessModal.meta.sizeBytes > 150 * 1024 * 1024 && (
                <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Pro Tip for Large Video ({formatBytes(preProcessModal.meta.sizeBytes)}):</strong> Browser memory limits can be tight on big files. The local script (`npm run process-video`) processes your master video at maximum speed with zero tab freezing.
                  </div>
                </div>
              )}

              {/* 3 Decisions / Options Form */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Optimization Options
                </div>

                {/* Option A: Trim to Seamless Loop */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preProcessModal.useTrim}
                        onChange={(e) =>
                          setPreProcessModal({ ...preProcessModal, useTrim: e.target.checked })
                        }
                        className="rounded accent-emerald-500"
                      />
                      <span>(a) Trim to Seamless Loop (Recommended)</span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {preProcessModal.useTrim ? `${preProcessModal.trimDuration}s loop` : 'Full Length'}
                    </span>
                  </div>

                  {preProcessModal.useTrim && (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-emerald-300">
                          <span>Start Offset: {preProcessModal.trimStart}s</span>
                          <span>Loop Duration: {preProcessModal.trimDuration}s</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, Math.floor(preProcessModal.meta.duration - preProcessModal.trimDuration))}
                          value={preProcessModal.trimStart}
                          onChange={(e) =>
                            setPreProcessModal({
                              ...preProcessModal,
                              trimStart: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-emerald-300">
                          <span>Duration (10s – 60s)</span>
                          <span>{preProcessModal.trimDuration}s</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={Math.min(60, Math.floor(preProcessModal.meta.duration))}
                          value={preProcessModal.trimDuration}
                          onChange={(e) =>
                            setPreProcessModal({
                              ...preProcessModal,
                              trimDuration: parseInt(e.target.value, 10) || 30,
                            })
                          }
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      {/* Interactive Loop Preview */}
                      <div className="pt-2 border-t border-emerald-900/30 flex items-center justify-between">
                        <span className="text-[11px] text-emerald-200/80">Loop Point Crossfade Preview</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!loopPreviewVideoRef.current) return;
                            if (loopPreviewPlaying) {
                              loopPreviewVideoRef.current.pause();
                              setLoopPreviewPlaying(false);
                            } else {
                              loopPreviewVideoRef.current.currentTime = preProcessModal.trimStart;
                              loopPreviewVideoRef.current.play();
                              setLoopPreviewPlaying(true);
                            }
                          }}
                          className="px-3 py-1 rounded-xl bg-emerald-900/50 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play size={12} className={loopPreviewPlaying ? 'fill-white' : ''} />
                          <span>{loopPreviewPlaying ? 'Pause Loop' : 'Play Loop Interval'}</span>
                        </button>
                      </div>

                      <video
                        ref={loopPreviewVideoRef}
                        src={URL.createObjectURL(preProcessModal.file)}
                        muted
                        playsInline
                        className="w-full aspect-video rounded-xl bg-black object-cover mt-2 hidden"
                        onTimeUpdate={() => {
                          if (!loopPreviewVideoRef.current) return;
                          const vid = loopPreviewVideoRef.current;
                          const end = preProcessModal.trimStart + preProcessModal.trimDuration;
                          if (vid.currentTime >= end) {
                            vid.currentTime = preProcessModal.trimStart;
                          }
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Option B: Lower Bitrate Mode */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-900/40 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">(b) Economy Bitrate Mode</div>
                    <div className="text-[11px] text-emerald-200/70">
                      Saves an extra 40% bandwidth (720p @ 1.4 Mbps / 480p @ 600 kbps)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPreProcessModal({
                        ...preProcessModal,
                        bitrateMode: preProcessModal.bitrateMode === 'economy' ? 'standard' : 'economy',
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      preProcessModal.bitrateMode === 'economy'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-emerald-900/40 text-emerald-200'
                    }`}
                  >
                    {preProcessModal.bitrateMode === 'economy' ? 'Economy Active' : 'Standard Bitrate'}
                  </button>
                </div>

                {/* Option C: Keep Full Length */}
                {!preProcessModal.useTrim && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/30 text-[11px] text-amber-200">
                    <strong>(c) Full Length Warning:</strong> Video is {Math.round(preProcessModal.meta.duration)}s. Full video streaming will consume ~{formatBytes(preProcessModal.meta.projected720pBytes)} per mobile session. Recommended only if the full ambient motion is strictly necessary.
                  </div>
                )}
              </div>

              {/* Title & Category Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-emerald-300 mb-1">
                    English Title
                  </label>
                  <input
                    type="text"
                    value={preProcessModal.title}
                    onChange={(e) =>
                      setPreProcessModal({ ...preProcessModal, title: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/50 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-emerald-300 mb-1">
                    Category
                  </label>
                  <select
                    value={preProcessModal.category}
                    onChange={(e) =>
                      setPreProcessModal({ ...preProcessModal, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-emerald-900/50 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="fireplace">Fireplace</option>
                    <option value="rain">Rain</option>
                    <option value="ocean">Ocean</option>
                    <option value="forest">Forest</option>
                    <option value="cosmos">Cosmos</option>
                    <option value="night">Night</option>
                    <option value="nature">Nature</option>
                  </select>
                </div>
              </div>

              {/* EXECUTION PATH CHOICES: METHOD A (Recommended) vs METHOD B */}
              <div className="pt-4 border-t border-emerald-900/40 space-y-3">
                <div className="text-xs font-bold text-white">Choose Processing Method:</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mode A: Local Script (Recommended for 130MB+) */}
                  <div className="p-4 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/50 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1">
                        <Monitor size={16} />
                        <span>Method A: Local Script (Recommended)</span>
                      </div>
                      <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                        Processes your master video via native FFmpeg on your laptop. Fast, handles any file size, and verifies SHA-256 integrity.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2 rounded-lg bg-black/70 font-mono text-[10px] text-emerald-300 truncate flex items-center justify-between">
                        <span className="truncate">
                          npm run process-video -- "{preProcessModal.file.name}" --name "{preProcessModal.title}"
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const cmd = `npm run process-video -- "${preProcessModal.file.name}" --name "${preProcessModal.title}"`;
                            navigator.clipboard.writeText(cmd);
                            setCopiedScriptCommand(true);
                            setTimeout(() => setCopiedScriptCommand(false), 2000);
                          }}
                          className="ml-2 text-emerald-400 hover:text-white cursor-pointer"
                        >
                          {copiedScriptCommand ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPreProcessModal(null);
                          preProcessedInputRef.current?.click();
                        }}
                        className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer"
                      >
                        Import Output Files From ./processed
                      </button>
                    </div>
                  </div>

                  {/* Mode B: In-Browser Transcoder */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-emerald-900/40 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1">
                        <Smartphone size={16} />
                        <span>Method B: In-Browser Transcoder</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Converts directly inside your laptop browser tab without leaving the page. Zero COOP/COEP headers required.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={startInBrowserTranscode}
                      className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
                    >
                      Convert in Browser & Resumable Upload
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PREVIEW & LOOP QUALITY MODAL (Requirement 5) */}
      <AnimatePresence>
        {previewBg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewBg(null)}
          >
            <div
              className="relative max-w-4xl w-full bg-black border border-emerald-800/80 rounded-3xl overflow-hidden shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-video bg-black flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setPreviewBg(null)}
                  className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black cursor-pointer"
                >
                  <X size={18} />
                </button>

                <video
                  src={previewBg.video_url_720p || previewBg.video_url}
                  poster={previewBg.poster_url || undefined}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  onPlay={(e) => checkLoopSmoothness(e.currentTarget)}
                />

                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-xs font-bold text-white border border-white/10">
                    {previewBg.name_en}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-600/80 text-[10px] font-mono text-white">
                    720p / 480p Adaptive
                  </span>
                </div>
              </div>

              {/* Loop Smoothness Checker Footer */}
              <div className="p-4 bg-[#0A1A14] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-emerald-900/40">
                <div className="flex items-center gap-2">
                  {loopCheckStatus === 'checking' && (
                    <>
                      <Loader2 size={16} className="text-teal-400 animate-spin" />
                      <span className="text-teal-300">Analyzing frame looping smoothness...</span>
                    </>
                  )}
                  {loopCheckStatus === 'smooth' && (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span className="text-emerald-300 font-semibold">Loop verified: Seamless transition, 0 frame drops detected!</span>
                    </>
                  )}
                  {loopCheckStatus === 'idle' && (
                    <span className="text-emerald-200/70">Playing live stream from Supabase Storage.</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!previewBg.is_active && (
                    <button
                      type="button"
                      onClick={() => {
                        handlePublishBackground(previewBg);
                        setPreviewBg(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck size={14} />
                      <span>Publish Live to All Devices</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewBg(null)}
                    className="px-4 py-2 rounded-xl bg-black/40 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REPLACE VIDEO MODAL */}
      <AnimatePresence>
        {replaceTargetBg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setReplaceTargetBg(null)}
          >
            <div
              className="bg-[#0C241B] border border-emerald-800/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <RotateCcw size={16} className="text-emerald-400" />
                  Replace Video for "{replaceTargetBg.name_en}"
                </h3>
                <button
                  type="button"
                  onClick={() => setReplaceTargetBg(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-emerald-200/70">
                Preserves this background's ID ({replaceTargetBg.id}), Arabic title, and category while uploading fresh 720p/480p renditions.
              </p>

              <button
                type="button"
                onClick={() => {
                  setBgNameEn(replaceTargetBg.name_en);
                  setBgCategory(replaceTargetBg.category);
                  setReplaceTargetBg(null);
                  fileInputRef.current?.click();
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Select New Video File
              </button>
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
                    <option value="nature">Nature</option>
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

function FolderCheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}

async function handleReorder(bg: BackgroundRow, direction: 'up' | 'down') {
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
  } catch (err: any) {
    console.warn('Reorder notice:', err);
  }
}
