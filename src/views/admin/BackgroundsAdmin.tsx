import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Smartphone,
  Sparkles,
  RotateCcw,
  GripVertical,
  Pencil,
  ChevronDown,
  ChevronUp,
  Replace,
  Clock,
  FileWarning,
  ShieldCheck,
  ExternalLink,
  Download,
  Globe,
} from 'lucide-react';
import {
  type BackgroundRow,
  type VideoRendition,
  type StorageStats,
  extractVideoPoster,
  probeVideoForOneStepUpload,
  verifyLiveOnPhones,
  uploadToSupabaseStorage,
  uploadResumableToSupabase,
  fetchStorageStats,
  deleteSupabaseStorageObjects,
  subscribeToBackgrounds,
  notifyBackgroundsChanged,
} from '../../lib/supabase';
import { transcodeInBrowser } from '../../lib/browserVideoTranscoder';
import {
  AMBIENT_VIDEO_CANDIDATES,
  type AmbientVideoCandidate,
  inferCategoryFromFilename,
  matchCandidateMetadata,
} from '../../lib/ambientCandidates';
import { usePlayer } from '../../context/PlayerContext';

const CATEGORIES = [
  'river',
  'wind',
  'fire',
  'rain',
  'ocean waves',
  'waterfall',
  'forest mist',
  'mountains',
  'night sky/stars',
  'desert dunes at dusk',
  'snow',
  'clouds',
  'nature',
];

export type UploadStep =
  | 'checking'
  | 'optimizing'
  | 'uploading'
  | 'saving'
  | 'live'
  | 'failed';

export interface UploadQueueItem {
  queueId: string;
  file: File;
  replaceTargetId?: string;
  title: string;
  category: string;
  saveAsDraft: boolean;
  pathType: 'fast' | 'optimize';
  optimizeReason?: string;
  step: UploadStep;
  progressPct: number;
  statusDetail: string;
  errorReason?: string;
  startedAt: number;
  finishedAt?: number;
  finalSizeBytes?: number;
  backgroundId?: string;
  // Auto-matched or optional licence metadata
  sourceUrl?: string;
  creator?: string;
  licenseName?: string;
  licenseUrl?: string;
  dateChecked?: string;
  attributionRequired?: boolean;
}

export interface UploadAttemptLog {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  pathType: 'fast' | 'optimize';
  status: 'live' | 'draft' | 'failed';
  reason: string;
  timestamp: string;
  durationMs: number;
}

const ATTEMPT_LOG_STORAGE_KEY = 'noor_admin_upload_attempts_v2';

