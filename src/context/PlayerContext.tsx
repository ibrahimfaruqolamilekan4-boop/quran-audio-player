import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chapter, Reciter, AmbientTrack, CustomVideo } from '../types';
import {
  getQuranAudio,
  getAmbientAudio,
  markDeliberateUserPause,
  isDeliberatelyPausedByUser,
  setLastCanonicalStreamUrl,
  resumeQuranPlaybackSync,
} from '../lib/persistentAudio';
import { fetchActiveBackgrounds, subscribeToBackgrounds } from '../lib/supabase';
import { addListeningLog } from '../lib/storage';
import { CURATED_RECITERS } from '../lib/constants';
import { candidateUrls, extensionOf, isObjectUrl, rememberFormat, isSurahAvailable } from '../lib/audio';
import { resolveReciters, type GlobalReciterRow } from '../lib/reciters';
import localforage from 'localforage';
import { useAuth } from './AuthContext';
import { appApi, type AppPreferences } from '../lib/api';
import { ayahStreamUrl, cdnVoiceFor, clampAyah, versesInSurah } from '../lib/ayah';
import {
  loadRecitations,
  recitationObjectUrl,
  type StoredRecitation,
} from '../lib/recitations';
import { mediaStore, uploadMediaToServer } from '../lib/upload';
import { ALL_SURAHS } from '../lib/surahs';
import { getOfflineAudioUrl } from '../lib/offlineManager';
import { recordDiagEvent } from '../lib/prodDiagnostics';
import { isFeatureEnabled } from '../lib/featureFlags';

interface PlayerContextType {
  currentChapter: Chapter | null;
  currentReciter: Reciter | null;
  currentAmbient: AmbientTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  /** Set when a surah could not be streamed from any format/mirror, cleared on the next attempt. */
  playbackError: string | null;
  currentTime: number;
  duration: number;
  quranVolume: number;
  ambientVolume: number;
  playbackRate: number;
  setQuranVolume: (val: number) => void;
  setAmbientVolume: (val: number) => void;
  setPlaybackRate: (val: number) => void;
  playChapter: (chapter: Chapter, reciter?: Reciter) => void;
  togglePlayPause: () => void;
  setReciter: (reciter: Reciter) => void;
  switchReciterAndPlay: (reciter: Reciter) => void;
  isSurahAvailableForCurrentReciter: (chapterId: number) => boolean;
  setAmbientTrack: (track: AmbientTrack | null) => void;
  playNextChapter: () => void;
  playPreviousChapter: () => void;
  seekTo: (time: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  chapters: Chapter[];
  setChapters: (chapters: Chapter[]) => void;
  customReciters: Reciter[];
  setCustomReciters: (r: Reciter[]) => void;
  /** Curated + admin-published + this user's own reciters, with admin portraits applied. */
  allReciters: Reciter[];
  customVideos: CustomVideo[];
  setCustomVideos: (v: CustomVideo[]) => void;
  ambientVideoMapping: Record<string, string>;
  setAmbientVideoMapping: (m: Record<string, string>) => void;
  activeBackgroundVideoId: string | null;
  setActiveBackgroundVideoId: (id: string | null) => void;
  /** Full-screen Now Playing overlay (opened by playing or tapping the mini bar). */
  isNowPlayingOpen: boolean;
  setNowPlayingOpen: (open: boolean) => void;
  playMode: 'surah' | 'ayah';
  setPlayMode: (mode: 'surah' | 'ayah') => void;
  currentAyah: { surah: number; ayah: number } | null;
  /** Admin-uploaded recitations, newest first. Played ahead of the CDN mirrors. */
  recitations: StoredRecitation[];
  setRecitations: (list: StoredRecitation[]) => void;
  /** Device-local reciter edits (portrait/bio), merged over every reciter source. */
  reciterOverrides: Record<string, Partial<Reciter>>;
  updateReciterOverride: (id: string, patch: Partial<Reciter>) => void;
  /** Reload global reciters & ambient videos from the server. */
  refreshGlobalCatalog: () => Promise<void>;
  /** Push any locally saved sheikhs, profile photos, and background videos from this device to the cloud. */
  syncLocalAssetsToCloud: (onStatus?: (msg: string) => void) => Promise<{ syncedPhotos: number; syncedVideos: number }>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

/** One surah being loaded, including how far through the MP4 -> MP3 candidates we got. */
interface Attempt {
  reciterId: string;
  urls: string[];
  index: number;
  cacheKey: string;
  resumeAt: number;
  /** False while the listener deliberately loads a track without starting it. */
  autoplay: boolean;
  /** Extension of the URL being tried, remembered once it actually decodes. */
  pendingFormat: string | null;
  /** URL that really started playing; cached in the background for offline listening. */
  playedUrl: string | null;
}

function normalizePortableMediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim().replace(/^https?:\/\/localhost(:\d+)?/, '');
  if (!trimmed) return null;
  return trimmed;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [currentReciter, setCurrentReciter] = useState<Reciter | null>(null);
  const [currentAmbient, setCurrentAmbient] = useState<AmbientTrack | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [customReciters, setCustomReciters] = useState<Reciter[]>([]);
  const [globalReciters, setGlobalReciters] = useState<GlobalReciterRow[]>([]);
  const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);

  // Admin-uploaded recitations live on the device; loaded once, mutated by the admin panel.
  const [recitations, setRecitations] = useState<StoredRecitation[]>([]);
  const recitationsRef = useRef<StoredRecitation[]>([]);
  useEffect(() => {
    loadRecitations().then(list => {
      recitationsRef.current = list;
      setRecitations(list);
    }).catch(() => { /* storage unavailable — streaming still works */ });
  }, []);
  useEffect(() => { recitationsRef.current = recitations; }, [recitations]);

  // Device-local reciter edits (portrait/bio, incl. curated sheikhs) — design.md D6.
  const [reciterOverrides, setReciterOverrides] = useState<Record<string, Partial<Reciter>>>({});
  useEffect(() => {
    localforage.getItem<Record<string, Partial<Reciter>>>('reciterOverrides').then(saved => {
      if (saved && typeof saved === 'object') setReciterOverrides(saved);
    }).catch(() => { /* storage unavailable — curated defaults still show */ });
  }, []);

