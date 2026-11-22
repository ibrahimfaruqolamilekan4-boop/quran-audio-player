/**
 * Nooraya Persistent Production Diagnostics Engine
 * 
 * Captures timestamped audio lifecycle, visibility, freeze gaps, media session events,
 * and SW fetch outcomes in IndexedDB ('NoorayaDiagnostics'). Viewable at /diag.
 */

import localforage from 'localforage';

export interface DiagnosticEvent {
  id: string;
  timestamp: number;
  timeIso: string;
  category: 'audio' | 'mediasession' | 'lifecycle' | 'network' | 'error' | 'freeze';
  name: string;
  details?: Record<string, any>;
  stackTrace?: string;
}

const diagStore = localforage.createInstance({
  name: 'NoorayaDiagnostics',
  storeName: 'events_v1',
});

const MAX_STORED_EVENTS = 1000;
let memoryBuffer: DiagnosticEvent[] = [];
let hasFlushed = false;

// Generate short random ID
function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Logs an event into memory and periodically flushes to IndexedDB
 */
export function recordDiagnosticEvent(
  category: DiagnosticEvent['category'],
  name: string,
  details?: Record<string, any>,
  captureStack = false
) {
  const now = Date.now();
  const event: DiagnosticEvent = {
    id: uid(),
    timestamp: now,
    timeIso: new Date(now).toISOString(),
    category,
    name,
    details,
    stackTrace: captureStack ? new Error().stack : undefined,
  };

  memoryBuffer.push(event);
  if (memoryBuffer.length > MAX_STORED_EVENTS) {
    memoryBuffer.shift();
  }

  // Debounced persist
  if (!hasFlushed) {
    hasFlushed = true;
    setTimeout(persistBuffer, 1500);
  }
}

async function persistBuffer() {
  hasFlushed = false;
  try {
    const existing = (await diagStore.getItem<DiagnosticEvent[]>('recent_events')) || [];
    const merged = [...existing, ...memoryBuffer].slice(-MAX_STORED_EVENTS);
    memoryBuffer = [];
    await diagStore.setItem('recent_events', merged);
  } catch (err) {
    console.warn('[Diagnostics] Failed to persist buffer:', err);
  }
}

/**
 * Instrument an HTMLAudioElement with full state tracking
 */
export function instrumentAudioElement(audio: HTMLAudioElement, label: string) {
  const events = ['play', 'playing', 'pause', 'waiting', 'stalled', 'ended', 'suspend', 'emptied', 'canplay', 'error'];

  events.forEach((ev) => {
    audio.addEventListener(ev, () => {
      const err = audio.error;
      recordDiagnosticEvent('audio', `${label}:${ev}`, {
        currentTime: audio.currentTime,
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState,
        paused: audio.paused,
        src: audio.src ? audio.src.slice(0, 120) : '',
        error: err ? { code: err.code, message: err.message } : undefined,
      }, ev === 'pause');
    });
  });
}

/**
 * Tracks browser freezing / execution suspension via timer drift detection
 */
if (typeof window !== 'undefined') {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const drift = now - lastTick;
    lastTick = now;

    // A drift over 2.5s on a 1.0s interval proves JS execution was suspended
    if (drift > 2500) {
      recordDiagnosticEvent('freeze', 'JS_EXECUTION_FROZEN', {
        frozenDurationMs: drift - 1000,
        frozenDurationSec: ((drift - 1000) / 1000).toFixed(1),
        visibilityState: document.visibilityState,
      });
    }
  }, 1000);

  // Lifecycle listeners
  document.addEventListener('visibilitychange', () => {
    recordDiagnosticEvent('lifecycle', `visibility:${document.visibilityState}`, {
      hidden: document.hidden,
    });
  });

  window.addEventListener('pagehide', (e) => {
    recordDiagnosticEvent('lifecycle', 'pagehide', { persisted: e.persisted });
  });

  window.addEventListener('pageshow', (e) => {
    recordDiagnosticEvent('lifecycle', 'pageshow', { persisted: e.persisted });
  });

  document.addEventListener('freeze', () => {
    recordDiagnosticEvent('lifecycle', 'document_freeze');
  });

  document.addEventListener('resume', () => {
    recordDiagnosticEvent('lifecycle', 'document_resume');
  });

  // Global uncaught errors
  window.addEventListener('error', (e) => {
    recordDiagnosticEvent('error', 'uncaught_error', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    recordDiagnosticEvent('error', 'unhandled_rejection', {
      reason: e.reason?.message || String(e.reason),
      stack: e.reason?.stack,
    });
  });
}

/**
 * Retrieve recent events for UI presentation
 */
export async function getDiagnosticEvents(): Promise<DiagnosticEvent[]> {
  try {
    const stored = (await diagStore.getItem<DiagnosticEvent[]>('recent_events')) || [];
    return [...stored, ...memoryBuffer];
  } catch {
    return memoryBuffer;
  }
}

/**
 * Clear stored diagnostics
 */
export async function clearDiagnosticEvents(): Promise<void> {
  memoryBuffer = [];
  try {
    await diagStore.removeItem('recent_events');
  } catch {}
}

/**
 * Export diagnostics as JSON string
 */
export async function exportDiagnosticsJson(): Promise<string> {
  const events = await getDiagnosticEvents();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    standalone: typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone),
    eventCount: events.length,
    events,
  }, null, 2);
}
