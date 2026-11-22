import React, { useRef, useEffect } from 'react';
import './AmbientPlayer.css';

// Define the available scenes (ambient soundscapes)
const scenes: Record<string, { sound: string }> = {
  mountain: {
    sound: 'https://actions.google.com/sounds/v1/weather/rain_heavy.ogg',
  },
  night: {
    sound: 'https://actions.google.com/sounds/v1/environments/crickets_chirping.ogg',
  },
};

export default function AmbientPlayer() {
  const ambientAudioRef = useRef<HTMLAudioElement>(null);
  const ambientVolRef = useRef<HTMLInputElement>(null);

  // Initialise ambient volume on mount
  useEffect(() => {
    if (ambientAudioRef.current && ambientVolRef.current) {
      ambientAudioRef.current.volume = parseFloat(ambientVolRef.current.value);
    }
  }, []);

  const handleAmbientVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (ambientAudioRef.current) {
      const vol = parseFloat(e.target.value);
      ambientAudioRef.current.volume = vol;
      if (ambientAudioRef.current.paused && vol > 0) {
        ambientAudioRef.current.play().catch(() => {});
      }
    }
  };

  const switchTheme = (key: string) => {
    const scene = scenes[key];
    if (!scene) return;
    const audio = ambientAudioRef.current;
    if (audio) {
      audio.src = scene.sound;
      audio.load();
      audio.play().catch(() => {});
    }
    const pills = document.querySelectorAll('.theme-pill');
    pills.forEach(p => {
      p.classList.toggle('active', p.textContent?.toLowerCase().includes(key));
    });
  };

  return (
    <div className="bg-video-container">
      <div className="bg-scrim" />
      <audio ref={ambientAudioRef} loop />
      <main className="ui-overlay">
        <div className="player-card">
          <div className="track-info">
            <h2 className="track-title">Surah Al‑Fatihah</h2>
            <p className="track-artist">Mahmoud Khalil Al‑Husary</p>
          </div>

          {/* Primary audio volume */}
          <div className="slider-group">
            <label>Primary Audio</label>
            <input type="range" min={0} max={1} step={0.01} defaultValue={0.8} disabled />
          </div>

          {/* Ambient sound volume */}
          <div className="slider-group">
            <label>Ambient Sound (Rain / Nature)</label>
            <input
              ref={ambientVolRef}
              type="range"
              id="ambientVol"
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.4}
              onChange={handleAmbientVolume}
            />
          </div>

          {/* Theme selector pills */}
          <div className="theme-selector">
            <button className="theme-pill active" onClick={() => switchTheme('mountain')}>
              Mountain Rain
            </button>
            <button className="theme-pill" onClick={() => switchTheme('night')}>
              Night Stars
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
