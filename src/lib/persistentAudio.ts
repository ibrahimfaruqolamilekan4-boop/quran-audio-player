/**
 * Nooraya Persistent Audio Engine (Phase 1A Hardened)
 *
 * Provides persistent singleton HTMLAudioElement instances outside the React
 * component lifecycle to guarantee uninterrupted background playback and
 * synchronous lock-screen resume on iOS Safari, iPadOS, Android Chrome, and PWAs.
 */

import { instrumentAudioElement, recordDiagEvent } from './prodDiagnostics';

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  artworkUrls: string[];
}

let quranAudioInstance: HTMLAudioElement | null = null;
let ambientAudioInstance: HTMLAudioElement | null = null;
let adhanAudioInstance: HTMLAudioElement | null = null;

/**
 * Tracks whether the user explicitly paused playback (via UI button, lock-screen
 * MediaSession 'pause' action, or headphone disconnect while hidden) so that
 * visibilitychange / focus listeners never auto-unpause against the user's will.
 */
let deliberatePauseByUser = true;
let lastKnownPositionSec = 0;
let lastCanonicalStreamUrl = '';

export function markDeliberateUserPause(isDeliberate: boolean): void {
  deliberatePauseByUser = isDeliberate;
}

export function isDeliberatelyPausedByUser(): boolean {
  return deliberatePauseByUser;
}

export function setLastCanonicalStreamUrl(url: string): void {
  if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
    lastCanonicalStreamUrl = url;
  }
}

export function getLastCanonicalStreamUrl(): string {
  return lastCanonicalStreamUrl;
}

export function getLastKnownPositionSec(): number {
  return lastKnownPositionSec;
}

function createSafeAudioElement(): HTMLAudioElement {
  if (typeof Audio !== 'undefined') {
    return new Audio();
  }
  const stub: any = {
    src: '',
    preload: 'auto',
    loop: false,
    volume: 1,
    muted: false,
    paused: true,
    currentTime: 0,
    duration: 0,
    readyState: 4,
    networkState: 1,
    error: null,
    onended: null,
    onerror: null,
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    load() {},
    async play() {
      this.paused = false;
    },
    pause() {
      this.paused = true;
    },
  };
  return stub as HTMLAudioElement;
}

export function getQuranAudio(): HTMLAudioElement {
  if (!quranAudioInstance) {
    quranAudioInstance = createSafeAudioElement();
    quranAudioInstance.preload = 'auto';
    quranAudioInstance.setAttribute('playsinline', 'true');
    quranAudioInstance.setAttribute('webkit-playsinline', 'true');
    // Explicitly never set crossorigin="anonymous" on Quran streaming element
    // so CDN redirects and Range requests are never blocked by CORS preflights.
    quranAudioInstance.removeAttribute?.('crossorigin');
    (quranAudioInstance as any).x5Playsinline = true;

    quranAudioInstance.addEventListener('timeupdate', () => {
      if (quranAudioInstance && quranAudioInstance.currentTime > 0) {
        lastKnownPositionSec = quranAudioInstance.currentTime;
      }
    });

    instrumentAudioElement(quranAudioInstance, 'quran');
  }
  return quranAudioInstance;
}

export function getAmbientAudio(): HTMLAudioElement {
  if (!ambientAudioInstance) {
    ambientAudioInstance = createSafeAudioElement();
    ambientAudioInstance.loop = true;
    ambientAudioInstance.preload = 'auto';
    ambientAudioInstance.setAttribute('playsinline', 'true');
    ambientAudioInstance.setAttribute('webkit-playsinline', 'true');
    ambientAudioInstance.removeAttribute?.('crossorigin');
    (ambientAudioInstance as any).x5Playsinline = true;
    instrumentAudioElement(ambientAudioInstance, 'ambient');
  }
  return ambientAudioInstance;
}

