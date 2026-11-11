/**
 * Background Audio & Wake Lock Coordinator (Phase 1A Fixed)
 *
 * Manages Screen Wake Lock while visible and playing, without monkey-patching
 * `window.Audio`, ignoring lock-screen `pause` events when hidden, or overwriting
 * `PlayerContext`'s authoritative `navigator.mediaSession` action handlers.
 */

import {
  getQuranAudio,
  getAmbientAudio,
  isDeliberatelyPausedByUser,
  resumeQuranPlaybackSync,
} from './persistentAudio';
import { isFeatureEnabled } from './featureFlags';
import { recordDiagEvent } from './prodDiagnostics';

let wakeLock: any = null;
let installed = false;

async function acquireWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  if (document.visibilityState !== 'visible') return;
  if (wakeLock) return;
  try {
    wakeLock = await (navigator as any).wakeLock.request('screen');
    wakeLock.addEventListener?.('release', () => {
      wakeLock = null;
    });
  } catch {
    // Wake lock is optional and can be denied in low-power mode
  }
}

function releaseWakeLock(): void {
  if (!wakeLock) return;
  try {
    wakeLock.release?.();
  } catch {}
  wakeLock = null;
}

export function installBackgroundAudioKeepAlive(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  const quran = getQuranAudio();
  const ambient = getAmbientAudio();

  quran.addEventListener('play', () => {
    void acquireWakeLock();
  });

  quran.addEventListener('pause', () => {
    releaseWakeLock();
  });

  quran.addEventListener('ended', () => {
    releaseWakeLock();
  });

  // When returning to foreground, only re-acquire wakeLock if already playing,
  // or recover if the OS suspended playback WITHOUT a deliberate user/lock-screen pause.
  const handleForeground = () => {
    if (document.visibilityState !== 'visible') return;

    if (!quran.paused) {
      void acquireWakeLock();
      return;
    }

    if (
      isFeatureEnabled('newAudioResumeEngine') &&
      !isDeliberatelyPausedByUser() &&
      Boolean(quran.src) &&
      !quran.ended
    ) {
      recordDiagEvent({
        category: 'lifecycle',
        event: 'FOREGROUND_AUTO_RECOVER_AFTER_OS_INTERRUPT',
        elementId: 'quran',
      });
      resumeQuranPlaybackSync()
        .then(() => {
          if (ambient.src && ambient.paused) {
            ambient.play().catch(() => {});
          }
        })
        .catch(() => {});
    }
  };

  document.addEventListener('visibilitychange', handleForeground);
  window.addEventListener('pageshow', handleForeground);
}
