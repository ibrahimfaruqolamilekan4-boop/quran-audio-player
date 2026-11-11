import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { installBackgroundAudioKeepAlive } from './lib/backgroundAudio';
import { installGlobalProdDiagnostics } from './lib/prodDiagnostics';

installGlobalProdDiagnostics();
installBackgroundAudioKeepAlive();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let pendingUpdateReady = false;

  const isAudioSessionActiveOrPausedWithTrack = (): boolean => {
    try {
      if ((window as any).__quranAudioPlaying === true) return true;
      if ((window as any).__quranTrackLoaded === true) return true;
      if (document.visibilityState === 'hidden') return true;
      const audios = document.querySelectorAll('audio');
      for (let i = 0; i < audios.length; i++) {
        if (!audios[i].paused || audios[i].currentTime > 0) return true;
      }
    } catch {}
    return false;
  };

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        // Never check or apply SW updates while hidden or while a track is loaded/playing
        if (document.visibilityState !== 'visible') return;
        if (isAudioSessionActiveOrPausedWithTrack()) return;
        registration.update().catch(() => {});
      };
      setInterval(check, 5 * 60 * 1000);
    },
    onNeedRefresh() {
      if (isAudioSessionActiveOrPausedWithTrack()) {
        pendingUpdateReady = true;
      } else {
        void updateSW(true);
      }
    },
    onOfflineReady() {
      console.info('[PWA] Nooraya is ready to work offline.');
    },
  });

  window.addEventListener('quran-audio-stopped-idle', () => {
    if (pendingUpdateReady && !isAudioSessionActiveOrPausedWithTrack()) {
      pendingUpdateReady = false;
      void updateSW(true);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
