/**
 * Background playback guard for the Quran player.
 *
 * Coordinates foreground/background transitions, prevents fighting deliberate user pauses,
 * and maintains MediaSession state synchronization.
 */

import { recordDiagnosticEvent } from './diagnostics';

type TrackedEntry = { wasPlaying: boolean };

const tracked = new Map<HTMLAudioElement, TrackedEntry>();

export function markUserPaused(paused: boolean) {
  if (typeof window !== 'undefined') {
    (window as any).__noorayaUserPaused = paused;
    if (paused) {
      tracked.forEach((entry) => {
        entry.wasPlaying = false;
      });
    }
  }
}

function track(el: HTMLAudioElement, entry: TrackedEntry) {
  if (tracked.has(el)) return;
  tracked.set(el, entry);

  el.addEventListener('playing', () => {
    entry.wasPlaying = true;
    (window as any).__noorayaUserPaused = false;
    recordDiagnosticEvent('audio', 'guard:playing', { src: el.src ? el.src.slice(0, 100) : '' });
  });

  el.addEventListener('play', () => {
    entry.wasPlaying = true;
    (window as any).__noorayaUserPaused = false;
  });

  el.addEventListener('ended', () => {
    entry.wasPlaying = false;
    recordDiagnosticEvent('audio', 'guard:ended');
  });

  el.addEventListener('pause', () => {
    // If user explicitly triggered pause or if visible, update wasPlaying to false
    if ((window as any).__noorayaUserPaused || document.visibilityState === 'visible') {
      entry.wasPlaying = false;
      recordDiagnosticEvent('audio', 'guard:user_pause');
    } else {
      recordDiagnosticEvent('audio', 'guard:background_os_pause');
    }
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

    // Never auto-resume if the user intentionally paused!
    if ((window as any).__noorayaUserPaused) return;

    const toResume: HTMLAudioElement[] = [];
    tracked.forEach((entry, el) => {
      if (entry.wasPlaying && el.paused && (el.src || el.currentSrc)) {
        toResume.push(el);
      }
    });
    if (toResume.length === 0) return;

    recordDiagnosticEvent('audio', 'guard:auto_resuming_interrupted_tracks', { count: toResume.length });

    toResume.forEach((el) => {
      el.play().catch((err) => {
        recordDiagnosticEvent('audio', 'guard:auto_resume_failed', { message: err?.message });
      });
    });

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'playing';
      } catch {}
    }
  };

  window.addEventListener('visibilitychange', resumeSuspended);
  window.addEventListener('pageshow', resumeSuspended);
  window.addEventListener('focus', resumeSuspended);
}

export {};
