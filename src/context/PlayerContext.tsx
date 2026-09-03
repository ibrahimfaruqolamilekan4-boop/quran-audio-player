import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Chapter, Reciter, AmbientTrack, CustomVideo } from '../types';
import { addListeningLog } from '../lib/storage';
import localforage from 'localforage';

interface PlayerContextType {
  currentChapter: Chapter | null;
  currentReciter: Reciter | null;
  currentAmbient: AmbientTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  quranVolume: number;
  ambientVolume: number;
  playbackRate: number;
  setQuranVolume: (val: number) => void;
  setAmbientVolume: (val: number) => void;
  setPlaybackRate: (val: number) => void;
  playChapter: (chapter: Chapter) => void;
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
  customVideos: CustomVideo[];
  setCustomVideos: (v: CustomVideo[]) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [currentReciter, setCurrentReciter] = useState<Reciter | null>(null);
  const [currentAmbient, setCurrentAmbient] = useState<AmbientTrack | null>(null);
  
  const [customReciters, setCustomReciters] = useState<Reciter[]>([]);
  const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);

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

  // Initialize DB and Load Custom Assets
  useEffect(() => {
    async function loadCustomAssets() {
      const reciters = await localforage.getItem<Reciter[]>('customReciters') || [];
      const videos = await localforage.getItem<CustomVideo[]>('customVideos_list') || [];
      setCustomReciters(reciters);
      setCustomVideos(videos);
    }
    loadCustomAssets();
  }, []);

  // Initialize audio elements
  useEffect(() => {
    quranAudioRef.current = new Audio();
    ambientAudioRef.current = new Audio();
    ambientAudioRef.current.loop = true;
    
    const updateTime = () => setCurrentTime(quranAudioRef.current?.currentTime || 0);
    const updateDuration = () => setDuration(quranAudioRef.current?.duration || 0);
    const handleEnded = () => playNextChapter();
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const quranAudio = quranAudioRef.current;
    
    quranAudio.addEventListener('timeupdate', updateTime);
    quranAudio.addEventListener('loadedmetadata', updateDuration);
    quranAudio.addEventListener('ended', handleEnded);
    quranAudio.addEventListener('play', handlePlay);
    quranAudio.addEventListener('pause', handlePause);
    
    quranAudio.preload = "metadata";

    return () => {
      quranAudio.removeEventListener('timeupdate', updateTime);
      quranAudio.removeEventListener('loadedmetadata', updateDuration);
      quranAudio.removeEventListener('ended', handleEnded);
      quranAudio.removeEventListener('play', handlePlay);
      quranAudio.removeEventListener('pause', handlePause);
      
      quranAudio.pause();
      ambientAudioRef.current?.pause();
    };
  }, [chapters]); 

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

  // Handle cached playback
  const fetchAndCacheAudio = async (url: string, cacheKey: string) => {
    try {
      const cachedBlob = await localforage.getItem<Blob>(cacheKey);
      if (cachedBlob) {
        return URL.createObjectURL(cachedBlob);
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      
      // Save for later
      await localforage.setItem(cacheKey, blob);
      
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn("Failed to cache audio, streaming directly:", e);
      return url; // fallback to direct streaming
    }
  };

  const playChapter = async (chapter: Chapter) => {
    if (!currentReciter || !quranAudioRef.current) return;
    
    try {
      setIsLoading(true);
      setCurrentChapter(chapter);
      
      const chapterNumberString = String(chapter.id).padStart(3, '0');
      const url = `${currentReciter.serverUrl}${chapterNumberString}.mp3`;
      const cacheKey = `quran_audio_${currentReciter.id}_${chapter.id}`;
      
      // Fetch Blob from IndexedDB or Network, then create object URL
      const finalUrl = await fetchAndCacheAudio(url, cacheKey);
      
      quranAudioRef.current.src = finalUrl;
      
      quranAudioRef.current.play()
        .then(() => {
          if (currentAmbient && ambientAudioRef.current && ambientAudioRef.current.src) {
            ambientAudioRef.current.play().catch(e => console.warn('Ambient play failed', e?.message || String(e)));
          }
        })
        .catch(error => {
          console.error("Playback failed. Interaction needed.", error?.message || String(error));
          setIsPlaying(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } catch (error: any) {
      console.error("Unexpected playback error", error?.message || String(error));
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!currentChapter || !quranAudioRef.current) return;
    
    if (isPlaying) {
      quranAudioRef.current.pause();
      ambientAudioRef.current?.pause();
      setIsPlaying(false);
    } else {
      quranAudioRef.current.play()
        .then(() => {
          if (currentAmbient && ambientAudioRef.current && ambientAudioRef.current.src) {
            ambientAudioRef.current.play().catch(e => console.warn(e?.message || String(e)));
          }
          setIsPlaying(true);
        })
        .catch(e => console.error("Play blocked", e?.message || String(e)));
    }
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
    if (!currentChapter || chapters.length === 0) return;
    const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);
    if (currentIndex < chapters.length - 1) {
      playChapter(chapters[currentIndex + 1]);
    }
  };

  const playPreviousChapter = () => {
    if (!currentChapter || chapters.length === 0) return;
    const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);
    if (currentIndex > 0) {
      playChapter(chapters[currentIndex - 1]);
    }
  };

  useEffect(() => {
    // Only auto-play if we actually switched reciter *while* already playing a track
    if (currentReciter && currentChapter && quranAudioRef.current) {
      // Small debounce/check to prevent infinite loop on first load
      // Realistically we want to pause, load new URL, and play.
      const handleReciterChange = async () => {
        const wasPlaying = isPlaying;
        const savedTime = quranAudioRef.current!.currentTime;
        
        setIsLoading(true);
        const chapterNumberString = String(currentChapter.id).padStart(3, '0');
        const url = `${currentReciter.serverUrl}${chapterNumberString}.mp3`;
        const cacheKey = `quran_audio_${currentReciter.id}_${currentChapter.id}`;
        
        const finalUrl = await fetchAndCacheAudio(url, cacheKey);
        
        quranAudioRef.current!.src = finalUrl;
        quranAudioRef.current!.currentTime = savedTime;
        
        setIsLoading(false);
        if (wasPlaying) {
          quranAudioRef.current!.play().catch(console.error);
        }
      };
      // To avoid triggering on first mount incorrectly, check if src is already set to current reciter
      // Just re-run play logic
    }
  }, [currentReciter]);

  return (
    <PlayerContext.Provider value={{
      currentChapter,
      currentReciter,
      currentAmbient,
      isPlaying,
      isLoading,
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
      customVideos,
      setCustomVideos
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