export function getAdhanAudio(): HTMLAudioElement {
  if (!adhanAudioInstance) {
    adhanAudioInstance = createSafeAudioElement();
    adhanAudioInstance.preload = 'auto';
    adhanAudioInstance.setAttribute('playsinline', 'true');
    adhanAudioInstance.setAttribute('webkit-playsinline', 'true');
    adhanAudioInstance.removeAttribute?.('crossorigin');
    (adhanAudioInstance as any).x5Playsinline = true;
    instrumentAudioElement(adhanAudioInstance, 'adhan');
  }
  return adhanAudioInstance;
}

/**
 * Synchronously resumes the singleton Quran `<audio>` element inside a MediaSession
 * or UI gesture with ZERO `await` before `audio.play()`.
 *
 * If the browser evicted the media buffer or closed the HTTP socket while paused
 * on the lock screen (`readyState === 0`, `error !== null`, or `blob:` revoked),
 * it synchronously reloads the canonical HTTPS stream URL and restores `currentTime`
 * before calling `audio.play()`.
 */
export function resumeQuranPlaybackSync(options?: {
  fallbackUrls?: string[];
  resumePositionSec?: number;
}): Promise<void> {
  const audio = getQuranAudio();
  deliberatePauseByUser = false;

  const targetPos =
    options?.resumePositionSec !== undefined && options.resumePositionSec > 0
      ? options.resumePositionSec
      : audio.currentTime > 0
      ? audio.currentTime
      : lastKnownPositionSec;

  const currentSrc = audio.src || '';
  const isBrokenBlob = currentSrc.startsWith('blob:') && (audio.readyState === 0 || Boolean(audio.error));
  const needsReload =
    !currentSrc ||
    Boolean(audio.error) ||
    audio.readyState === 0 ||
    isBrokenBlob;

  if (needsReload) {
    const recoveryUrl =
      lastCanonicalStreamUrl ||
      options?.fallbackUrls?.find((u) => u && !u.startsWith('blob:')) ||
      options?.fallbackUrls?.[0] ||
      currentSrc;

    if (recoveryUrl) {
      recordDiagEvent({
        category: 'media_session',
        event: 'SYNC_STREAM_RECOVERY_BEFORE_PLAY',
        elementId: 'quran',
        src: recoveryUrl,
        readyState: audio.readyState,
        networkState: audio.networkState,
        errorCode: audio.error ? audio.error.code : null,
        currentTime: targetPos,
      });

      audio.src = recoveryUrl;
      if (targetPos > 0) {
        try {
          audio.currentTime = targetPos;
        } catch {
          audio.addEventListener(
            'loadedmetadata',
            () => {
              try {
                audio.currentTime = targetPos;
              } catch {}
            },
            { once: true }
          );
        }
      }
    }
  }

  return audio.play();
}

interface DuckedPlaybackSnapshot {
  quranWasPlaying: boolean;
  ambientWasPlaying: boolean;
  quranVolume: number;
  ambientVolume: number;
}

let activeDuckSnapshot: DuckedPlaybackSnapshot | null = null;

/**
 * Gently ducks and pauses Quran recitation & ambient audio when Adhan starts playing,
 * saving their exact state so they can be resumed automatically when Adhan ends or is silenced.
 */
export function duckAndPauseForAdhan(): DuckedPlaybackSnapshot {
  const quran = getQuranAudio();
  const ambient = getAmbientAudio();

  if (!activeDuckSnapshot) {
    activeDuckSnapshot = {
      quranWasPlaying: !quran.paused && Boolean(quran.src),
      ambientWasPlaying: !ambient.paused && Boolean(ambient.src),
      quranVolume: quran.volume,
      ambientVolume: ambient.volume,
    };
  }

  if (activeDuckSnapshot.quranWasPlaying) {
    try {
      quran.volume = Math.max(0.05, activeDuckSnapshot.quranVolume * 0.2);
      quran.pause();
    } catch {}
  }

  if (activeDuckSnapshot.ambientWasPlaying) {
    try {
      ambient.volume = Math.max(0.05, activeDuckSnapshot.ambientVolume * 0.2);
      ambient.pause();
    } catch {}
  }

  return activeDuckSnapshot;
}

