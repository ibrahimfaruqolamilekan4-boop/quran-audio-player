// src/hooks/useAmbientPlayer.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { usePlayer } from "../context/PlayerContext";

/**
 * Hook that manages dual audio playback:
 *  - The primary Quran recitation (controlled by PlayerContext)
 *  - An optional ambient background track (handled here)
 *
 * It exposes playback controls, volume state, and updates the Media Session API
 * to enable lock‑screen controls on mobile/desktop.
 */
export function useAmbientPlayer() {
  const {
    currentChapter,
    currentReciter,
    currentAmbient,
    quranVolume,
    ambientVolume,
    setQuranVolume,
    setAmbientVolume,
    playbackRate,
    setPlaybackRate,
  } = usePlayer();

  // Refs to the two <audio> elements
  const recitationRef = useRef<HTMLAudioElement>(null);
  const ambientRef = useRef<HTMLAudioElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Update volumes when context values change
  useEffect(() => {
    if (recitationRef.current) recitationRef.current.volume = quranVolume;
    if (ambientRef.current) ambientRef.current.volume = ambientVolume;
  }, [quranVolume, ambientVolume]);

  // Pause ambient when its volume is set to 0
  useEffect(() => {
    const audio = ambientRef.current;
    if (!audio) return;
    if (ambientVolume === 0) {
      audio.pause();
    } else if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [ambientVolume, isPlaying]);

  // Sync Media Session metadata and handlers
  useEffect(() => {
    if ("mediaSession" in navigator && currentChapter && currentReciter) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${currentChapter.name_arabic} - ${currentReciter.name}`,
        artist: currentReciter.name,
        album: "Quran Audio",
        artwork: currentReciter.imageUrl
          ? [{ src: currentReciter.imageUrl, sizes: "256x256", type: "image/png" }]
          : [],
      });

      navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("previoustrack", () => playPrevious());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
    }
    // Cleanup on unmount
    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
        const actions = ["play", "pause", "previoustrack", "nexttrack", "seekto"] as const;
        actions.forEach((a) => navigator.mediaSession.setActionHandler(a, null));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter?.id, currentReciter?.id]);

  // Helper to load recitation source – PlayerContext already creates a URL via recitationObjectUrl.
  // Here we simply set the src when chapter/reciter changes.
  useEffect(() => {
    const audio = recitationRef.current;
    if (!audio || !currentChapter) return;
    // Assume a function `recitationObjectUrl` is globally available (imported in PlayerContext).
    // To avoid a circular import we lazily import inside the effect.
    import("../lib/recitations").then(async ({ loadRecitations, findRecitation, recitationObjectUrl }) => {
      try {
        const list = await loadRecitations();
        const match = findRecitation(list, currentReciter?.id ?? "", currentChapter.id);
        if (match) {
          const url = await recitationObjectUrl(match);
          if (url && audio) {
            audio.src = url;
            audio.load();
            if (isPlaying) audio.play().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Failed to load local recitation url:', err);
      }
    });
  }, [currentChapter?.id, currentReciter?.id, isPlaying]);

  // Time update listeners
  useEffect(() => {
    const audio = recitationRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDur = () => setDuration(audio.duration);
    const onEnd = () => {
      // Let PlayerContext handle chapter advance; we just pause.
      setIsPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const togglePlayPause = useCallback(() => {
    const rec = recitationRef.current;
    if (!rec) return;
    if (isPlaying) {
      rec.pause();
      ambientRef.current?.pause();
    } else {
      rec.play().catch(() => {});
      if (ambientVolume > 0) ambientRef.current?.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, ambientVolume]);

  const seekTo = useCallback((seconds: number) => {
    if (recitationRef.current) recitationRef.current.currentTime = seconds;
  }, []);

  const playNext = useCallback(() => {
    // Dispatch a custom event that PlayerContext listens for – same pattern used elsewhere.
    const ev = new CustomEvent("player-next-chapter");
    window.dispatchEvent(ev);
  }, []);

  const playPrevious = useCallback(() => {
    const ev = new CustomEvent("player-previous-chapter");
    window.dispatchEvent(ev);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recitationRef.current?.pause();
      ambientRef.current?.pause();
    };
  }, []);

  return {
    recitationAudio: recitationRef,
    ambientAudio: ambientRef,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    seekTo,
    setQuranVolume,
    setAmbientVolume,
    setPlaybackRate: (rate: number) => {
      if (recitationRef.current) recitationRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    },
  };
}
