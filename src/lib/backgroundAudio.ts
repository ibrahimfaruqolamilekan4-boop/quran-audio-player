/**
 * Background playback guard for the Quran player.
 *
 * Mobile browsers and the OS (battery savers, hidden-tab freezing, audio-focus
 * loss) pause or suspend page audio the moment the app leaves the foreground.
 * While hidden the page is not allowed to run code, so the only reliable moment
 * to recover playback is the instant it becomes visible again.
 *
 * This module patches the global `Audio` constructor so it can keep a registry
 * of every audio element the player creates (they are detached instances, so
 * they cannot be reached through the DOM). When the page returns to the
 * foreground it resumes anything that was playing before it was suspended and
 * re-asserts the MediaSession playback state so the lock-screen and notification
 * controls stay in sync with what is actually audibly playing.
 */

type TrackedEntry = { wasPlaying: boolean };

const tracked = new Map<HTMLAudioElement, TrackedEntry>();

function track(el: HTMLAudioElement, entry: TrackedEntry) {
  if (tracked.has(el)) return;
  tracked.set(el, entry);

  // `playing` is the trustworthy "audio is really flowing" signal.
  el.addEventListener('playing', () => { entry.wasPlaying = true; });
  el.addEventListener('play', () => { entry.wasPlaying = true; });
  el.addEventListener('ended', () => { entry.wasPlaying = false; });
  el.addEventListener('pause', () => {
    // A pause while the page is hidden is almost always the browser or OS
    // suspending us, not the listener stopping the recitation. Remember the
    // intent to play so we can resume on return instead of fighting the user.
    // When the page is visible a pause is a real, deliberate user action.
    if (document.visibilityState === 'hidden') return;
    entry.wasPlaying = false;
  });
}

if (typeof window !== 'undefined' && !(window as any).__noorayaAudioGuard) {
  (window as any).__noorayaAudioGuard = true;

  const NativeAudio = window.Audio;
  const GuardedAudio = function (this: unknown, src?: string) {
    const el = src === undefined ? new NativeAudio() : new NativeAudio(src);
    track(el, { wasPlaying: false });
    return el;
  } as unknown as typeof Audio;
  GuardedAudio.prototype = NativeAudio.prototype;
  try {
    window.Audio = GuardedAudio;
  } catch {
    /* Some embedded webviews freeze window.Audio; degrade to best effort. */
  }

  const resumeSuspended = () => {
    if (document.visibilityState !== 'visible') return;

    const toResume: HTMLAudioElement[] = [];
    tracked.forEach((entry, el) => {
      if (entry.wasPlaying && el.paused && (el.src || el.currentSrc)) {
        toResume.push(el);
      }
    });
    if (toResume.length === 0) return;

    // Best effort: succeeds while the media session is still valid and is
    // harmlessly rejected (caught below) when a fresh gesture is required.
    toResume.forEach(el => { el.play().catch(() => { /* needs a user gesture */ }); });

    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'playing'; } catch { /* ignore */ }
    }
  };

  window.addEventListener('visibilitychange', resumeSuspended);
  window.addEventListener('pageshow', resumeSuspended);
  window.addEventListener('focus', resumeSuspended);
}

export {};
