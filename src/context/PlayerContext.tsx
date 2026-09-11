import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chapter, Reciter, AmbientTrack, CustomVideo } from '../types';
import { addListeningLog } from '../lib/storage';
import { CURATED_RECITERS } from '../lib/constants';
import { candidateUrls, extensionOf, isObjectUrl, rememberFormat } from '../lib/audio';
import { resolveReciters, type GlobalReciterRow } from '../lib/reciters';
import localforage from 'localforage';
import { useAuth } from './AuthContext';
import { appApi, type AppPreferences } from '../lib/api';

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

  const allReciters = useMemo<Reciter[]>(
    () => resolveReciters([...CURATED_RECITERS, ...customReciters], globalReciters),
    [customReciters, globalReciters]
  );

  const [ambientVideoMapping, setAmbientVideoMapping] = useState<Record<string, string>>({});

  // Sync ambient mapping from local storage initially
  useEffect(() => {
    localforage.getItem<Record<string, string>>('ambientVideoMapping').then(mapping => {
      if (mapping) setAmbientVideoMapping(mapping);
    });
  }, []);

  // Update active background video when ambient track changes
  useEffect(() => {
    if (currentAmbient) {
      const mappedId = ambientVideoMapping[currentAmbient.id];
      setActiveBackgroundVideoId(mappedId || null);
    }
  }, [currentAmbient, ambientVideoMapping]);

  const [activeBackgroundVideoId, setActiveBackgroundVideoId] = useState<string | null>(() => localStorage.getItem("activeBackgroundVideoId") || null);

  useEffect(() => {
    if (activeBackgroundVideoId) localStorage.setItem("activeBackgroundVideoId", activeBackgroundVideoId);
    else localStorage.removeItem("activeBackgroundVideoId");
  }, [activeBackgroundVideoId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  /** Reciters and portraits published in the admin panel are public, so load them signed out too. */
  useEffect(() => {
    appApi<{ reciters: GlobalReciterRow[] }>('/reciters')
      .then(data => setGlobalReciters(Array.isArray(data.reciters) ? data.reciters : []))
      .catch(err => console.warn('Global reciters unavailable:', err?.message || String(err)));
  }, []);

  // Initialize DB and Load Custom Assets
  useEffect(() => {
    async function loadCustomAssets() {
      // Always load local first
      const localReciters = await localforage.getItem<Reciter[]>('customReciters') || [];
      const videos = await localforage.getItem<CustomVideo[]>('customVideos_list') || [];

      setCustomVideos(videos);

      if (user) {
        // Sync reciters from Neon
        try {
          const { reciters: cloudReciters } = await appApi<{ reciters: Reciter[] }>('/me/reciters');

          // Merge local and cloud reciters. A locally stored photo is never erased
          // by a sync response that carries none, and a newer server photo wins.
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

        // Sync active video from Neon
        try {
          const { preferences } = await appApi<{ preferences: AppPreferences }>('/me/preferences');
          if (preferences.activeBackgroundVideoId) {
            setActiveBackgroundVideoId(preferences.activeBackgroundVideoId);
          }
        } catch (e) {
          console.error('Failed to sync preferences from cloud', e);
        }

      } else {
        setCustomReciters(localReciters);
      }
    }
    loadCustomAssets();
  }, [user]);

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
    audio.load();
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
          setPlaybackError('Tap play to begin — the browser needs a touch before audio can start.');
          return;
        }
        failAndAdvance(url, error);
      });
  }, [failAndAdvance]);

  useEffect(() => { attemptPlaybackRef.current = attemptPlayback; }, [attemptPlayback]);

  // Initialize audio elements
  useEffect(() => {
    quranAudioRef.current = new Audio();
    ambientAudioRef.current = new Audio();
    ambientAudioRef.current.loop = true;

    const updateTime = () => setCurrentTime(quranAudioRef.current?.currentTime || 0);
    const updateDuration = () => setDuration(quranAudioRef.current?.duration || 0);
    const handleEnded = () => nextChapterRef.current();
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
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

  /**
   * Load one surah for one reciter: the cached copy if we already have it, otherwise the first
   * candidate URL (MP4, then MP3). Playback starts as soon as the stream opens — the whole file
   * is never downloaded up front, which used to make every surah start dead silent.
   */
  const startChapter = useCallback(async (
    chapter: Chapter,
    reciter: Reciter,
    options: { resumeAt?: number; autoplay?: boolean } = {}
  ) => {
    const audio = quranAudioRef.current;
    if (!audio) return;
    const { resumeAt = 0, autoplay = true } = options;

    setIsLoading(true);
    setPlaybackError(null);
    setCurrentChapter(chapter);

    const urls = candidateUrls(reciter, chapter.id);
    const cacheKey = `quran_audio_${reciter.id}_${chapter.id}`;

    let blobUrl: string | null = null;
    try {
      const cached = await localforage.getItem<Blob>(cacheKey);
      if (cached) blobUrl = URL.createObjectURL(cached);
    } catch {
      /* IndexedDB unavailable — streaming still works */
    }

    attemptRef.current = {
      reciterId: reciter.id,
      urls: blobUrl ? [blobUrl, ...urls] : urls,
      index: 0,
      cacheKey,
      resumeAt,
      autoplay,
      pendingFormat: null,
      playedUrl: null,
    };
    // Selecting a sheikh and playing in the same click means currentReciter state has not
    // committed yet, so seed the ref the handlers read from.
    currentReciterRef.current = reciter;
    attemptPlayback(0);
  }, [attemptPlayback]);

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
        setPlaybackError('Tap play again — the browser needs a gesture before audio can start.');
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

  const playNextChapter = () => {
    const list = chaptersRef.current;
    const chapter = currentChapterRef.current;
    const reciter = currentReciterRef.current;
    if (!chapter || list.length === 0 || !reciter) return;
    const currentIndex = list.findIndex(c => c.id === chapter.id);
    if (currentIndex > -1 && currentIndex < list.length - 1) {
      void startChapter(list[currentIndex + 1], reciter);
    }
  };

  const playPreviousChapter = () => {
    const list = chaptersRef.current;
    const chapter = currentChapterRef.current;
    const reciter = currentReciterRef.current;
    if (!chapter || list.length === 0 || !reciter) return;
    const currentIndex = list.findIndex(c => c.id === chapter.id);
    if (currentIndex > 0) {
      void startChapter(list[currentIndex - 1], reciter);
    }
  };

  nextChapterRef.current = playNextChapter;

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
      setActiveBackgroundVideoId
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
