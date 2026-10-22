// src/components/PlayerScreen.tsx
import React, { useMemo } from "react";
import { BackgroundLayer } from "./BackgroundLayer";
import { useAmbientPlayer } from "../hooks/useAmbientPlayer";
import { usePlayer } from "../context/PlayerContext";
import { Background } from "../types";
import { motion, AnimatePresence } from "motion/react";
function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Full‑screen Quran recitation player with ambient background.
 *
 * Props:
 *  - backgrounds: list of available background videos (including ambient sound URLs).
 */
export const PlayerScreen: React.FC<{ backgrounds: Background[] }> = ({ backgrounds }) => {
  const {
    currentChapter,
    currentReciter,
    setActiveBackgroundVideoId,
    activeBackgroundVideoId,
    isNowPlayingOpen,
    setNowPlayingOpen,
  } = usePlayer();

  const {
    recitationAudio,
    ambientAudio,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    seekTo,
    setQuranVolume,
    setAmbientVolume,
    setPlaybackRate,
  } = useAmbientPlayer();

  const activeBackground = useMemo(
    () => backgrounds.find((b) => b.id === activeBackgroundVideoId) ?? backgrounds[0],
    [backgrounds, activeBackgroundVideoId]
  );

  // Handlers for background selection strip
  const handleSelectBackground = (id: string) => {
    setActiveBackgroundVideoId(id);
  };

  // Simple progress bar click handler
  const handleSeek = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const newTime = percent * duration;
    seekTo(newTime);
  };

  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* Background video layer */}
      <BackgroundLayer
        backgrounds={backgrounds}
        activeId={activeBackground.id}
        onSelect={handleSelectBackground}
      />

      {/* Glassmorphism player card */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md rounded-2xl bg-white/5 backdrop-blur-xl backdrop-saturate-150 border border-white/10 p-6 shadow-lg">
          {/* Reciter & Surah info */}
          <div className="flex items-center space-x-4 mb-4">
            {currentReciter?.imageUrl ? (
              <img
                src={currentReciter.imageUrl}
                alt={currentReciter.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                {currentReciter?.name?.[0] ?? "?"}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold">
                {currentChapter?.name_arabic ?? "..."}
              </h2>
              <p className="text-sm text-gray-300">
                {currentChapter?.translated_name?.name ?? ""} • {currentReciter?.name ?? ""}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-gray-700 rounded mb-4" onClick={handleSeek}>
            <div
              className="absolute inset-y-0 left-0 bg-green-400 rounded"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-300 mb-4">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center space-x-6 mb-4">
            <button
              aria-label="Previous Ayah"
              className="p-2 rounded-full hover:bg-white/10"
              onClick={() => window.dispatchEvent(new CustomEvent('player-previous-chapter'))}
            >
              ⏮️
            </button>
            <button
              aria-label={isPlaying ? "Pause" : "Play"}
              className="p-3 rounded-full bg-green-600 hover:bg-green-500"
              onClick={togglePlayPause}
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>
            <button
              aria-label="Next Ayah"
              className="p-2 rounded-full hover:bg-white/10"
              onClick={() => window.dispatchEvent(new CustomEvent('player-next-chapter'))}
            >
              ⏭️
            </button>
          </div>

          {/* Volume sliders */}
          <div className="flex flex-col space-y-3">
            <label className="flex items-center justify-between text-sm">
              Recitation Volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.8}
                aria-valuetext={`Recitation volume ${(0.8 * 100).toFixed(0)} percent`}
                onChange={(e) => setQuranVolume(parseFloat(e.target.value))}
                className="ml-2 w-32"
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              Ambient Volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.3}
                aria-valuetext={`Ambient volume ${(0.3 * 100).toFixed(0)} percent`}
                onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                className="ml-2 w-32"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Bottom background selector strip */}
      <div className="absolute bottom-0 left-0 right-0 pb-4">
        <div className="flex overflow-x-auto space-x-2 justify-center px-2">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              className={`flex-shrink-0 w-20 h-12 rounded ${bg.id === activeBackground.id ? "ring-2 ring-blue-400" : ""}`}
              onClick={() => handleSelectBackground(bg.id)}
            >
              <img src={bg.thumbnailUrl || bg.videoUrl} alt={bg.name} className="w-full h-full object-cover rounded" />
            </button>
          ))}
        </div>
      </div>

      {/* Hidden audio elements – controlled by hook */}
      <audio ref={recitationAudio} />
      <audio ref={ambientAudio} />
    </div>
  );
};