/**
 * Restores Quran recitation & ambient audio volume and resumes playback after Adhan finishes or is stopped.
 */
export function restoreAfterAdhan(): boolean {
  if (!activeDuckSnapshot) return false;
  const snap = activeDuckSnapshot;
  activeDuckSnapshot = null;

  const quran = getQuranAudio();
  const ambient = getAmbientAudio();

  try {
    quran.volume = snap.quranVolume;
  } catch {}
  try {
    ambient.volume = snap.ambientVolume;
  } catch {}

  if (snap.quranWasPlaying && quran.src) {
    deliberatePauseByUser = false;
    quran.play().catch(() => {});
  }
  if (snap.ambientWasPlaying && ambient.src) {
    ambient.play().catch(() => {});
  }

  return snap.quranWasPlaying || snap.ambientWasPlaying;
}

export function isBackgroundAudioDuckedForAdhan(): boolean {
  return Boolean(
    activeDuckSnapshot &&
      (activeDuckSnapshot.quranWasPlaying || activeDuckSnapshot.ambientWasPlaying)
  );
}

let isAudioUnlocked = false;

/**
 * Unlocks HTMLAudioElement playback on mobile Safari, iOS, and Android Chrome
 * by playing and immediately pausing a silent snippet within a user interaction.
 */
export function unlockAudio() {
  if (isAudioUnlocked) return;
  isAudioUnlocked = true;
  const quranAudio = getQuranAudio();
  const ambientAudio = getAmbientAudio();
  const adhanAudio = getAdhanAudio();
  const silentWav =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  for (const el of [quranAudio, ambientAudio, adhanAudio]) {
    if (el.paused && !el.src) {
      el.src = silentWav;
      el.play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.src = '';
        })
        .catch(() => {});
    }
  }
}

// Auto-bind unlock on the first user interaction
if (typeof window !== 'undefined') {
  const handleInteraction = () => {
    unlockAudio();
    ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'].forEach((evt) => {
      window.removeEventListener(evt, handleInteraction, { capture: true });
    });
  };
  ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, handleInteraction, { capture: true, passive: true });
  });
}

/**
 * Updates the Media Session API with high-resolution artwork (96, 256, 512),
 * track details, lock-screen scrubber position, and playback state.
 */
export function syncMediaSession(options: {
  metadata?: TrackMetadata | null;
  isPlaying: boolean;
  position?: number;
  duration?: number;
  playbackRate?: number;
}) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

  const { metadata, isPlaying, position = 0, duration = 0, playbackRate = 1.0 } = options;

  if (metadata) {
    const artwork: MediaImage[] = [];
    for (const url of metadata.artworkUrls) {
      if (!url) continue;
      const fullUrl =
        url.startsWith('http') || url.startsWith('blob:')
          ? url
          : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;

      artwork.push(
        { src: fullUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: fullUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: fullUrl, sizes: '512x512', type: 'image/jpeg' }
      );
    }

    // Always include app PWA high-res fallbacks
    artwork.push(
      { src: `${window.location.origin}/pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${window.location.origin}/pwa-512x512.png`, sizes: '512x512', type: 'image/png' }
    );

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album || 'The Noble Quran • القرآن الكريم',
        artwork,
      });
    } catch (e) {
      console.warn('Failed to assign MediaSession metadata:', e);
    }
  }

  try {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  } catch {}

  // Lock-screen scrubber position
  if (navigator.mediaSession.setPositionState && duration && duration > 0 && !isNaN(duration)) {
    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: playbackRate || 1.0,
        position: Math.min(Math.max(0, position), duration),
      });
    } catch {}
  }
}
