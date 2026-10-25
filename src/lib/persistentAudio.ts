/**
 * Nooraya Persistent Audio Engine
 * 
 * Provides a persistent singleton HTMLAudioElement instance outside the React
 * component lifecycle to guarantee uninterrupted background playback on iOS Safari,
 * iPadOS, Android Chrome, and mobile PWAs when the screen is locked.
 */

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  artworkUrls: string[];
}

let quranAudioInstance: HTMLAudioElement | null = null;
let ambientAudioInstance: HTMLAudioElement | null = null;

export function getQuranAudio(): HTMLAudioElement {
  if (!quranAudioInstance) {
    quranAudioInstance = new Audio();
    quranAudioInstance.preload = 'auto';
    quranAudioInstance.setAttribute('playsinline', 'true');
    quranAudioInstance.setAttribute('webkit-playsinline', 'true');
    (quranAudioInstance as any).x5Playsinline = true;
  }
  return quranAudioInstance;
}

export function getAmbientAudio(): HTMLAudioElement {
  if (!ambientAudioInstance) {
    ambientAudioInstance = new Audio();
    ambientAudioInstance.loop = true;
    ambientAudioInstance.preload = 'auto';
    ambientAudioInstance.setAttribute('playsinline', 'true');
    ambientAudioInstance.setAttribute('webkit-playsinline', 'true');
    (ambientAudioInstance as any).x5Playsinline = true;
  }
  return ambientAudioInstance;
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
      const fullUrl = url.startsWith('http') || url.startsWith('blob:')
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
