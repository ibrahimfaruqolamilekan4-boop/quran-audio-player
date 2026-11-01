import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chapter, Reciter, AmbientTrack, CustomVideo } from '../types';
import { getQuranAudio, getAmbientAudio } from '../lib/persistentAudio';
import { fetchActiveBackgrounds, subscribeToBackgrounds } from '../lib/supabase';
import { addListeningLog } from '../lib/storage';
import { CURATED_RECITERS } from '../lib/constants';
import { candidateUrls, extensionOf, isObjectUrl, rememberFormat } from '../lib/audio';
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
    }).catch(() => { /* storage unavailable â€” streaming still works */ });
  }, []);
  useEffect(() => { recitationsRef.current = recitations; }, [recitations]);

  // Device-local reciter edits (portrait/bio, incl. curated sheikhs) â€” design.md D6.
  const [reciterOverrides, setReciterOverrides] = useState<Record<string, Partial<Reciter>>>({});
  useEffect(() => {
    localforage.getItem<Record<string, Partial<Reciter>>>('reciterOverrides').then(saved => {
      if (saved && typeof saved === 'object') setReciterOverrides(saved);
    }).catch(() => { /* storage unavailable â€” curated defaults still show */ });
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
      const data = await appApi<{
        ambientSounds: Record<string, string>;
        videos?: CustomVideo[];
        activeDefaultVideoUrl?: string | null;
      }>('/ambient');

      if (data?.ambientSounds && Object.keys(data.ambientSounds).length > 0) {
        setAmbientVideoMapping(prev => ({ ...prev, ...data.ambientSounds }));
      }
      if (Array.isArray(data?.videos) && data.videos.length > 0) {
        setCustomVideos(prev => {
          const byKey = new Map<string, CustomVideo>();
          for (const item of prev) {
            byKey.set(item.id, item);
          }
          for (const cloudVid of data.videos!) {
            const existing = Array.from(byKey.values()).find(
              v => v.id === cloudVid.id || (v.name && cloudVid.name && v.name.toLowerCase() === cloudVid.name.toLowerCase())
            );
            if (existing) {
              byKey.set(existing.id, {
                ...existing,
                ...cloudVid,
                id: existing.id,
                videoUrl: cloudVid.videoUrl || existing.videoUrl,
              });
            } else {
              byKey.set(cloudVid.id, cloudVid);
            }
          }
          return Array.from(byKey.values());
        });
      }
      if (data?.activeDefaultVideoUrl) {
        const cleanDefault = normalizePortableMediaUrl(data.activeDefaultVideoUrl);
        if (cleanDefault) {
          setActiveBackgroundVideoId(prev => {
            const prevIsCustom =
              prev &&

              !prev.startsWith('curated_');
            if (prevIsCustom) {
              return prev;
            }
            localStorage.setItem('activeBackgroundVideoId', cleanDefault);
            return cleanDefault;
          });
        }
      }
    } catch (err: any) {
      console.warn('Global ambient unavailable:', err?.message || String(err));
    }
  }, []);

  // Load ambient mapping from local storage and revalidate global catalog on mount, focus, online, visibility, and 60s interval
  useEffect(() => {
    localforage.getItem<Record<string, string>>('ambientVideoMapping').then(mapping => {
      if (mapping) setAmbientVideoMapping(prev => ({ ...mapping, ...prev }));
    }).catch(() => {});

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
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('online', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
      window.clearInterval(intervalId);
    };
  }, [refreshGlobalCatalog]);

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

  // Sync playback state with window so service worker updates never interrupt recitation
  useEffect(() => {
    (window as any).__quranAudioPlaying = isPlaying;
    if (!isPlaying) {
      window.dispatchEvent(new CustomEvent('quran-audio-paused'));
    }
  }, [isPlaying]);

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

  // Initialize DB and Load Custom Assets
  useEffect(() => {
    async function loadCustomAssets() {
      const localReciters = (await localforage.getItem<Reciter[]>('customReciters')) || [];
      const videos = (await localforage.getItem<CustomVideo[]>('customVideos_list')) || [];

      if (videos.length > 0) {
        setCustomVideos(prev => {
          const map = new Map<string, CustomVideo>();
          videos.forEach(v => map.set(v.id, v));
          prev.forEach(v => map.set(v.id, { ...map.get(v.id), ...v }));
          return Array.from(map.values());
        });

        // Restore user's saved custom background video if activeBackgroundVideoId was reset to cosmos default
        const userCustomVideos = videos.filter(
          v => !v.id.startsWith('curated_')
        );
        if (userCustomVideos.length > 0) {
          const preferredVid = userCustomVideos.find(v => v.isDefault) || userCustomVideos[0];
          const preferredTarget = normalizePortableMediaUrl(preferredVid.videoUrl) || preferredVid.id;
          setActiveBackgroundVideoId(prev => {
            if (!prev) {
              localStorage.setItem('activeBackgroundVideoId', preferredTarget);
              return preferredTarget;
            }
            return prev;
          });
        }
      }

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
   * URL that failed, because a bad source reports itself twice â€” once by rejecting play() and
   * once through the error event â€” and both must not burn a candidate.
   */
  const failAndAdvance = useCallback((failedUrl: string, reason: unknown) => {
    const audio = quranAudioRef.current;
    const attempt = attemptRef.current;
    if (!audio || !attempt || audio.src !== failedUrl) return;
    console.warn(`Could not play ${failedUrl}:`, reason);
    attemptPlaybackRef.current(attempt.index + 1);
  }, []);

  /**
   * Point the audio element at `urls[index]` and start it. A 404 or an undecodable body moves on
   * to the next candidate, which is how a mirror without MP4 still plays from MP3.
   */
  const attemptPlayback = useCallback((index: number) => {
    const audio = quranAudioRef.current;
    const attempt = attemptRef.current;
    if (!audio || !attempt) return;

    const url = attempt.urls[index];
    if (!url) {
      setIsLoading(false);
      setIsPlaying(false);
      setPlaybackError('No audio could be loaded for this reciter. Check your connection or pick another sheikh.');
      return;
    }

    attempt.index = index;
    attempt.pendingFormat = isObjectUrl(url) ? null : extensionOf(url);
    // Recorded up front: the 'playing' event can beat play()'s promise resolution, and it is the
    // event handler that remembers the format and caches the surah.
    attempt.playedUrl = url;

    if (objectUrlRef.current && objectUrlRef.current !== url) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (isObjectUrl(url)) objectUrlRef.current = url;

    audio.src = url;
    if (attempt.resumeAt > 0) {
      const resume = attempt.resumeAt;
      audio.addEventListener('loadedmetadata', () => { audio.currentTime = resume; }, { once: true });
    }

    if (!attempt.autoplay) {
      setIsLoading(false);
      return;
    }

    audio
      .play()
      .catch(error => {
        const name = error?.name || '';
        if (name === 'NotAllowedError') {
          // The browser blocks autoplay until the page gets a real tap. The source is fine, so
          // falling through to the next candidate would wrongly call every mirror dead.
          console.warn('Autoplay blocked by the browser:', error?.message || error);
          setIsLoading(false);
          setIsPlaying(false);
          setPlaybackError('Tap play to begin â€” the browser needs a touch before audio can start.');
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
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => { if (document.visibilityState === 'hidden') return; setIsPlaying(false); };
    // 'playing' means real decoded audio is flowing: this is the only place a format is trusted.
    const handlePlaying = () => {
      const attempt = attemptRef.current;
      setIsLoading(false);
      setPlaybackError(null);
      if (!attempt?.playedUrl) return;
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
    quranAudio.addEventListener('error', handleError);

    quranAudio.preload = "auto";

    return () => {
      quranAudio.removeEventListener('timeupdate', updateTime);
      quranAudio.removeEventListener('loadedmetadata', updateDuration);
      quranAudio.removeEventListener('ended', handleEnded);
      quranAudio.removeEventListener('play', handlePlay);
      quranAudio.removeEventListener('pause', handlePause);
      quranAudio.removeEventListener('playing', handlePlaying);
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

  // Auto-resume audio if browser throttled during background or tab-switch
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isPlaying && quranAudioRef.current?.paused) {
        quranAudioRef.current.play().catch(() => {});
        if (currentAmbient && ambientAudioRef.current?.paused) {
          ambientAudioRef.current.play().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isPlaying, currentAmbient]);

  // Adhan playback coordination: duck / pause recitation when Adhan plays, resume afterwards
  const wasPlayingBeforeAdhanRef = useRef(false);
  useEffect(() => {
    const handleDuck = (e: Event) => {
      const customEvent = e as CustomEvent<{ ducked: boolean }>;
      const shouldDuck = customEvent.detail?.ducked;

      if (shouldDuck) {
        if (isPlaying) {
          wasPlayingBeforeAdhanRef.current = true;
          quranAudioRef.current?.pause();
          ambientAudioRef.current?.pause();
        }
      } else {
        if (wasPlayingBeforeAdhanRef.current) {
          wasPlayingBeforeAdhanRef.current = false;
          quranAudioRef.current?.play().catch(() => {});
          if (currentAmbient) {
            ambientAudioRef.current?.play().catch(() => {});
          }
        }
      }
    };

    window.addEventListener('nooraya-duck-recitation', handleDuck);
    return () => window.removeEventListener('nooraya-duck-recitation', handleDuck);
  }, [isPlaying, currentAmbient]);

  /**
   * Load one surah for one reciter: the cached copy if we already have it, otherwise the first
   * candidate URL (MP4, then MP3). Playback starts as soon as the stream opens â€” the whole file
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

    // Check offline cache in background without delaying immediate playback start
    localforage.getItem<Blob>(cacheKey).then(cached => {
      if (cached && attemptRef.current?.cacheKey === cacheKey && quranAudioRef.current?.paused) {
        const blobUrl = URL.createObjectURL(cached);
        if (attemptRef.current) {
          attemptRef.current.urls = [blobUrl, ...streamUrls];
        }
      }
    }).catch(() => {});
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

  const playChapter = async (chapter: Chapter, overrideReciter?: Reciter) => {
    // Callers that select a reciter and play in the same action pass it explicitly:
    // `currentReciter` state has not committed yet, so reading it here would
    // stream from the previously active reciter.
    const reciter = overrideReciter ?? currentReciter ?? allReciters[0];
    if (!chapter) return;
    if (!reciter) {
      setPlaybackError('No reciter is available yet. Please wait for the list to load.');
      return;
    }
    // Any view-level play opens the full-screen player; auto-advance and prev/next
    // navigate through startChapter directly and leave the surface as it is.
    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('quran-play-gesture')); } catch {}
    }
    setNowPlayingOpen(true);
    await startChapter(chapter, reciter);
  };

  const togglePlayPause = () => {
    const audio = quranAudioRef.current;
    if (!currentChapter || !audio) {
      if (!currentChapter) setPlaybackError('Pick a surah from the library to start listening.');
      return;
    }

    if (isPlaying) {
      audio.pause();
      ambientAudioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    const attempt = attemptRef.current;
    // Nothing loaded any more (every candidate failed, or the element was reset): retry.
    if (!audio.src || (attempt && attempt.index >= attempt.urls.length)) {
      const reciter = currentReciter ?? allReciters[0];
      if (!reciter) return;
      void startChapter(currentChapter, reciter);
      return;
    }

    setPlaybackError(null);
    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('quran-play-gesture')); } catch {}
    }
    audio
      .play()
      .then(() => {
        if (currentAmbient && ambientAudioRef.current && ambientAudioRef.current.src) {
          ambientAudioRef.current.play().catch(e => console.warn(e?.message || String(e)));
        }
        setIsPlaying(true);
      })
      .catch(e => {
        console.error("Play blocked", e?.message || String(e));
        setPlaybackError('Tap play again â€” the browser needs a gesture before audio can start.');
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

    const ayahText = currentAyah ? ` â€¢ Ayah ${currentAyah.ayah}` : '';
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
        album: 'The Noble Quran â€¢ ?????? ??????',
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

  // MediaSession action handlers (next, prev, play, pause, seek) â€” registered once via refs
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => {
        const audio = quranAudioRef.current;
        if (!audio) return;
        audio
          .play()
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
              retry
                .play()
                .then(() => {
                  setIsPlaying(true);
                  try { navigator.mediaSession.playbackState = 'playing'; } catch { /* ignore */ }
                })
                .catch(() => {});
            }, 250);
          });
      }],
      ['pause', () => {
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
        prevChapterRef.current();
      }],
      ['nexttrack', () => {
        nextChapterRef.current();
      }],
      ['seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        seekRef.current(Math.max((quranAudioRef.current?.currentTime || 0) - skip, 0));
      }],
      ['seekforward', (details) => {
        const skip = details.seekOffset || 10;
        seekRef.current(Math.min((quranAudioRef.current?.currentTime || 0) + skip, quranAudioRef.current?.duration || 0));
      }],
      ['seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          seekRef.current(details.seekTime);
        }
      }],
      ['stop', () => {
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
