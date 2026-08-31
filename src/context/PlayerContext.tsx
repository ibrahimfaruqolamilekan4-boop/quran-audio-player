import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Chapter, Reciter, AmbientTrack } from '../types';
import { addListeningLog } from '../lib/storage';

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
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [currentReciter, setCurrentReciter] = useState<Reciter | null>(null);
  const [currentAmbient, setCurrentAmbient] = useState<AmbientTrack | null>(null);
  
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
    return saved ? parseFloat(saved) : 0.4;
  });

  const [playbackRate, setPlaybackRate] = useState(() => {
    const saved = localStorage.getItem('playbackRate');
    return saved ? parseFloat(saved) : 1.0;
  });

  const quranAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const listeningLogRef = useRef<{ surahId: number, reciterId: string, seconds: number, lastLoggedAt: number } | null>(null);

  // Initialize audio elements
  useEffect(() => {
    quranAudioRef.current = new Audio();
    ambientAudioRef.current = new Audio();
    ambientAudioRef.current.loop = true;
    
    // Attach event listeners for progress tracking
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
    
    // Attempt to buffer enough data smoothly
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
  }, [chapters]); // Dependency to ensure handleEnded captures the latest chapters array via closure (simplified)

  // Tracking Listening Time (every 10 seconds of active playback)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentChapter && currentReciter) {
      // Init log state if needed
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
          // Commit to storage every 10 seconds for durability
          addListeningLog(listeningLogRef.current.surahId, listeningLogRef.current.reciterId, 10);
        }
      }, 10000);
    }

    return () => clearInterval(interval);
  }, [isPlaying, currentChapter, currentReciter]);

  // Update volumes when state changes
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

  // Synchronize ambient audio with play state and current track
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

  // Core playback function (Synchronous URL construction avoids Safari auto-play blocking!)
  const playChapter = (chapter: Chapter) => {
    if (!currentReciter || !quranAudioRef.current) return;
    
    try {
      setIsLoading(true);
      setCurrentChapter(chapter);
      
      // Construct mp3quran server URL directly based on Chapter ID (001.mp3, 114.mp3)
      const chapterNumberString = String(chapter.id).padStart(3, '0');
      const url = `${currentReciter.serverUrl}${chapterNumberString}.mp3`;
      
      quranAudioRef.current.src = url;
      
      // Promise handles autoplay policies safely
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

  // If reciter changes, update current playing audio instantly
  useEffect(() => {
    if (currentReciter && currentChapter && quranAudioRef.current) {
      const wasPlaying = isPlaying;
      const savedTime = quranAudioRef.current.currentTime;
      
      const chapterNumberString = String(currentChapter.id).padStart(3, '0');
      const url = `${currentReciter.serverUrl}${chapterNumberString}.mp3`;
      
      quranAudioRef.current.src = url;
      quranAudioRef.current.currentTime = savedTime;
      
      if (wasPlaying) {
        quranAudioRef.current.play().catch(console.error);
      }
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
      setChapters
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