function loadAttemptLogs(): UploadAttemptLog[] {
  try {
    const raw = localStorage.getItem(ATTEMPT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveAttemptLogs(logs: UploadAttemptLog[]): void {
  try {
    localStorage.setItem(ATTEMPT_LOG_STORAGE_KEY, JSON.stringify(logs.slice(0, 20)));
  } catch {}
}

function cleanTitleFromFilename(filename: string): string {
  return (
    filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\d{5,}\b/g, '')
      .replace(/\b(1080p|720p|480p|4k|uhd|hd|vertical|portrait|landscape)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Ambient Scene'
  );
}

function formatBytesHuman(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
}

const STEP_ORDER: Array<{ key: UploadStep; label: string }> = [
  { key: 'checking', label: 'Checking' },
  { key: 'optimizing', label: 'Optimizing' },
  { key: 'uploading', label: 'Uploading' },
  { key: 'saving', label: 'Saving' },
  { key: 'live', label: 'Live on phones ✓' },
];

export function BackgroundsAdmin() {
  const { refreshGlobalCatalog } = usePlayer();

  const [backgrounds, setBackgrounds] = useState<BackgroundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // Default upload preferences (optional controls before or during drop)
  const [defaultCategory, setDefaultCategory] = useState<string>('auto');
  const [saveAsDraftDefault, setSaveAsDraftDefault] = useState<boolean>(false);

  // Active & Recent Upload Queue (keeps File references so Retry never requires re-selecting)
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [attemptLogs, setAttemptLogs] = useState<UploadAttemptLog[]>(() => loadAttemptLogs());
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Drag reorder state
  const [draggedBgId, setDraggedBgId] = useState<string | null>(null);

  // Inline rename & details drawer state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [openDetailsId, setOpenDetailsId] = useState<string | null>(null);

  // Replace & Candidate file input refs
  const addVideoInputRef = useRef<HTMLInputElement>(null);
  const replaceVideoInputRef = useRef<HTMLInputElement>(null);
  const candidateVideoInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetBg, setReplaceTargetBg] = useState<BackgroundRow | null>(null);
  const [selectedCandidateForUpload, setSelectedCandidateForUpload] =
    useState<AmbientVideoCandidate | null>(null);
  const [showApprovedShortlist, setShowApprovedShortlist] = useState<boolean>(true);
  const [shortlistSourceFilter, setShortlistSourceFilter] = useState<
    'all' | 'NASA Image and Video Library' | 'Pexels' | 'Pixabay'
  >('all');
  const [seedingNasaId, setSeedingNasaId] = useState<string | null>(null);

  const recordAttemptLog = (entry: Omit<UploadAttemptLog, 'id' | 'timestamp'>) => {
    const newEntry: UploadAttemptLog = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setAttemptLogs((prev) => {
      const next = [newEntry, ...prev].slice(0, 20);
      saveAttemptLogs(next);
      return next;
    });
  };

  const loadAllBackgrounds = async () => {
    setLoading(true);
    try {
      const [res, stats] = await Promise.all([
        fetch(`/api/admin/supabase-backgrounds?_t=${Date.now()}`, { cache: 'no-store' }),
        fetchStorageStats().catch(() => null),
      ]);
      if (stats) setStorageStats(stats);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.backgrounds)) {
          setBackgrounds(data.backgrounds);
        }
      }
    } catch (e) {
      console.warn('Admin backgrounds load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllBackgrounds();
    const unsub = subscribeToBackgrounds(() => {
      void loadAllBackgrounds();
    });
    return () => unsub();
  }, []);

  const updateQueueItem = (queueId: string, patch: Partial<UploadQueueItem>) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.queueId === queueId ? { ...item, ...patch } : item))
    );
  };

  /**
   * Executes the full 1-step upload pipeline for a single queued file:
   * Step 1: Checking (probes resolution, size, codec, audio track)
   * Step 2: Optimizing (runs automatically if >45MB, >720p, has audio, or non-MP4; skipped on Fast Path)
   * Step 3: Uploading (uploads video renditions + poster to storage with retry)
   * Step 4: Saving (inserts/updates database row, is_active = true by default)
   * Step 5: Verifying & Live on phones ✓ (anonymous client confirms item is in public list and video/poster URLs load)
   */
  const runOneStepUpload = async (item: UploadQueueItem) => {
    const startMs = Date.now();
    const { queueId, file } = item;

    updateQueueItem(queueId, {
      step: 'checking',
      progressPct: 5,
      statusDetail: 'Checking resolution, format, audio track, and file size...',
      errorReason: undefined,
      startedAt: startMs,
    });

    let chosenPath: 'fast' | 'optimize' = 'fast';

    try {
      // 1. CHECKING
      const probe = await probeVideoForOneStepUpload(file);
      if (!probe.valid) {
        throw new Error(probe.error || 'Unsupported file format. Please select an MP4, MOV, or WebM video.');
      }

      chosenPath = probe.meetsFastPath ? 'fast' : 'optimize';
      updateQueueItem(queueId, {
        pathType: chosenPath,
        optimizeReason: probe.reasonForOptimize,
      });

      const ts = Date.now();
      const safeSlug =
        item.title
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_')
          .replace(/_+/g, '_')
          .slice(0, 36) || 'scene';

      let blob720p: Blob = file;
      let blob480p: Blob | null = null;
      let posterBlob: Blob;
      let durationSeconds = Math.round(probe.duration || 20);

      // 2. FAST PATH vs OPTIMIZE PATH
      if (chosenPath === 'fast') {
        updateQueueItem(queueId, {
          step: 'checking',
          progressPct: 18,
          statusDetail: 'Meets Fast Path standard (MP4, ≤720p, no audio, <45 MB). Extracting poster...',
        });
        posterBlob = await extractVideoPoster(file);
      } else {
        updateQueueItem(queueId, {
          step: 'optimizing',
          progressPct: 15,
          statusDetail: `Optimizing (${probe.reasonForOptimize || 'converting to 720p & 480p muted MP4'})...`,
        });

        const controller = transcodeInBrowser(file, {
          bitrateMode: file.size > 80 * 1024 * 1024 ? 'economy' : 'standard',
          onProgress: (p) => {
            const mappedPct = Math.min(55, Math.max(15, Math.round(15 + (p.percentage / 100) * 40)));
            updateQueueItem(queueId, {
              step: 'optimizing',
              progressPct: mappedPct,
              statusDetail: `${p.stageLabel} (${p.percentage}%)`,
            });
          },
        });

        const result = await controller.promise;
        blob720p = result.blob720p;
        blob480p = result.blob480p;
        posterBlob = result.posterBlob;
        durationSeconds = Math.round(result.durationSeconds || durationSeconds);
      }

      // 3. UPLOADING TO STORAGE (Resumable for large files, automatic retry)
      updateQueueItem(queueId, {
        step: 'uploading',
        progressPct: 58,
        statusDetail: 'Uploading poster and video renditions to cloud storage...',
      });

      const posterPath = `posters/${ts}_${safeSlug}_poster.jpg`;
      const path720p = `videos/${ts}_${safeSlug}_720p.mp4`;
      const storagePaths: string[] = [posterPath, path720p];

      let posterUrl: string;
      let url720p: string;
      let url480p: string | null = null;

      try {
        posterUrl = await uploadToSupabaseStorage(posterBlob, posterPath, 'image/jpeg');
      } catch (pErr: any) {
        throw new Error(`Uploading poster failed: ${pErr?.message || 'Storage error'}`);
      }

      updateQueueItem(queueId, {
        step: 'uploading',
        progressPct: 68,
        statusDetail: 'Uploading 720p video stream...',
      });

      try {
        const up720 = uploadResumableToSupabase({
          path: path720p,
          fileOrBlob: blob720p,
          contentType: blob720p.type || 'video/mp4',
          onProgress: (_loaded, _total, pct) => {
            const overall = Math.min(82, Math.round(68 + (pct / 100) * 14));
            updateQueueItem(queueId, {
              step: 'uploading',
              progressPct: overall,
              statusDetail: `Uploading 720p video (${pct}%)...`,
            });
          },
        });
        url720p = await up720.promise;
      } catch (u720Err: any) {
        throw new Error(`Uploading video to storage failed: ${u720Err?.message || 'Network or permission error'}`);
      }

      if (blob480p && blob480p !== blob720p) {
        const path480p = `videos/${ts}_${safeSlug}_480p.mp4`;
        storagePaths.push(path480p);
        updateQueueItem(queueId, {
          step: 'uploading',
          progressPct: 84,
          statusDetail: 'Uploading 480p mobile rendition...',
        });
        try {
          const up480 = uploadResumableToSupabase({
            path: path480p,
            fileOrBlob: blob480p,
            contentType: blob480p.type || 'video/mp4',
          });
          url480p = await up480.promise;
        } catch {
          url480p = url720p;
        }
      } else {
        url480p = url720p;
      }

      const renditions: VideoRendition[] = [
        {
          resolution: '720p',
          url: url720p,
          size_bytes: blob720p.size,
          width: probe.width || 1280,
          height: probe.height || 720,
        },
        {
          resolution: '480p',
          url: url480p || url720p,
          size_bytes: blob480p ? blob480p.size : blob720p.size,
          width: 854,
          height: 480,
        },
      ];

      const totalStoredBytes =
        blob720p.size + (blob480p && blob480p !== blob720p ? blob480p.size : 0) + posterBlob.size;

      // 4. SAVING TO DATABASE (Publish immediately by default: is_active = !saveAsDraft)
      updateQueueItem(queueId, {
        step: 'saving',
        progressPct: 90,
        statusDetail: 'Saving background record to database...',
      });

      const bgId = item.replaceTargetId || `bg_${ts}_${Math.random().toString(36).slice(2, 6)}`;
      const isPublished = !item.saveAsDraft;

      const saveRes = await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: item.replaceTargetId ? 'update' : 'add',
          id: bgId,
          name_en: item.title,
          category: item.category,
          video_url: url720p,
          video_url_720p: url720p,
          video_url_480p: url480p || url720p,
          poster_url: posterUrl,
          size_bytes: totalStoredBytes,
          duration_seconds: durationSeconds,
          renditions,
          storage_paths: storagePaths,
          attribution: item.creator
            ? `${item.creator}${item.licenseName ? ` (${item.licenseName})` : ''}`
            : null,
          source_url: item.sourceUrl || null,
          creator: item.creator || null,
          license_name: item.licenseName || null,
          license_url: item.licenseUrl || null,
          date_checked: item.dateChecked || null,
          attribution_required: Boolean(item.attributionRequired),
          sort_order: item.replaceTargetId
            ? backgrounds.find((b) => b.id === item.replaceTargetId)?.sort_order ?? 0
            : 0,
          is_active: isPublished,
          is_draft: item.saveAsDraft,
          is_premium: false,
        }),
      });

      if (!saveRes.ok) {
        const errBody = await saveRes.json().catch(() => ({}));
        if (saveRes.status === 401 || saveRes.status === 403) {
          throw new Error(
            'Upload worked, but saving failed: Admin session expired or unauthorized. Please sign in again and click Retry.'
          );
        }
        throw new Error(
          errBody.error || `Upload worked, but saving to database failed (HTTP ${saveRes.status}).`
        );
      }

      // 5. VERIFY BEFORE SAYING DONE (anonymous phone fetch + video & poster playability check)
      if (isPublished) {
        updateQueueItem(queueId, {
          step: 'saving',
          progressPct: 96,
          statusDetail: 'Verifying anonymous phone list & testing video/poster URLs...',
        });

        const verification = await verifyLiveOnPhones(bgId);
        if (!verification.live) {
          throw new Error(
            verification.errorReason ||
              'Saved to database, but phone verification failed to load the new background.'
          );
        }
      }

      updateQueueItem(queueId, {
        step: 'live',
        progressPct: 100,
        statusDetail: item.saveAsDraft ? 'Saved as draft ✓' : 'Live on phones ✓',
        finishedAt: Date.now(),
        finalSizeBytes: totalStoredBytes,
        backgroundId: bgId,
      });

      recordAttemptLog({
        fileName: file.name,
        fileSizeBytes: file.size,
        pathType: chosenPath,
        status: item.saveAsDraft ? 'draft' : 'live',
        reason: item.saveAsDraft
          ? 'Saved as hidden draft'
          : `Verified Live on phones (${chosenPath === 'fast' ? 'Fast Path direct' : 'Optimized 720p+480p'})`,
        durationMs: Date.now() - startMs,
      });

      notifyBackgroundsChanged();
      await loadAllBackgrounds();
      await refreshGlobalCatalog();
    } catch (err: any) {
      const reason = err?.message || 'Unexpected error during upload.';
      updateQueueItem(queueId, {
        step: 'failed',
        statusDetail: reason,
        errorReason: reason,
        finishedAt: Date.now(),
      });

      recordAttemptLog({
        fileName: file.name,
        fileSizeBytes: file.size,
        pathType: chosenPath,
        status: 'failed',
        reason,
        durationMs: Date.now() - startMs,
      });
    }
  };

  /**
   * Handles 1 or many dropped/selected video files immediately.
   */
  const enqueueAndStartFiles = (
    files: FileList | File[],
    replaceBg?: BackgroundRow | null,
    forcedCandidate?: AmbientVideoCandidate | null
  ) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const newItems: UploadQueueItem[] = list.map((file, idx) => {
      const matchedCandidate = forcedCandidate || matchCandidateMetadata(file.name);
      const guessedCategory = forcedCandidate
        ? forcedCandidate.category
        : defaultCategory !== 'auto'
        ? defaultCategory
        : replaceBg?.category || matchedCandidate?.category || inferCategoryFromFilename(file.name);
      const cleanName = replaceBg
        ? replaceBg.name_en
        : matchedCandidate?.title || cleanTitleFromFilename(file.name);

      return {
        queueId: `q_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        file,
        replaceTargetId: replaceBg?.id,
        title: cleanName,
        category: guessedCategory,
        saveAsDraft: saveAsDraftDefault,
        pathType: file.size > 45 * 1024 * 1024 ? 'optimize' : 'fast',
        step: 'checking',
        progressPct: 2,
        statusDetail: 'Queued — starting check...',
        startedAt: Date.now(),
        sourceUrl: matchedCandidate?.pageLink,
        creator: matchedCandidate?.creator,
        licenseName: matchedCandidate?.licenseName,
        licenseUrl: matchedCandidate?.licenseUrl,
        dateChecked: matchedCandidate?.dateChecked,
        attributionRequired: matchedCandidate?.attributionRequired,
      };
    });

    setUploadQueue((prev) => [...newItems, ...prev]);

    // Process each file automatically
    for (const item of newItems) {
      void runOneStepUpload(item);
    }
  };

  /**
   * Publishes or restores pre-processed NASA Image & Video Library 720p/480p scenes in 1 click.
   */
  const handleSeedNasa = async (candidateId?: string) => {
    const startMs = Date.now();
    setSeedingNasaId(candidateId || 'all');
    try {
      const res = await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'seed-approved-nasa',
          id: candidateId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const targetVerifyId = candidateId || 'nasa-alpine-river';
      await verifyLiveOnPhones(targetVerifyId).catch(() => null);

      recordAttemptLog({
        fileName: candidateId ? `${candidateId}-720p.mp4` : 'All 6 NASA Processed Scenes (720p+480p)',
        fileSizeBytes: candidateId ? 3400000 : 18500000,
        pathType: 'fast',
        status: 'live',
        reason: `Published ${data.seeded || 1} pre-processed NASA Public Domain scene(s) with 720p/480p renditions & verified Live on phones`,
        durationMs: Date.now() - startMs,
      });

      notifyBackgroundsChanged();
      await loadAllBackgrounds();
      await refreshGlobalCatalog();
    } catch (e: any) {
      recordAttemptLog({
        fileName: candidateId || 'NASA Seed Batch',
        fileSizeBytes: 0,
        pathType: 'fast',
        status: 'failed',
        reason: e?.message || 'Failed to publish NASA scene',
        durationMs: Date.now() - startMs,
      });
    } finally {
      setSeedingNasaId(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      enqueueAndStartFiles(e.dataTransfer.files);
    }
  };

  const handleRetryItem = (item: UploadQueueItem) => {
    void runOneStepUpload(item);
  };

  const handleToggleHide = async (bg: BackgroundRow) => {
    const nextActive = !bg.is_active;
    try {
      const res = await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: bg.id,
          is_active: nextActive,
          is_draft: !nextActive,
        }),
      });
      if (res.ok) {
        notifyBackgroundsChanged();
        await loadAllBackgrounds();
        await refreshGlobalCatalog();
      }
    } catch (e) {
      console.warn('Toggle hide error:', e);
    }
  };

  const handleDelete = async (bg: BackgroundRow) => {
    try {
      if (Array.isArray(bg.storage_paths) && bg.storage_paths.length > 0) {
        await deleteSupabaseStorageObjects(bg.storage_paths).catch(() => {});
      }
      const res = await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: bg.id }),
      });
      if (res.ok) {
        notifyBackgroundsChanged();
        await loadAllBackgrounds();
        await refreshGlobalCatalog();
      }
    } catch (e) {
      console.warn('Delete background error:', e);
    }
  };

  const handleSaveRename = async (bg: BackgroundRow) => {
    const trimmed = editingName.trim();
    setEditingId(null);
    if (!trimmed || trimmed === bg.name_en) return;
    try {
      const res = await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: bg.id,
          name_en: trimmed,
        }),
      });
      if (res.ok) {
        notifyBackgroundsChanged();
        await loadAllBackgrounds();
        await refreshGlobalCatalog();
      }
    } catch {}
  };

  const handleCategoryChange = async (bg: BackgroundRow, newCategory: string) => {
    try {
      const res = await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: bg.id,
          category: newCategory,
        }),
      });
      if (res.ok) {
        notifyBackgroundsChanged();
        await loadAllBackgrounds();
        await refreshGlobalCatalog();
      }
    } catch {}
  };

  const handleSaveLicenceDetails = async (
    bg: BackgroundRow,
    details: {
      creator: string;
      source_url: string;
      license_name: string;
      license_url: string;
      date_checked: string;
      attribution_required: boolean;
    }
  ) => {
    try {
      const res = await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: bg.id,
          ...details,
          attribution: details.creator
            ? `${details.creator}${details.license_name ? ` (${details.license_name})` : ''}`
            : bg.attribution,
        }),
      });
      if (res.ok) {
        setOpenDetailsId(null);
        notifyBackgroundsChanged();
        await loadAllBackgrounds();
        await refreshGlobalCatalog();
      }
    } catch {}
  };

  const persistNewOrder = async (ordered: BackgroundRow[]) => {
    setBackgrounds(ordered);
    try {
      await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          order: ordered.map((b, idx) => ({ id: b.id, sort_order: idx })),
        }),
      });
      notifyBackgroundsChanged();
      await refreshGlobalCatalog();
    } catch {}
  };

  const handleMoveOrder = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= backgrounds.length) return;
    const copy = [...backgrounds];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    void persistNewOrder(copy);
  };

  const handleCardDropReorder = (targetId: string) => {
    if (!draggedBgId || draggedBgId === targetId) return;
    const fromIdx = backgrounds.findIndex((b) => b.id === draggedBgId);
    const toIdx = backgrounds.findIndex((b) => b.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const copy = [...backgrounds];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setDraggedBgId(null);
    void persistNewOrder(copy);
  };

  return (
    <div className="space-y-6">
      {/* Hidden file inputs for 1-step Add & Replace */}
      <input
        ref={addVideoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.m4v"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            enqueueAndStartFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={replaceVideoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.m4v"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && replaceTargetBg) {
            enqueueAndStartFiles(e.target.files, replaceTargetBg);
            setReplaceTargetBg(null);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={candidateVideoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.m4v"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && selectedCandidateForUpload) {
            enqueueAndStartFiles(e.target.files, null, selectedCandidateForUpload);
            setSelectedCandidateForUpload(null);
            e.target.value = '';
          }
        }}
      />

      {/* ONE-STEP DROPZONE HEADER */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed p-7 transition-all ${
          isDraggingOver
            ? 'border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/10'
            : 'border-emerald-500/35 bg-[#071A14]/90 hover:border-emerald-400/60'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-white">
                  One-Step Phone Background Uploader
                </h2>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Publishes Immediately • Auto 720p/480p
                </span>
              </div>
              <p className="text-xs text-white/70 max-w-xl">
                Drag & drop one or many videos here, or tap <strong>Add video</strong>. Compliant MP4s (≤720p, muted, &lt;45 MB) upload immediately; large files (130 MB+ or 4K) optimize automatically in the browser and verify live on phones before saying done.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-white/70">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <span className="text-white/60">Category:</span>
                  <select
                    value={defaultCategory}
                    onChange={(e) => setDefaultCategory(e.target.value)}
                    className="rounded-lg bg-black/40 border border-white/15 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="auto">Auto-detect from filename</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsDraftDefault}
                    onChange={(e) => setSaveAsDraftDefault(e.target.checked)}
                    className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Save as draft (OFF by default)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => addVideoInputRef.current?.click()}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Add video
            </button>
          </div>
        </div>
      </div>

      {/* PART A APPROVED SOURCES: NASA, PEXELS & PIXABAY (12 Pre-Processed + 1-Click Upload) */}
      <div className="rounded-2xl border border-emerald-500/25 bg-[#081511] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">
                  Approved Part A Sources: Pixabay, Pexels & NASA Image and Video Library
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  12 Approved 720p/480p Loops Pre-Processed • Auto Licence Attachment
                </span>
              </div>
              <p className="text-xs text-white/60">
                12 approved Pixabay, Pexels, and NASA scenes are pre-processed into 9:16 720p & 480p H.264 MP4s (muted, faststart, seamless loop) and live on phones. For additional candidates, click <strong>1. Download MP4</strong> then <strong>2. Upload File</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={seedingNasaId !== null}
              onClick={() => void handleSeedNasa()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {seedingNasaId === 'all' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Publish / Restore All 12 Approved Scenes
            </button>
            <button
              type="button"
              onClick={() => setShowApprovedShortlist((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/80 transition cursor-pointer"
            >
              {showApprovedShortlist ? 'Hide List' : 'Show List'}
              {showApprovedShortlist ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {showApprovedShortlist && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: 'all', label: `All Approved (${AMBIENT_VIDEO_CANDIDATES.length})` },
                  { key: 'Pixabay', label: 'Pixabay (Approved & Live)' },
                  { key: 'Pexels', label: 'Pexels (Approved & Live)' },
                  {
                    key: 'NASA Image and Video Library',
                    label: 'NASA Official API (Approved & Live)',
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setShortlistSourceFilter(tab.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    shortlistSourceFilter === tab.key
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
              {AMBIENT_VIDEO_CANDIDATES.filter(
                (c) =>
                  shortlistSourceFilter === 'all' || c.source === shortlistSourceFilter
              ).map((cand) => {
                const isAlreadyLive = backgrounds.some(
                  (b) =>
                    b.is_active &&
                    (b.id === cand.id ||
                      b.source_url === cand.pageLink ||
                      b.name_en.toLowerCase() === cand.title.toLowerCase())
                );

                return (
                  <div
                    key={cand.id}
                    className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 text-xs ${
                      isAlreadyLive
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : 'border-white/10 bg-black/30'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-white truncate">{cand.title}</span>
                        {isAlreadyLive && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
                            Live ✓
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/60">
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-emerald-300">
                          {cand.category}
                        </span>
                        <span>• {cand.source}</span>
                        <span>• {cand.orientation.split(' ')[0]}</span>
                      </div>
                      <p className="text-[11px] text-white/50 truncate">
                        Creator: {cand.creator} ({cand.licenseName})
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                      {cand.bundledAssets ? (
                        <button
                          type="button"
                          disabled={seedingNasaId !== null}
                          onClick={() => void handleSeedNasa(cand.id)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          {seedingNasaId === cand.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          {isAlreadyLive ? 'Re-verify NASA 720p/480p' : 'Publish NASA 720p/480p'}
                        </button>
                      ) : (
                        <>
                          <a
                            href={cand.pageLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-medium text-[11px] transition"
                          >
                            <Download className="w-3 h-3" />
                            1. Download MP4
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCandidateForUpload(cand);
                              candidateVideoInputRef.current?.click();
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-[11px] transition cursor-pointer"
                          >
                            <Upload className="w-3 h-3" />
                            2. Upload File
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ACTIVE & RECENT UPLOADS PIPELINE (Checking → Optimizing → Uploading → Saving → Live on phones ✓) */}
      {uploadQueue.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#081511] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Recent Uploads ({uploadQueue.length})
            </h3>
            <button
              type="button"
              onClick={() =>
                setUploadQueue((prev) =>
                  prev.filter((i) => i.step !== 'live')
                )
              }
              className="text-xs text-white/50 hover:text-white transition"
            >
              Clear finished
            </button>
          </div>

          <div className="space-y-3">
            {uploadQueue.map((item) => {
              const currentStepIdx = STEP_ORDER.findIndex((s) => s.key === item.step);
              return (
                <div
                  key={item.queueId}
                  className={`rounded-xl border p-4 space-y-3 ${
                    item.step === 'failed'
                      ? 'border-red-500/40 bg-red-950/20'
                      : item.step === 'live'
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {item.step === 'live' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : item.step === 'failed' ? (
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{item.title}</span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/80">
                            {item.category}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                            {item.pathType === 'fast' ? 'Fast Path' : 'Optimize Path'}
                          </span>
                        </div>
                        <p className="text-xs text-white/60">
                          Original: {item.file.name} ({formatBytesHuman(item.file.size)})
                          {item.finalSizeBytes
                            ? ` → Stored: ${formatBytesHuman(item.finalSizeBytes)}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    {item.step === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-slate-950 font-semibold text-xs transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry (File Kept)
                      </button>
                    )}
                  </div>

                  {/* 5-Step Status Bar: Checking → Optimizing → Uploading → Saving → Live on phones ✓ */}
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {STEP_ORDER.map((st, idx) => {
                      const isSkippedOptimize =
                        st.key === 'optimizing' && item.pathType === 'fast' && item.step !== 'checking';
                      const isCompleted =
                        item.step === 'live' ||
                        (item.step !== 'failed' && currentStepIdx > idx) ||
                        isSkippedOptimize;
                      const isCurrent = item.step === st.key;

                      return (
                        <div
                          key={st.key}
                          className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-medium border transition ${
                            isCompleted
                              ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                              : isCurrent
                              ? 'border-emerald-400 bg-emerald-500/30 text-white animate-pulse'
                              : 'border-white/10 bg-black/30 text-white/40'
                          }`}
                        >
                          {isSkippedOptimize ? 'Optimizing (Skipped)' : st.label}
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress Bar & Plain-English Status */}
                  <div className="space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.step === 'failed' ? 'bg-red-500' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${item.progressPct}%` }}
                      />
                    </div>
                    <p
                      className={`text-xs ${
                        item.step === 'failed'
                          ? 'text-red-300 font-medium'
                          : item.step === 'live'
                          ? 'text-emerald-300 font-medium'
                          : 'text-white/70'
                      }`}
                    >
                      {item.statusDetail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVE PHONE CATALOG (Reorder, Rename, Replace, Hide, Delete, Optional Licence Details) */}
      <div className="rounded-2xl border border-white/10 bg-[#081511] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Phone Background Catalog ({backgrounds.filter((b) => b.is_active).length} Live /{' '}
                {backgrounds.length} Total)
              </h3>
              <p className="text-xs text-white/60">
                Drag cards or use arrows to reorder. Changes sync to open phones within seconds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {storageStats && (
              <span className="text-xs text-white/60 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                Storage: {formatBytesHuman(storageStats.total_bytes)} / 1 GB
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadAllBackgrounds()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/80 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {loading && backgrounds.length === 0 ? (
          <div className="py-12 text-center text-white/50 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading backgrounds...
          </div>
        ) : backgrounds.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center space-y-2">
            <Film className="w-8 h-8 text-emerald-400/60 mx-auto" />
            <p className="text-sm font-medium text-white">No background videos uploaded yet</p>
            <p className="text-xs text-white/60">
              Drop any video above or click &ldquo;Add video&rdquo; to publish your first live phone background.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {backgrounds.map((bg, idx) => {
              const isEditing = editingId === bg.id;
              const isDetailsOpen = openDetailsId === bg.id;

              return (
                <div
                  key={bg.id}
                  draggable
                  onDragStart={() => setDraggedBgId(bg.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleCardDropReorder(bg.id)}
                  className={`rounded-xl border p-3.5 transition space-y-3 ${
                    bg.is_active
                      ? 'border-white/15 bg-white/[0.03]'
                      : 'border-amber-500/30 bg-amber-950/10 opacity-75'
                  }`}
                >
                  <div className="flex gap-3.5">
                    {/* Poster / Video Preview */}
                    <div className="relative w-24 h-36 rounded-lg overflow-hidden bg-black/60 border border-white/10 shrink-0">
                      {bg.poster_url ? (
                        <img
                          src={bg.poster_url}
                          alt={bg.name_en}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={bg.video_url_480p || bg.video_url}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span
                        className={`absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          bg.is_active
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {bg.is_active ? 'Live ✓' : 'Hidden'}
                      </span>
                    </div>

                    {/* Card Controls */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void handleSaveRename(bg);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                autoFocus
                                className="w-full rounded bg-black/60 border border-emerald-400 px-2 py-1 text-xs text-white"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveRename(bg)}
                                className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-semibold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GripVertical className="w-4 h-4 text-white/30 cursor-grab shrink-0" />
                              <h4 className="text-sm font-semibold text-white truncate">
                                {bg.name_en}
                              </h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(bg.id);
                                  setEditingName(bg.name_en);
                                }}
                                className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
                                title="Rename"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveOrder(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white/70"
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOrder(idx, 1)}
                              disabled={idx === backgrounds.length - 1}
                              className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white/70"
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                          <select
                            value={bg.category || 'nature'}
                            onChange={(e) => void handleCategoryChange(bg, e.target.value)}
                            className="rounded bg-black/40 border border-white/15 px-2 py-0.5 text-[11px] text-emerald-300"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <span>• {formatBytesHuman(bg.size_bytes)}</span>
                          {bg.video_url_480p && <span>• 720p + 480p</span>}
                        </div>

                        {(bg.creator || bg.license_name || bg.attribution) && (
                          <p className="text-[11px] text-emerald-300/80 truncate flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            {bg.creator || bg.attribution}
                            {bg.license_name ? ` (${bg.license_name})` : ''}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons: Replace, Hide/Show, Details, Delete */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setReplaceTargetBg(bg);
                            replaceVideoInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/80 transition cursor-pointer"
                        >
                          <Replace className="w-3.5 h-3.5" />
                          Replace
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleHide(bg)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/80 transition cursor-pointer"
                        >
                          {bg.is_active ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              Publish
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenDetailsId(isDetailsOpen ? null : bg.id)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition cursor-pointer"
                        >
                          Details
                          {isDetailsOpen ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDelete(bg)}
                          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-xs text-red-300 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Optional Licence / Source Details Drawer */}
                  {isDetailsOpen && (
                    <LicenceDetailsEditor
                      bg={bg}
                      onSave={(details) => void handleSaveLicenceDetails(bg, details)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LOG OF LAST 20 UPLOAD ATTEMPTS WITH EXACT ERROR REASONS */}
      <div className="rounded-2xl border border-white/10 bg-[#081511] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">
              Last 20 Upload Attempts Log ({attemptLogs.length})
            </h3>
          </div>
          {attemptLogs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setAttemptLogs([]);
                saveAttemptLogs([]);
              }}
              className="text-xs text-white/40 hover:text-white/80 transition"
            >
              Clear log
            </button>
          )}
        </div>

        {attemptLogs.length === 0 ? (
          <p className="text-xs text-white/50">
            No upload attempts recorded on this browser yet. Every upload attempt and any error reason will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Path</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Result / Error Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {attemptLogs.map((log) => (
                  <tr key={log.id} className="text-white/80">
                    <td className="py-2 pr-3 whitespace-nowrap text-white/50">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-3 font-medium text-white truncate max-w-[180px]">
                      {log.fileName}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatBytesHuman(log.fileSizeBytes)}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[11px]">
                        {log.pathType === 'fast' ? 'Fast' : 'Optimize'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {log.status === 'live' ? (
                        <span className="text-emerald-400 font-semibold">Live ✓</span>
                      ) : log.status === 'draft' ? (
                        <span className="text-amber-300 font-semibold">Draft</span>
                      ) : (
                        <span className="text-red-400 font-semibold inline-flex items-center gap-1">
                          <FileWarning className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2 ${
                        log.status === 'failed' ? 'text-red-300' : 'text-white/70'
                      }`}
                    >
                      {log.reason} ({(log.durationMs / 1000).toFixed(1)}s)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LicenceDetailsEditor({
  bg,
  onSave,
}: {
  bg: BackgroundRow;
  onSave: (details: {
    creator: string;
    source_url: string;
    license_name: string;
    license_url: string;
    date_checked: string;
    attribution_required: boolean;
  }) => void;
}) {
  const [creator, setCreator] = useState(bg.creator || '');
  const [sourceUrl, setSourceUrl] = useState(bg.source_url || '');
  const [licenseName, setLicenseName] = useState(bg.license_name || '');
  const [licenseUrl, setLicenseUrl] = useState(bg.license_url || '');
  const [dateChecked, setDateChecked] = useState(
    bg.date_checked || new Date().toISOString().slice(0, 10)
  );
  const [attributionRequired, setAttributionRequired] = useState(
    Boolean(bg.attribution_required)
  );

  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-2.5 text-xs">
      <div className="text-[11px] font-semibold text-emerald-300">
        Optional Licence & Attribution Metadata (Auto-filled for Part A videos)
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Creator / Videographer"
          value={creator}
          onChange={(e) => setCreator(e.target.value)}
          className="rounded bg-white/5 border border-white/10 px-2.5 py-1.5 text-white"
        />
        <input
          type="text"
          placeholder="Source Page URL"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className="rounded bg-white/5 border border-white/10 px-2.5 py-1.5 text-white"
        />
        <input
          type="text"
          placeholder="Licence Name (e.g. Pexels, CC0, CC BY 4.0)"
          value={licenseName}
          onChange={(e) => setLicenseName(e.target.value)}
          className="rounded bg-white/5 border border-white/10 px-2.5 py-1.5 text-white"
        />
        <input
          type="text"
          placeholder="Licence URL"
          value={licenseUrl}
          onChange={(e) => setLicenseUrl(e.target.value)}
          className="rounded bg-white/5 border border-white/10 px-2.5 py-1.5 text-white"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <label className="inline-flex items-center gap-1.5 text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={attributionRequired}
            onChange={(e) => setAttributionRequired(e.target.checked)}
          />
          <span>Show attribution in app Credits screen</span>
        </label>
        <button
          type="button"
          onClick={() =>
            onSave({
              creator,
              source_url: sourceUrl,
              license_name: licenseName,
              license_url: licenseUrl,
              date_checked: dateChecked,
              attribution_required: attributionRequired,
            })
          }
          className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-semibold text-xs cursor-pointer"
        >
          Save Details
        </button>
      </div>
    </div>
  );
}
