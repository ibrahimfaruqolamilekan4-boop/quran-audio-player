// src/components/BackgroundLayer.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Background } from "../types";

/**
 * Full‑viewport background video layer with optional ambient audio.
 * Handles cross‑fade between videos and battery-saving visibility decoupling.
 */
export interface BackgroundLayerProps {
  /** List of available backgrounds */
  backgrounds: Background[];
  /** Id of the currently active background */
  activeId: string;
  /** Called when a new background is selected */
  onSelect: (id: string) => void;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  backgrounds,
  activeId,
  onSelect,
}) => {
  const active = useMemo(
    () => backgrounds.find((b) => b.id === activeId) ?? backgrounds[0],
    [backgrounds, activeId]
  );

  const [prevVideo, setPrevVideo] = useState<string | null>(null);
  const [isFading, setIsFading] = useState(false);
  const activeVideoRef = useRef<HTMLVideoElement>(null);

  // When activeId changes we start a fade transition
  useEffect(() => {
    if (!active) return;
    setPrevVideo((prev) => (prev !== active.videoUrl ? (prev ?? null) : null));
    setIsFading(true);
    const timer = setTimeout(() => {
      setPrevVideo(null);
      setIsFading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [active?.videoUrl]);

  // Pause video on background/lockscreen to save mobile battery
  useEffect(() => {
    const handleVis = () => {
      if (document.hidden) {
        activeVideoRef.current?.pause();
      } else {
        activeVideoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => document.removeEventListener("visibilitychange", handleVis);
  }, []);

  // Ambient audio – play only when volume > 0 (controlled by parent hook)
  const ambientRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ambientRef.current;
    if (!audio) return;
    if (active?.ambientUrl) {
      audio.src = active.ambientUrl;
      audio.loop = true;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    return () => {
      audio.pause();
    };
  }, [active?.ambientUrl]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {/* Current video */}
      <AnimatePresence initial={false}>
        {active?.videoUrl && (
          <motion.video
            ref={activeVideoRef}
            key={active.videoUrl}
            src={active.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            style={{ opacity: isFading ? 0 : 1, transition: "opacity 0.8s ease" }}
          />
        )}
        {/* Previous video for cross‑fade */}
        {prevVideo && (
          <motion.video
            key={prevVideo}
            src={prevVideo}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            style={{ opacity: isFading ? 1 : 0, transition: "opacity 0.8s ease" }}
          />
        )}
      </AnimatePresence>

      {/* Dark scrim gradient for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* Hidden audio element for ambient sound */}
      <audio ref={ambientRef} />
    </div>
  );
};
