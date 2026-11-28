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
let lastBackgroundedAtMs = 0;
let lastPausedAtMs = 0;
let lastCheckpointSaveMs = 0;

export const PLAYBACK_CHECKPOINT_KEY = 'nooraya:playbackCheckpoint:v1';

export interface PlaybackCheckpoint {
  surahId: number;
  reciterId: string;
  positionSec: number;
  streamUrl: string;
  playMode?: 'surah' | 'ayah';
  ayah?: number | null;
  updatedAt: number;
}

export function savePlaybackCheckpoint(checkpoint: Omit<PlaybackCheckpoint, 'updatedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PlaybackCheckpoint = {
      ...checkpoint,
      positionSec: Number((checkpoint.positionSec || 0).toFixed(2)),
      updatedAt: Date.now(),
    };
    localStorage.setItem(PLAYBACK_CHECKPOINT_KEY, JSON.stringify(payload));
    if (payload.streamUrl) {
      setLastCanonicalStreamUrl(payload.streamUrl);
    }
    if (payload.positionSec > 0) {
      lastKnownPositionSec = payload.positionSec;
    }
  } catch {}
}

export function loadPlaybackCheckpoint(): PlaybackCheckpoint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PLAYBACK_CHECKPOINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlaybackCheckpoint;
    if (!parsed || typeof parsed.surahId !== 'number' || !parsed.reciterId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function markDeliberateUserPause(isDeliberate: boolean): void {
  deliberatePauseByUser = isDeliberate;
  if (isDeliberate) {
    lastPausedAtMs = Date.now();
  } else {
    lastPausedAtMs = 0;
  }
}

export function isDeliberatelyPausedByUser(): boolean {
  return deliberatePauseByUser;
}

export function getPausedDurationMs(): number {
  return lastPausedAtMs > 0 ? Math.max(0, Date.now() - lastPausedAtMs) : 0;
}

export function markPageBackgrounded(ts = Date.now()): void {
  lastBackgroundedAtMs = ts;
}

export function clearPageBackgrounded(): void {
  lastBackgroundedAtMs = 0;
}

export function getLastBackgroundedAtMs(): number {
  return lastBackgroundedAtMs;
}

export function wasRecentlyBackgrounded(windowMs = 1000): boolean {
  return lastBackgroundedAtMs > 0 && Date.now() - lastBackgroundedAtMs <= windowMs;
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

function attachToPersistentDomHost(el: HTMLAudioElement, role: 'quran' | 'ambient' | 'adhan'): void {
  if (typeof document === 'undefined' || !el || typeof (el as any).setAttribute !== 'function') {
    return;
  }
  try {
    el.setAttribute('data-nooraya-audio', role);
    el.setAttribute('aria-hidden', 'true');
    if (role === 'quran') {
      el.setAttribute('x-webkit-airplay', 'allow');
    }
    const mount = () => {
      if (!document.body) return;
      let host = document.getElementById('nooraya-persistent-audio-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'nooraya-persistent-audio-host';
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText =
          'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
        document.body.appendChild(host);
      }
      if (el.parentNode !== host) {
        host.appendChild(el);
      }
    };
    if (document.body) {
      mount();
    } else {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    }
  } catch {
    // Fallback cleanly in non-DOM test environments
  }
}

function createSafeAudioElement(): HTMLAudioElement {
  if (typeof Audio !== 'undefined') {
    const el = new Audio();
    if (el && typeof el.play === 'function') {
      return el;
    }
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const el = document.createElement('audio');
    if (el && typeof el.play === 'function') {
      return el;
    }
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
    removeAttribute() {},
    getAttribute() { return null; },
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
    attachToPersistentDomHost(quranAudioInstance, 'quran');

    quranAudioInstance.addEventListener('pause', () => {
      if (!lastPausedAtMs) {
        lastPausedAtMs = Date.now();
      }
      if (quranAudioInstance && quranAudioInstance.currentTime > 0) {
        lastKnownPositionSec = quranAudioInstance.currentTime;
      }
    });

    quranAudioInstance.addEventListener('playing', () => {
      lastPausedAtMs = 0;
    });

    quranAudioInstance.addEventListener('timeupdate', () => {
      if (quranAudioInstance && quranAudioInstance.currentTime > 0) {
        lastKnownPositionSec = quranAudioInstance.currentTime;
        const now = Date.now();
        if (now - lastCheckpointSaveMs >= 3000) {
          lastCheckpointSaveMs = now;
          const existing = loadPlaybackCheckpoint();
          if (existing) {
            savePlaybackCheckpoint({
              ...existing,
              positionSec: quranAudioInstance.currentTime,
              streamUrl:
                lastCanonicalStreamUrl ||
                quranAudioInstance.currentSrc ||
                quranAudioInstance.src ||
                existing.streamUrl,
            });
          }
        }
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
    attachToPersistentDomHost(ambientAudioInstance, 'ambient');
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
    attachToPersistentDomHost(adhanAudioInstance, 'adhan');
    instrumentAudioElement(adhanAudioInstance, 'adhan');
  }
  return adhanAudioInstance;
}

function reloadAudioSourceAtPosition(
  audio: HTMLAudioElement,
  recoveryUrl: string,
  targetPos: number
): void {
  // Always assign src and call load() so iOS WebKit/Safari clears any MediaError
  // and re-opens closed HTTP Range sockets even when recoveryUrl matches audio.src.
  audio.src = recoveryUrl;
  try {
    audio.load();
  } catch {}
  if (targetPos > 0) {
    const restorePos = () => {
      try {
        if (Math.abs((audio.currentTime || 0) - targetPos) > 1) {
          audio.currentTime = targetPos;
        }
      } catch {}
    };
    audio.addEventListener('loadedmetadata', restorePos, { once: true });
    audio.addEventListener('canplay', restorePos, { once: true });
  }
}

/**
 * Synchronously resumes the singleton Quran `<audio>` element inside a MediaSession
 * or UI gesture with ZERO `await` before `audio.play()`.
 *
 * If the browser evicted the media buffer or closed the HTTP socket while paused
 * on the lock screen (`readyState === 0`, `networkState === 3`, `error !== null`,
 * `blob:` revoked, or paused >12s with low buffer), it synchronously reloads the
 * canonical HTTPS stream URL and restores `currentTime` before calling `audio.play()`.
 * If `audio.play()` rejects on a stale socket, it retries once with a fresh source reload.
 */
export function resumeQuranPlaybackSync(options?: {
  fallbackUrls?: string[];
  resumePositionSec?: number;
  forceReload?: boolean;
}): Promise<void> {
  const audio = getQuranAudio();
  const pausedForMs = getPausedDurationMs();
  deliberatePauseByUser = false;
  lastPausedAtMs = 0;

  const checkpoint = loadPlaybackCheckpoint();
  const targetPos =
    options?.resumePositionSec !== undefined && options.resumePositionSec > 0
      ? options.resumePositionSec
      : audio.currentTime > 0
      ? audio.currentTime
      : lastKnownPositionSec > 0
      ? lastKnownPositionSec
      : checkpoint?.positionSec || 0;

  const currentSrc = audio.src || '';
  const isBrokenBlob =
    currentSrc.startsWith('blob:') &&
    (audio.readyState === 0 || Boolean(audio.error) || pausedForMs > 10000);
  // HTMLMediaElement.NETWORK_NO_SOURCE === 3
  const isSocketStaleAfterPause =
    pausedForMs >= 12000 && (audio.readyState < 3 || audio.networkState === 3);

  const needsReload =
    Boolean(options?.forceReload) ||
    !currentSrc ||
    Boolean(audio.error) ||
    audio.readyState === 0 ||
    audio.networkState === 3 ||
    isBrokenBlob ||
    isSocketStaleAfterPause;

  const recoveryUrl =
    lastCanonicalStreamUrl ||
    options?.fallbackUrls?.find((u) => u && !u.startsWith('blob:')) ||
    checkpoint?.streamUrl ||
    options?.fallbackUrls?.[0] ||
    currentSrc;

  if (needsReload && recoveryUrl) {
    recordDiagEvent({
      category: 'media_session',
      event: 'SYNC_STREAM_RECOVERY_BEFORE_PLAY',
      elementId: 'quran',
      src: recoveryUrl,
      readyState: audio.readyState,
      networkState: audio.networkState,
      errorCode: audio.error ? audio.error.code : null,
      currentTime: targetPos,
      details: {
        pausedForMs,
        forceReload: Boolean(options?.forceReload),
      },
    });
    reloadAudioSourceAtPosition(audio, recoveryUrl, targetPos);
  }

  const playPromise = audio.play();
  if (!playPromise || typeof playPromise.catch !== 'function') {
    return Promise.resolve();
  }

  return playPromise.catch((firstErr) => {
    // If initial play() rejected and we have a canonical stream URL, reload source once and retry
    if (!recoveryUrl) {
      throw firstErr;
    }
    recordDiagEvent({
      category: 'media_session',
      event: 'RESUME_PLAY_REJECTED_RETRY_RELOAD',
      elementId: 'quran',
      src: recoveryUrl,
      readyState: audio.readyState,
      networkState: audio.networkState,
      errorCode: audio.error ? audio.error.code : null,
      errorMessage: `${firstErr?.name || 'Error'}: ${firstErr?.message || String(firstErr)}`,
      currentTime: targetPos,
    });
    reloadAudioSourceAtPosition(audio, recoveryUrl, targetPos);
    return audio.play();
  });
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
  const silentWav =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  // Only gently prime the primary Quran audio element if nothing is loaded yet.
  // Avoid concurrently calling play()/pause()/load() on sibling elements (ambient/adhan)
  // which can disrupt iOS WebKit AVAudioSession ownership during initial Play tap.
  if (quranAudio.paused && !quranAudio.getAttribute('src') && !quranAudio.src) {
    quranAudio.src = silentWav;
    quranAudio
      .play()
      .then(() => {
        if (quranAudio.src === silentWav || quranAudio.src.startsWith('data:audio/wav')) {
          quranAudio.pause();
          quranAudio.currentTime = 0;
          quranAudio.removeAttribute('src');
        }
      })
      .catch(() => {
        if (quranAudio.src === silentWav || quranAudio.src.startsWith('data:audio/wav')) {
          quranAudio.removeAttribute('src');
        }
      });
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