  const updateReciterOverride = useCallback((id: string, patch: Partial<Reciter>) => {
    setReciterOverrides(prev => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      localforage.setItem('reciterOverrides', next).catch(() => { /* best effort */ });
      return next;
    });
  }, []);

  const allReciters = useMemo<Reciter[]>(() => {
    const merged = resolveReciters([...CURATED_RECITERS, ...customReciters], globalReciters);
    if (Object.keys(reciterOverrides).length === 0) return merged;
    return merged.map(reciter => {
      const override = reciterOverrides[reciter.id];
      if (!override) return reciter;
      const cleanPatch: Partial<Reciter> = {};
      for (const [k, v] of Object.entries(override)) {
        if (v !== undefined && v !== null && v !== '') {
          (cleanPatch as any)[k] = v;
        }
      }
      // Prefer a hosted /api/media/ or https:// URL from globalReciters over a stale or missing local override
      const globalHasHostedImg =
        reciter.imageUrl &&
        (reciter.imageUrl.startsWith('/api/media/') ||
          reciter.imageUrl.startsWith('https://') ||
          reciter.imageUrl.startsWith('http://'));
      const imageUrl =
        cleanPatch.imageUrl && cleanPatch.imageUrl.startsWith('/api/media/')
          ? cleanPatch.imageUrl
          : globalHasHostedImg
          ? reciter.imageUrl
          : cleanPatch.imageUrl || reciter.imageUrl;
      return { ...reciter, ...cleanPatch, imageUrl, imageCredit: undefined };
    });
  }, [customReciters, globalReciters, reciterOverrides]);

  const [ambientVideoMapping, setAmbientVideoMapping] = useState<Record<string, string>>({});

  const [activeBackgroundVideoId, setActiveBackgroundVideoId] = useState<string | null>(() => {
    const saved = normalizePortableMediaUrl(localStorage.getItem('activeBackgroundVideoId'));
    return saved || null;
  });

  // Convert BackgroundRow[] into CustomVideo[] and reconcile active playing background
  const reconcileActiveBackgroundRows = useCallback((rows: any[]) => {
    const mapped: CustomVideo[] = rows
      .filter((r) => r && r.is_active !== false && (r.video_url || r.videoUrl))
      .map((r, idx) => ({
        id: r.id,
        name: r.name_en || r.name || 'Ambient Scene',
        category: r.category || 'nature',
        videoUrl: normalizePortableMediaUrl(r.video_url || r.videoUrl) || '',
        videoUrl720p: normalizePortableMediaUrl(r.video_url_720p || r.videoUrl720p || r.video_url || r.videoUrl) || undefined,
        videoUrl480p: normalizePortableMediaUrl(r.video_url_480p || r.videoUrl480p) || undefined,
        posterUrl: r.poster_url || r.posterUrl || undefined,
        poster_url: r.poster_url || r.posterUrl || undefined,
        renditions: Array.isArray(r.renditions) ? r.renditions : undefined,
        attribution: r.attribution || undefined,
        sourceUrl: r.source_url || r.sourceUrl || undefined,
        creator: r.creator || undefined,
        licenseName: r.license_name || r.licenseName || undefined,
        licenseUrl: r.license_url || r.licenseUrl || undefined,
        dateChecked: r.date_checked || r.dateChecked || undefined,
        attributionRequired: Boolean(r.attribution_required ?? r.attributionRequired),
        sizeBytes: Number(r.size_bytes ?? r.sizeBytes ?? 0),
        durationSeconds: Number(r.duration_seconds ?? r.durationSeconds ?? 0),
        isActive: true,
        isDefault: idx === 0,
      }));

    try {
      localStorage.setItem('noor_cached_backgrounds_v1', JSON.stringify(mapped));
    } catch {}

    setCustomVideos(mapped);

    // Reconcile activeBackgroundVideoId:
    // - If no background is selected and at least 1 active exists, select the first one.
    // - If the currently playing background was hidden or deleted, switch smoothly to another active one (or null if empty).
    setActiveBackgroundVideoId((prev) => {
      if (mapped.length === 0) {
        localStorage.removeItem('activeBackgroundVideoId');
        return null;
      }

      if (prev) {
        const stillExists = mapped.some(
          (v) =>
            v.id === prev ||
            v.videoUrl === prev ||
            v.videoUrl720p === prev ||
            v.videoUrl480p === prev
        );
        if (stillExists) return prev;
      }

      const nextTarget = mapped[0].id || mapped[0].videoUrl || null;
      if (nextTarget) {
        localStorage.setItem('activeBackgroundVideoId', nextTarget);
      }
      return nextTarget;
    });
  }, []);

  // Hydrate cached backgrounds immediately on mount for instant paint on phones
  useEffect(() => {
    try {
      const rawCache = localStorage.getItem('noor_cached_backgrounds_v1');
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomVideos(parsed);
        }
      }
    } catch {}
  }, []);

  const refreshGlobalCatalog = useCallback(async () => {
    try {
      const reciterData = await appApi<{ reciters: GlobalReciterRow[] }>('/reciters');
      if (Array.isArray(reciterData?.reciters)) {
        setGlobalReciters(reciterData.reciters);
      }
    } catch (err: any) {
      console.warn('Global reciters unavailable:', err?.message || String(err));
    }

    try {
      const [bgRows, data] = await Promise.all([
        fetchActiveBackgrounds(true).catch(() => null),
        appApi<{
          ambientSounds: Record<string, string>;
          videos?: CustomVideo[];
          activeDefaultVideoUrl?: string | null;
        }>('/ambient').catch(() => null),
      ]);

      if (data?.ambientSounds && Object.keys(data.ambientSounds).length > 0) {
        setAmbientVideoMapping((prev) => ({ ...prev, ...data.ambientSounds }));
      }

      if (Array.isArray(bgRows) && bgRows.length > 0) {
        reconcileActiveBackgroundRows(bgRows);
      } else if (Array.isArray(data?.videos)) {
        reconcileActiveBackgroundRows(data.videos);
      }
    } catch (err: any) {
      console.warn('Global ambient unavailable:', err?.message || String(err));
    }
  }, [reconcileActiveBackgroundRows]);

  // Subscribe to Realtime backgrounds + list version counter on mount, focus, online, visibility, and 60s interval
  useEffect(() => {
    localforage.getItem<Record<string, string>>('ambientVideoMapping').then(mapping => {
      if (mapping) setAmbientVideoMapping(prev => ({ ...mapping, ...prev }));
    }).catch(() => {});

    const unsubRealtime = subscribeToBackgrounds((updatedRows) => {
      reconcileActiveBackgroundRows(updatedRows);
    });

    const revalidate = () => {
      if (document.visibilityState === 'visible') {
        void refreshGlobalCatalog();
      }
    };

    void refreshGlobalCatalog();
    window.addEventListener('focus', revalidate);
    window.addEventListener('online', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    const intervalId = window.setInterval(revalidate, 60000);

    return () => {
      unsubRealtime();
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('online', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
      window.clearInterval(intervalId);
    };
  }, [refreshGlobalCatalog, reconcileActiveBackgroundRows]);

  // Update active background video when ambient track changes
  useEffect(() => {
    if (currentAmbient) {
      const mappedId = ambientVideoMapping[currentAmbient.id];
      if (mappedId) {
        setActiveBackgroundVideoId(mappedId);
      }
    }
  }, [currentAmbient, ambientVideoMapping]);

  const [isNowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [playMode, setPlayModeState] = useState<'surah' | 'ayah'>(() => {
    try { return localStorage.getItem('quran-garden:playMode') === 'ayah' ? 'ayah' : 'surah'; } catch { return 'surah'; }
  });
  const [currentAyah, setCurrentAyah] = useState<{ surah: number; ayah: number } | null>(null);
  const playModeRef = useRef(playMode);
  const currentAyahRef = useRef(currentAyah);
  playModeRef.current = playMode;
  currentAyahRef.current = currentAyah;

  useEffect(() => {
    const clean = normalizePortableMediaUrl(activeBackgroundVideoId);
    if (clean) localStorage.setItem('activeBackgroundVideoId', clean);
    else localStorage.removeItem('activeBackgroundVideoId');
  }, [activeBackgroundVideoId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Sync playback & loaded track state with window so service worker updates never interrupt recitation or lock-screen pause
  useEffect(() => {
    (window as any).__quranAudioPlaying = isPlaying;
    (window as any).__quranTrackLoaded = Boolean(currentChapter);
    if (!isPlaying && !currentChapter) {
      window.dispatchEvent(new CustomEvent('quran-audio-stopped-idle'));
    }
  }, [isPlaying, currentChapter]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [quranVolume, setQuranVolume] = useState(() => {
    const saved = localStorage.getItem('quranVolume');
    return saved ? parseFloat(saved) : 1.0;
  });

  const [ambientVolume, setAmbientVolume] = useState(() => {
    const saved = localStorage.getItem('ambientVolume');
    return saved ? parseFloat(saved) : 0.5;
  });

  const [playbackRate, setPlaybackRate] = useState(() => {
    const saved = localStorage.getItem('playbackRate');
    return saved ? parseFloat(saved) : 1.0;
  });

  const quranAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const listeningLogRef = useRef<{ surahId: number, reciterId: string, seconds: number, lastLoggedAt: number } | null>(null);
  /** Object URL of the loaded track, revoked when the next one takes its place. */
  const objectUrlRef = useRef<string | null>(null);
  const attemptRef = useRef<Attempt | null>(null);
  // Audio listeners are registered once, so they read live values through refs.
  const chaptersRef = useRef<Chapter[]>([]);
  const currentChapterRef = useRef<Chapter | null>(null);
  const currentReciterRef = useRef<Reciter | null>(null);
  const nextChapterRef = useRef<() => void>(() => {});

  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);
  useEffect(() => { currentChapterRef.current = currentChapter; }, [currentChapter]);
  useEffect(() => { currentReciterRef.current = currentReciter; }, [currentReciter]);

  /**
   * Push all locally saved sheikhs, profile photos, and background videos from this system
   * to the cloud database using chunked uploads so phones, tablets, and all users see them.
   */
  const syncLocalAssetsToCloud = useCallback(async (onStatus?: (msg: string) => void) => {
    let syncedPhotos = 0;
    let syncedVideos = 0;

    try {
      // 1. Sync all local customReciters + reciterOverrides to /api/media and /api/admin/reciters
      const localReciters = (await localforage.getItem<Reciter[]>('customReciters')) || [];
      const overrides = (await localforage.getItem<Record<string, Partial<Reciter>>>('reciterOverrides')) || {};
      let overridesChanged = false;
      let localRecitersChanged = false;

      // Build combined map of reciters that have local customizations or were created locally
      const reciterIds = new Set<string>([
        ...localReciters.map(r => r.id),
        ...Object.keys(overrides),
      ]);

      for (const id of reciterIds) {
        const curated = CURATED_RECITERS.find(c => c.id === id);
        const localRec = localReciters.find(c => c.id === id);
        const patch = overrides[id] || {};

        const name = patch.name || localRec?.name || curated?.name || id;
        const nameArabic = patch.nameArabic || localRec?.nameArabic || curated?.nameArabic;
        const category = patch.category || localRec?.category || curated?.category;
        const style = patch.style || localRec?.style || curated?.style || 'Murattal';
        const bio = patch.bio ?? localRec?.bio ?? curated?.bio;
        const serverUrl = patch.serverUrl ?? localRec?.serverUrl ?? curated?.serverUrl ?? '';
        let imageUrl = normalizePortableMediaUrl(patch.imageUrl || localRec?.imageUrl);

        if (imageUrl) {
          // If imageUrl is a data URL or a local /videos/uploads/ file, upload it to /api/media
          const isData = imageUrl.startsWith('data:image/');
          const isLocalUploadFile = false;

          if (isData || isLocalUploadFile) {
            try {
              onStatus?.(`Syncing portrait for ${name}...`);
              let uploadSource: Blob | string = imageUrl;
              if (isLocalUploadFile) {
                const resp = await fetch(imageUrl);
                if (resp.ok) {
                  uploadSource = await resp.blob();
                }
              }
              const hostedUrl = await uploadMediaToServer(uploadSource, {
                filename: `sheikh_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`,
                name,
                type: 'image/jpeg',
              });
              if (hostedUrl) {
                imageUrl = hostedUrl;
                if (overrides[id]) {
                  overrides[id] = { ...overrides[id], imageUrl: hostedUrl };
                  overridesChanged = true;
                }
                const idx = localReciters.findIndex(r => r.id === id);
                if (idx !== -1) {
                  localReciters[idx] = { ...localReciters[idx], imageUrl: hostedUrl };
                  localRecitersChanged = true;
                }
              }
            } catch (err) {
              console.warn('Portrait upload skipped for', id, err);
            }
          }
        }

        // Push reciter metadata + portrait to global_reciters so all users & phones see it
        try {
          await appApi('/admin/reciters', {
            method: 'POST',
            body: {
              id,
              name,
              nameArabic,
              style,
              category,
              bio,
              serverUrl,
              imageUrl: imageUrl || undefined,
            },
          });
          syncedPhotos++;
        } catch {}
      }

      if (overridesChanged) {
        setReciterOverrides({ ...overrides });
        await localforage.setItem('reciterOverrides', overrides);
      }
      if (localRecitersChanged) {
        setCustomReciters([...localReciters]);
        await localforage.setItem('customReciters', localReciters);
      }

      // Backgrounds are synced directly from Supabase Storage and database table
      try {
        const cloudBgs = await fetchActiveBackgrounds(true);
        if (Array.isArray(cloudBgs)) {
          setCustomVideos(cloudBgs.map((b, idx) => ({
            id: b.id,
            name: b.name_en,
            videoUrl: b.video_url,
            videoUrl720p: b.video_url_720p || b.video_url,
            videoUrl480p: b.video_url_480p || b.video_url,
            renditions: b.renditions || [],
            posterUrl: b.poster_url || undefined,
            poster_url: b.poster_url || undefined,
            category: b.category,
            isDefault: idx === 0,
            isPremium: b.is_premium,
            isDraft: b.is_draft,
            isActive: b.is_active,
            sizeBytes: b.size_bytes || undefined,
            durationSeconds: b.duration_seconds || undefined,
            attribution: b.attribution || undefined,
          })));
        }
      } catch {}

      await refreshGlobalCatalog();
    } catch (err) {
      console.warn('Cross-device sync notice:', err);
    }

    return { syncedPhotos, syncedVideos };
  }, [refreshGlobalCatalog]);

  // Initialize DB and Load Custom Reciter Assets
  useEffect(() => {
    async function loadCustomAssets() {
      const localReciters = (await localforage.getItem<Reciter[]>('customReciters')) || [];

      if (user) {
        try {
          const { reciters: cloudReciters } = await appApi<{ reciters: Reciter[] }>('/me/reciters');
          const merged = [...localReciters];
          for (const cr of cloudReciters) {
            const local = merged.find(r => r.id === cr.id);
            if (!local) {
              merged.push(cr);
            } else if (cr.imageUrl) {
              local.imageUrl = cr.imageUrl;
            }
          }
          setCustomReciters(merged);
          await localforage.setItem('customReciters', merged);
        } catch (e) {
          console.error('Failed to sync reciters from cloud', e);
          setCustomReciters(localReciters);
        }

        try {
          const { preferences } = await appApi<{ preferences: AppPreferences }>('/me/preferences');
          const prefVid = normalizePortableMediaUrl(preferences?.activeBackgroundVideoId);
          // Only apply user preference if it's a portable custom URL and not overriding with cosmos default
          if (
            prefVid &&

            (prefVid.startsWith('/api/media/') || prefVid.startsWith('http://') || prefVid.startsWith('https://'))
          ) {
            setActiveBackgroundVideoId(prefVid);
          }
          if (preferences?.ambientVideoMapping && typeof preferences.ambientVideoMapping === 'object') {
            setAmbientVideoMapping(prev => ({ ...preferences.ambientVideoMapping, ...prev }));
          }
        } catch (e) {
          console.error('Failed to sync preferences from cloud', e);
        }
      } else {
        setCustomReciters(localReciters);
      }

      // Automatically migrate any local sheikhs, photos, and videos saved on this system to cloud DB
      await syncLocalAssetsToCloud();
    }
    loadCustomAssets();
  }, [user, syncLocalAssetsToCloud]);

  /** Download a copy quietly so this surah is available offline next time it is opened. */
  const cacheInBackground = useCallback((url: string, cacheKey: string) => {
    if (isObjectUrl(url)) return; // it already came from the cache
    localforage.getItem<Blob>(cacheKey)
      .then(existing => {
        if (existing) return null;
        return fetch(url).then(res => (res.ok ? res.blob() : null));
      })
      .then(blob => (blob ? localforage.setItem(cacheKey, blob) : null))
      .catch(() => { /* offline storage is a bonus, never a failure */ });
  }, []);

  /** attemptPlayback is defined below; listeners and helpers reach it through this ref. */
  const attemptPlaybackRef = useRef<(index: number) => void>(() => {});

  /**
   * Move to the next candidate URL after a failure. Guarded on the element still pointing at the
   * URL that failed, because a bad source reports itself twice — once by rejecting play() and
   * once through the error event — and both must not burn a candidate.
   */
  const failAndAdvance = useCallback((failedUrl: string, reason: unknown) => {
    const audio = quranAudioRef.current;
    const attempt = attemptRef.current;
    if (!audio || !attempt || audio.src !== failedUrl) return;
    console.warn(`Could not play ${failedUrl}:`, reason);

    const nextIndex = attempt.index + 1;
    if (nextIndex < attempt.urls.length) {
      attemptPlaybackRef.current(nextIndex);
    } else {
      setIsLoading(false);
      setIsPlaying(false);
      setPlaybackError('Audio is not available, choose another sheik.');
    }
  }, []);

  /**
   * Point the audio element at `urls[index]` and start it.
   * If a URL fails or 404s, it advances to the next candidate mirror.
   */
  const attemptPlayback = useCallback((index: number) => {
    const audio = quranAudioRef.current;
    const attempt = attemptRef.current;
    if (!audio || !attempt) return;

    const url = attempt.urls[index];
    if (!url) {
      setIsLoading(false);
      setIsPlaying(false);
      setPlaybackError('Audio is not available, choose another sheik.');
      return;
    }

    attempt.index = index;
    attempt.pendingFormat = isObjectUrl(url) ? null : extensionOf(url);
    attempt.playedUrl = url;

    if (objectUrlRef.current && objectUrlRef.current !== url) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (isObjectUrl(url)) {
      objectUrlRef.current = url;
    } else {
      setLastCanonicalStreamUrl(url);
    }

    audio.src = url;
    if (attempt.resumeAt > 0) {
      const resume = attempt.resumeAt;
      audio.addEventListener('loadedmetadata', () => { audio.currentTime = resume; }, { once: true });
    }

    if (!attempt.autoplay) {
      markDeliberateUserPause(true);
      setIsLoading(false);
      return;
    }

    markDeliberateUserPause(false);
    audio
      .play()
      .catch(error => {
        const name = error?.name || '';
        if (name === 'NotAllowedError') {
          console.warn('Autoplay blocked by the browser:', error?.message || error);
          setIsLoading(false);
          setIsPlaying(false);
          setPlaybackError('Tap play again - the browser needs a gesture before audio can start.');
          return;
        }
        failAndAdvance(url, error);
      });
  }, [failAndAdvance]);

  useEffect(() => { attemptPlaybackRef.current = attemptPlayback; }, [attemptPlayback]);

  // Initialize audio elements
  useEffect(() => {
    quranAudioRef.current = getQuranAudio();
    ambientAudioRef.current = getAmbientAudio();
    ambientAudioRef.current.loop = true;

    try {
      quranAudioRef.current.setAttribute('playsinline', 'true');
      quranAudioRef.current.setAttribute('webkit-playsinline', 'true');
      ambientAudioRef.current.setAttribute('playsinline', 'true');
      ambientAudioRef.current.setAttribute('webkit-playsinline', 'true');
    } catch {}

    const updateTime = () => setCurrentTime(quranAudioRef.current?.currentTime || 0);
    const updateDuration = () => setDuration(quranAudioRef.current?.duration || 0);
    const handleEnded = () => nextChapterRef.current();
    const handlePlay = () => {
      markDeliberateUserPause(false);
      setIsPlaying(true);
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      } catch {}
    };
    const handlePause = () => {
      const qa = quranAudioRef.current;
      // Do not treat track end transition as a user pause
      if (qa && qa.ended) return;

      // CRITICAL FIX (Phase 1A): Even when document.visibilityState === 'hidden'
      // (i.e. phone screen is locked and user pressed Pause on the lock screen or
      // unplugged headphones), we MUST update isPlaying = false, pause ambient audio,
      // and set mediaSession.playbackState = 'paused' so the lock screen shows the
      // Play button and pressing Play resumes synchronously!
      if (isFeatureEnabled('newAudioResumeEngine')) {
        markDeliberateUserPause(true);
        if (ambientAudioRef.current && !ambientAudioRef.current.paused) {
          ambientAudioRef.current.pause();
        }
        setIsPlaying(false);
        try {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
        } catch {}
      } else {
        if (document.visibilityState === 'hidden') return;
        setIsPlaying(false);
      }
    };
    
    // Buffering and loading indicators
    const handleWaiting = () => setIsLoading(true);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleSeeking = () => setIsLoading(true);
    const handleSeeked = () => setIsLoading(false);

    // 'playing' means real decoded audio is flowing: format is trusted, loading finished
    const handlePlaying = () => {
      const attempt = attemptRef.current;
      setIsLoading(false);
      setPlaybackError(null);
      setIsPlaying(true);
      if (!attempt?.playedUrl) return;
      if (!isObjectUrl(attempt.playedUrl)) {
        setLastCanonicalStreamUrl(attempt.playedUrl);
      }
      rememberFormat(attempt.reciterId, attempt.pendingFormat || 'mp3');
      cacheInBackground(attempt.playedUrl, attempt.cacheKey);
    };

    // A 404 or a body that cannot be decoded surfaces here as well as in play()'s rejection;
    // failAndAdvance ignores whichever arrives second for the same URL.
    const handleError = () => {
      const attempt = attemptRef.current;
      if (!attempt) return;
      failAndAdvance(attempt.urls[attempt.index], 'audio element error event');
    };

    const quranAudio = quranAudioRef.current;

    quranAudio.addEventListener('timeupdate', updateTime);
    quranAudio.addEventListener('loadedmetadata', updateDuration);
    quranAudio.addEventListener('ended', handleEnded);
    quranAudio.addEventListener('play', handlePlay);
    quranAudio.addEventListener('pause', handlePause);
    quranAudio.addEventListener('playing', handlePlaying);
    quranAudio.addEventListener('waiting', handleWaiting);
    quranAudio.addEventListener('loadstart', handleLoadStart);
    quranAudio.addEventListener('canplay', handleCanPlay);
    quranAudio.addEventListener('seeking', handleSeeking);
    quranAudio.addEventListener('seeked', handleSeeked);
    quranAudio.addEventListener('error', handleError);

    quranAudio.preload = "auto";

    return () => {
      quranAudio.removeEventListener('timeupdate', updateTime);
      quranAudio.removeEventListener('loadedmetadata', updateDuration);
      quranAudio.removeEventListener('ended', handleEnded);
      quranAudio.removeEventListener('play', handlePlay);
      quranAudio.removeEventListener('pause', handlePause);
      quranAudio.removeEventListener('playing', handlePlaying);
      quranAudio.removeEventListener('waiting', handleWaiting);
      quranAudio.removeEventListener('loadstart', handleLoadStart);
      quranAudio.removeEventListener('canplay', handleCanPlay);
      quranAudio.removeEventListener('seeking', handleSeeking);
      quranAudio.removeEventListener('seeked', handleSeeked);
      quranAudio.removeEventListener('error', handleError);

      quranAudio.pause();
      ambientAudioRef.current?.pause();
    };
  }, [attemptPlayback, failAndAdvance, cacheInBackground]);

  // Tracking Listening Time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentChapter && currentReciter) {
      if (!listeningLogRef.current || listeningLogRef.current.surahId !== currentChapter.id) {
        listeningLogRef.current = {
          surahId: currentChapter.id,
          reciterId: currentReciter.id,
          seconds: 0,
          lastLoggedAt: Date.now()
        };
      }
      
      interval = setInterval(() => {
        if (listeningLogRef.current) {
          listeningLogRef.current.seconds += 10;
          addListeningLog(listeningLogRef.current.surahId, listeningLogRef.current.reciterId, 10);
        }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentChapter, currentReciter]);

  useEffect(() => {
    if (quranAudioRef.current) quranAudioRef.current.volume = quranVolume;
    localStorage.setItem('quranVolume', quranVolume.toString());
  }, [quranVolume]);

  useEffect(() => {
    if (ambientAudioRef.current) ambientAudioRef.current.volume = ambientVolume;
    localStorage.setItem('ambientVolume', ambientVolume.toString());
  }, [ambientVolume]);

  useEffect(() => {
    if (quranAudioRef.current) quranAudioRef.current.playbackRate = playbackRate;
    localStorage.setItem('playbackRate', playbackRate.toString());
  }, [playbackRate]);

  useEffect(() => {
    if (!ambientAudioRef.current) return;
    
    if (currentAmbient) {
      if (ambientAudioRef.current.src !== currentAmbient.url) {
        ambientAudioRef.current.src = currentAmbient.url;
      }
      ambientAudioRef.current.volume = ambientVolume;
      
      if (isPlaying) {
        ambientAudioRef.current.play().catch(e => console.warn('Ambient blocked:', e?.message));
      } else {
        ambientAudioRef.current.pause();
      }
    } else {
      ambientAudioRef.current.pause();
      ambientAudioRef.current.src = '';
    }
  }, [currentAmbient, isPlaying, ambientVolume]);

  // Auto-resume audio ONLY if the browser throttled during tab-switch (never if user paused on lock screen)
  useEffect(() => {
    const handleVisibility = () => {
      if (isDeliberatelyPausedByUser()) return;
      if (!document.hidden && isPlaying && quranAudioRef.current?.paused) {
        resumeQuranPlaybackSync({ fallbackUrls: attemptRef.current?.urls })
          .then(() => {
            if (currentAmbient && ambientAudioRef.current?.paused) {
              ambientAudioRef.current.play().catch(() => {});
            }
          })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isPlaying, currentAmbient]);

  /**
   * Load one surah for one reciter: the cached copy if we already have it, otherwise the first
   * candidate URL (MP4, then MP3). Playback starts as soon as the stream opens — the whole file
   * is never downloaded up front, which used to make every surah start dead silent.
   */
  const startChapter = useCallback((
    chapter: Chapter,
    reciter: Reciter,
    options: { resumeAt?: number; autoplay?: boolean; ayah?: number | null } = {}
  ) => {
    const audio = quranAudioRef.current;
    if (!audio) return;
    const { resumeAt = 0, autoplay = true } = options;

    const voice = cdnVoiceFor(reciter);
    let ayahNumber: number | null = null;
    if (options.ayah === undefined) {
      if (playModeRef.current === 'ayah' && voice) {
        const prev = currentAyahRef.current;
        ayahNumber = prev && prev.surah === chapter.id ? clampAyah(chapter.id, prev.ayah) : 1;
      }
    } else if (options.ayah !== null) {
      ayahNumber = clampAyah(chapter.id, options.ayah);
    }
    if (ayahNumber !== null && !voice) ayahNumber = null;
    const useAyahStream = ayahNumber !== null;
    setCurrentAyah(ayahNumber !== null ? { surah: chapter.id, ayah: ayahNumber } : null);

    // Guard against unavailable surahs for this reciter
    if (!useAyahStream && !isSurahAvailable(reciter, chapter.id)) {
      setIsLoading(false);
      setIsPlaying(false);
      setCurrentChapter(chapter);
      setPlaybackError(`Surah ${chapter.name_simple} has not been recorded by Sheikh ${reciter.name}. Please choose another sheikh.`);
      return;
    }

    setIsLoading(true);
    setPlaybackError(null);
    setCurrentChapter(chapter);

    const streamUrls =
      useAyahStream && voice
        ? [ayahStreamUrl(voice, chapter.id, ayahNumber as number)]
        : candidateUrls(reciter, chapter.id);

    const cacheKey =
      useAyahStream && voice
        ? `quran_ayah_${voice.voice}_${chapter.id}_${ayahNumber}`
        : `quran_audio_${reciter.id}_${chapter.id}`;

    attemptRef.current = {
      reciterId: reciter.id,
      urls: streamUrls,
      index: 0,
      cacheKey,
      resumeAt: useAyahStream ? 0 : resumeAt,
      autoplay,
      pendingFormat: null,
      playedUrl: null,
    };
    currentReciterRef.current = reciter;
    attemptPlayback(0);

    // Asynchronously prepend admin-uploaded recitation if available
    const uploadedEntry = recitationsRef.current.find(
      r => r.reciterId === reciter.id && r.surah === chapter.id
    );
    if (uploadedEntry) {
      recitationObjectUrl(uploadedEntry).then(upUrl => {
        if (upUrl && attemptRef.current?.cacheKey === cacheKey && quranAudioRef.current?.src !== upUrl) {
          attemptRef.current.urls = [upUrl, ...streamUrls];
          attemptPlayback(0);
        }
      }).catch(() => {});
    }

    // Check CacheStorage offline URL (/offline-audio/ with 206 Range support) without using revocable Blob URLs
    if (!useAyahStream) {
      getOfflineAudioUrl(chapter.id, reciter.id)
        .then(offlineUrl => {
          if (offlineUrl && attemptRef.current?.cacheKey === cacheKey) {
            attemptRef.current.urls = [offlineUrl, ...streamUrls];
            if (!offlineUrl.startsWith('blob:')) {
              setLastCanonicalStreamUrl(offlineUrl);
            }
          }
        })
        .catch(() => {});
    }
  }, [attemptPlayback]);

  const setPlayMode = (mode: 'surah' | 'ayah') => {
    if (mode === playModeRef.current) return;
    setPlayModeState(mode);
    playModeRef.current = mode;
    try { localStorage.setItem('quran-garden:playMode', mode); } catch { /* private mode */ }
    const chapter = currentChapterRef.current;
    const reciter = currentReciterRef.current;
    if (chapter && reciter) {
      void startChapter(chapter, reciter, { ayah: mode === 'ayah' ? 1 : null });
    }
  };

  /**
   * Synchronously starts playback on user click/tap.
   * Runs in the same callstack as the click event to prevent autoplay/gesture errors.
   */
  const playChapter = (chapter: Chapter, overrideReciter?: Reciter) => {
    const reciter = overrideReciter ?? currentReciter ?? allReciters[0];
    if (!chapter) return;
    if (!reciter) {
      setPlaybackError('No reciter is available yet. Please wait for the list to load.');
      return;
    }

    if (!isSurahAvailable(reciter, chapter.id)) {
      setCurrentChapter(chapter);
      setPlaybackError(`Surah ${chapter.name_simple} has not been recorded by Sheikh ${reciter.name}. Please choose another sheikh.`);
      setNowPlayingOpen(true);
      return;
    }

    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('quran-play-gesture')); } catch {}
    }
    setNowPlayingOpen(true);
    startChapter(chapter, reciter, { autoplay: true });
  };

  const switchReciterAndPlay = useCallback((newReciter: Reciter) => {
    setCurrentReciter(newReciter);
    const chapter = currentChapterRef.current || chaptersRef.current[0] || ALL_SURAHS[0];
    if (chapter) {
      playChapter(chapter, newReciter);
    }
  }, [playChapter]);

  const isSurahAvailableForCurrentReciter = useCallback((chapterId: number) => {
    const reciter = currentReciterRef.current || allReciters[0];
    return isSurahAvailable(reciter, chapterId);
  }, [allReciters]);

  const togglePlayPause = () => {
    const audio = quranAudioRef.current;
    if (!currentChapter || !audio) {
      if (!currentChapter) setPlaybackError('Pick a surah from the library to start listening.');
      return;
    }

    const actuallyPlaying = isPlaying && !audio.paused;
    if (actuallyPlaying) {
      markDeliberateUserPause(true);
      audio.pause();
      ambientAudioRef.current?.pause();
      setIsPlaying(false);
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      } catch {}
      return;
    }

    const reciter = currentReciter ?? allReciters[0];
    if (reciter && !isSurahAvailable(reciter, currentChapter.id)) {
      setPlaybackError(`Surah ${currentChapter.name_simple} has not been recorded by Sheikh ${reciter.name}. Please choose another sheikh.`);
      return;
    }

    const attempt = attemptRef.current;
    // Nothing loaded any more (every candidate failed, or the element was reset): retry.
    if (!audio.src || (attempt && attempt.index >= attempt.urls.length)) {
      if (!reciter) return;
      startChapter(currentChapter, reciter, { autoplay: true, resumeAt: currentTime });
      return;
    }

    setPlaybackError(null);
    markDeliberateUserPause(false);
    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('quran-play-gesture')); } catch {}
    }

    const playPromise = isFeatureEnabled('newAudioResumeEngine')
      ? resumeQuranPlaybackSync({
          fallbackUrls: attempt?.urls,
          resumePositionSec: audio.currentTime || currentTime,
        })
      : audio.play();

    playPromise
      .then(() => {
        if (currentAmbient && ambientAudioRef.current && ambientAudioRef.current.src) {
          ambientAudioRef.current.play().catch(e => console.warn(e?.message || String(e)));
        }
        setIsPlaying(true);
        try {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        } catch {}
      })
      .catch(e => {
        console.error('Play blocked', e?.message || String(e));
        if (e?.name === 'NotAllowedError') {
          setPlaybackError('Tap play again - the browser needs a gesture before audio can start.');
        } else {
          setPlaybackError('Audio is not available, choose another sheik.');
        }
      });
  };
  
  const seekTo = (time: number) => {
    if (quranAudioRef.current) {
      quranAudioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipForward = () => {
    if (quranAudioRef.current) {
      quranAudioRef.current.currentTime = Math.min(quranAudioRef.current.currentTime + 15, duration);
    }
  };

  const skipBackward = () => {
    if (quranAudioRef.current) {
      quranAudioRef.current.currentTime = Math.max(quranAudioRef.current.currentTime - 15, 0);
    }
  };

  const playNextChapter = useCallback(() => {
    const list = chaptersRef.current && chaptersRef.current.length > 0 ? chaptersRef.current : ALL_SURAHS;
    const chapter = currentChapterRef.current;
    const reciter = currentReciterRef.current;
    if (!reciter) return;

    if (!chapter) {
      if (list.length > 0) void startChapter(list[0], reciter);
      return;
    }

    const ayah = currentAyahRef.current;
    const voice = cdnVoiceFor(reciter);

    // Ayah mode: If an ayah is playing and hasn't reached the end of the surah, go to next ayah
    if (ayah && ayah.surah === chapter.id && voice && ayah.ayah < versesInSurah(ayah.surah)) {
      void startChapter(chapter, reciter, { ayah: ayah.ayah + 1 });
      return;
    }

    // Ayah mode at the end of surah OR Surah mode: advance to the next Surah!
    const currentIndex = list.findIndex(c => Number(c.id) === Number(chapter.id));
    const nextIndex = currentIndex > -1 && currentIndex < list.length - 1 ? currentIndex + 1 : 0;
    const nextChapter = list[nextIndex];

    if (nextChapter) {
      // If in ayah mode, start next surah at ayah 1 immediately
      const nextAyahOption = (playModeRef.current === 'ayah' && voice) ? { ayah: 1 } : {};
      void startChapter(nextChapter, reciter, nextAyahOption);
    }
  }, [startChapter]);

  const playPreviousChapter = useCallback(() => {
    const list = chaptersRef.current && chaptersRef.current.length > 0 ? chaptersRef.current : ALL_SURAHS;
    const chapter = currentChapterRef.current;
    const reciter = currentReciterRef.current;
    if (!reciter) return;

    if (!chapter) {
      if (list.length > 0) void startChapter(list[0], reciter);
      return;
    }

    const ayah = currentAyahRef.current;
    const voice = cdnVoiceFor(reciter);

    // Ayah mode: If beyond ayah 1, move to previous ayah
    if (ayah && ayah.surah === chapter.id && voice && ayah.ayah > 1) {
      void startChapter(chapter, reciter, { ayah: ayah.ayah - 1 });
      return;
    }

    // Move to previous surah (or wrap around to 114)
    const currentIndex = list.findIndex(c => Number(c.id) === Number(chapter.id));
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : list.length - 1;
    const prevChapter = list[prevIndex];

    if (prevChapter) {
      const prevAyahOption = (playModeRef.current === 'ayah' && voice) ? { ayah: 1 } : {};
      void startChapter(prevChapter, reciter, prevAyahOption);
    }
  }, [startChapter]);

  nextChapterRef.current = playNextChapter;
  const prevChapterRef = useRef<() => void>(() => {});
  prevChapterRef.current = playPreviousChapter;
  const seekRef = useRef<(time: number) => void>(() => {});
  seekRef.current = seekTo;

  // Switching sheikh mid-surah used to leave the old recitation playing, because the audio
  // element kept its src. Re-open the same surah from the new mirror, keeping the position.
  const loadedReciterIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previousId = loadedReciterIdRef.current;
    if (!currentReciter) return;
    loadedReciterIdRef.current = currentReciter.id;
    if (!previousId || previousId === currentReciter.id) return;

    const chapter = currentChapterRef.current;
    if (!chapter) return;
    const resumeAt = quranAudioRef.current?.currentTime || 0;
    const wasPlaying = isPlaying;
    void startChapter(chapter, currentReciter, { resumeAt, autoplay: wasPlaying });
  }, [currentReciter, isPlaying, startChapter]);

  // MediaSession API: Shows surah, reciter profile photo, and controls on phone lock screen / background
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (!currentChapter || !currentReciter) {
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    const ayahText = currentAyah ? ` • Ayah ${currentAyah.ayah}` : '';
    const chapterTitle = `${currentChapter.name_simple} (${currentChapter.name_arabic})${ayahText}`;
    const reciterName = currentReciter.name + (currentReciter.nameArabic ? ` (${currentReciter.nameArabic})` : '');

    const artwork: MediaImage[] = [];
    if (currentReciter.imageUrl) {
      const fullImageUrl = currentReciter.imageUrl.startsWith('http')
        ? currentReciter.imageUrl
        : `${window.location.origin}${currentReciter.imageUrl}`;
      artwork.push(
        { src: fullImageUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: fullImageUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: fullImageUrl, sizes: '512x512', type: 'image/jpeg' }
      );
    }
    artwork.push(
      { src: `${window.location.origin}/pwa-192x192.png`, sizes: '96x96', type: 'image/png' },
      { src: `${window.location.origin}/pwa-192x192.png`, sizes: '256x256', type: 'image/png' },
      { src: `${window.location.origin}/pwa-512x512.png`, sizes: '512x512', type: 'image/png' }
    );

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapterTitle,
        artist: reciterName,
        album: 'The Noble Quran • القرآن الكريم',
        artwork,
      });
    } catch (e) {
      console.warn('Failed to set MediaSession metadata:', e);
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentChapter, currentReciter, currentAyah, isPlaying]);

  // Position state for phone lock screen scrubber
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!currentChapter || !duration || isNaN(duration) || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: playbackRate || 1.0,
        position: Math.min(Math.max(0, currentTime), duration),
      });
    } catch {
      // Incase duration is out of range during track transitions
    }
  }, [currentTime, duration, playbackRate, currentChapter]);

  // MediaSession action handlers (next, prev, play, pause, seek) — 100% synchronous inside gesture
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => {
        const audio = quranAudioRef.current;
        recordDiagEvent({
          category: 'media_session',
          event: 'MEDIASSESSION_ACTION_PLAY',
          elementId: 'quran',
          readyState: audio?.readyState,
          networkState: audio?.networkState,
          currentTime: audio?.currentTime,
          src: audio?.src,
        });
        if (!audio) return;

        markDeliberateUserPause(false);

        const playPromise = isFeatureEnabled('newAudioResumeEngine')
          ? resumeQuranPlaybackSync({ fallbackUrls: attemptRef.current?.urls })
          : audio.play();

        playPromise
          .then(() => {
            setIsPlaying(true);
            if (ambientAudioRef.current && ambientAudioRef.current.src) {
              ambientAudioRef.current.play().catch(() => {});
            }
            try { navigator.mediaSession.playbackState = 'playing'; } catch { /* ignore */ }
          })
          .catch(() => {
            try { navigator.mediaSession.playbackState = 'paused'; } catch { /* ignore */ }
            window.setTimeout(() => {
              const retry = quranAudioRef.current;
              if (!retry) return;
              resumeQuranPlaybackSync({ fallbackUrls: attemptRef.current?.urls })
                .then(() => {
                  setIsPlaying(true);
                  try { navigator.mediaSession.playbackState = 'playing'; } catch { /* ignore */ }
                })
                .catch(() => {});
            }, 200);
          });
      }],
      ['pause', () => {
        const audio = quranAudioRef.current;
        recordDiagEvent({
          category: 'media_session',
          event: 'MEDIASSESSION_ACTION_PAUSE',
          elementId: 'quran',
          readyState: audio?.readyState,
          networkState: audio?.networkState,
          currentTime: audio?.currentTime,
          src: audio?.src,
        });
        markDeliberateUserPause(true);
        if (quranAudioRef.current) {
          quranAudioRef.current.pause();
        }
        if (ambientAudioRef.current) {
          ambientAudioRef.current.pause();
        }
        setIsPlaying(false);
        try { navigator.mediaSession.playbackState = 'paused'; } catch { /* ignore */ }
      }],
      ['previoustrack', () => {
        recordDiagEvent({
          category: 'media_session',
          event: 'MEDIASSESSION_ACTION_PREVIOUSTRACK',
          elementId: 'quran',
        });
        markDeliberateUserPause(false);
        prevChapterRef.current();
      }],
      ['nexttrack', () => {
        recordDiagEvent({
          category: 'media_session',
          event: 'MEDIASSESSION_ACTION_NEXTTRACK',
          elementId: 'quran',
        });
        markDeliberateUserPause(false);
        nextChapterRef.current();
      }],
      ['seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        recordDiagEvent({
          category: 'media_session',
          event: 'MEDIASSESSION_ACTION_SEEKBACKWARD',
          elementId: 'quran',
          details: { skip },
        });
        seekRef.current(Math.max((quranAudioRef.current?.currentTime || 0) - skip, 0));
      }],
      ['seekforward', (details) => {
        const skip = details.seekOffset || 10;
        recordDiagEvent({
          category: 'media_session',
          event: 'MEDIASSESSION_ACTION_SEEKFORWARD',
          elementId: 'quran',
          details: { skip },
        });
        seekRef.current(Math.min((quranAudioRef.current?.currentTime || 0) + skip, quranAudioRef.current?.duration || 0));
      }],
      ['seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          recordDiagEvent({
            category: 'media_session',
            event: 'MEDIASSESSION_ACTION_SEEKTO',
            elementId: 'quran',
            details: { seekTime: details.seekTime },
          });
          seekRef.current(details.seekTime);
        }
      }],
      ['stop', () => {
        recordDiagEvent({
          category: 'media_session',
          event: 'MEDIASSESSION_ACTION_STOP',
          elementId: 'quran',
        });
        markDeliberateUserPause(true);
        if (quranAudioRef.current) {
          quranAudioRef.current.pause();
        }
        if (ambientAudioRef.current) {
          ambientAudioRef.current.pause();
        }
        setIsPlaying(false);
        try { navigator.mediaSession.playbackState = 'paused'; } catch { /* ignore */ }
      }],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* Some actions not supported on all devices */
      }
    }
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentChapter,
      currentReciter,
      currentAmbient,
      isPlaying,
      isLoading,
      playbackError,
      currentTime,
      duration,
      quranVolume,
      ambientVolume,
      playbackRate,
      setQuranVolume,
      setAmbientVolume,
      setPlaybackRate,
      playChapter,
      togglePlayPause,
      setReciter: setCurrentReciter,
      switchReciterAndPlay,
      isSurahAvailableForCurrentReciter,
      setAmbientTrack: setCurrentAmbient,
      playNextChapter,
      playPreviousChapter,
      seekTo,
      skipForward,
      skipBackward,
      chapters,
      setChapters,
      customReciters,
      setCustomReciters,
      allReciters,
      customVideos,
      ambientVideoMapping,
      setAmbientVideoMapping,
      setCustomVideos,
      activeBackgroundVideoId,
      setActiveBackgroundVideoId,
      isNowPlayingOpen,
      setNowPlayingOpen,
      playMode,
      setPlayMode,
      currentAyah,
      recitations,
      setRecitations,
      reciterOverrides,
      updateReciterOverride,
      refreshGlobalCatalog,
      syncLocalAssetsToCloud,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
