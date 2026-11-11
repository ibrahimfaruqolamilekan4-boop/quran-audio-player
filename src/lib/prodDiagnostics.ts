/**
 * Nooraya Production Diagnostics & Telemetry Logger (Phase 0C)
 *
 * Persists timestamped events to IndexedDB (`nooraya_prod_diag_v1`) so lock-screen
 * freezes, MediaSession commands, audio readyState/networkState changes, 206 Range
 * verification, video upscale/dropped-frame metrics, and pause()/src stack traces
 * survive page reloads and OS process kills.
 *
 * Viewable at `/diag` with an opt-in "Send to Support" upload to `/api/diag`.
 */

import localforage from 'localforage';
import { APP_BUILD_VERSION, isFeatureEnabled } from './featureFlags';

export type DiagCategory =
  | 'audio_event'
  | 'play_promise'
  | 'pause_call'
  | 'src_change'
  | 'media_session'
  | 'lifecycle'
  | 'freeze_gap'
  | 'sw_audio_fetch'
  | 'video_quality'
  | 'adhan'
  | 'error';

export interface DiagEvent {
  id: string;
  ts: number;
  iso: string;
  category: DiagCategory;
  event: string;
  elementId?: 'quran' | 'ambient' | 'adhan' | 'video' | 'system';
  readyState?: number;
  networkState?: number;
  errorCode?: number | null;
  errorMessage?: string | null;
  currentTime?: number;
  duration?: number;
  paused?: boolean;
  visibilityState?: string;
  src?: string;
  status?: number;
  rangeHeader?: string;
  contentRange?: string;
  stack?: string;
  details?: Record<string, any>;
}

export interface VideoQualitySnapshot {
  ts: number;
  src: string;
  renditionLabel: string;
  videoWidth: number;
  videoHeight: number;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  physicalViewportWidth: number;
  physicalViewportHeight: number;
  visibleSourceWidth: number;
  visibleSourceHeight: number;
  effectiveUpscaleFactor: number;
  totalVideoFrames: number;
  droppedVideoFrames: number;
  droppedFrameRatio: number;
}

const MAX_EVENTS = 600;
const IDB_KEY = 'diag_events_ring_v1';

const diagStore = localforage.createInstance({
  name: 'nooraya_prod_diag_v1',
  storeName: 'diagnostics',
});

let memoryEvents: DiagEvent[] = [];
let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastVideoSnapshot: VideoQualitySnapshot | null = null;
const listeners = new Set<(events: DiagEvent[]) => void>();

function notifyListeners() {
  const snapshot = [...memoryEvents];
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {}
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    diagStore.setItem(IDB_KEY, memoryEvents.slice(0, MAX_EVENTS)).catch(() => {});
  }, 400);
}

export async function initProdDiagnostics(): Promise<DiagEvent[]> {
  if (hydrated) return memoryEvents;
  hydrated = true;
  try {
    const saved = await diagStore.getItem<DiagEvent[]>(IDB_KEY);
    if (Array.isArray(saved) && saved.length > 0) {
      // Merge any early boot events with persisted events
      const combined = [...memoryEvents, ...saved];
      const seen = new Set<string>();
      memoryEvents = combined
        .filter((e) => {
          if (!e || seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        })
        .sort((a, b) => b.ts - a.ts)
        .slice(0, MAX_EVENTS);
      notifyListeners();
    }
  } catch {}
  return memoryEvents;
}

export function captureCompactStack(skipFrames = 2): string {
  try {
    const raw = new Error().stack || '';
    const lines = raw
      .split('\n')
      .slice(skipFrames)
      .map((l) => l.trim())
      .filter((l) => l && !l.includes('prodDiagnostics'))
      .slice(0, 5);
    return lines.join(' <- ');
  } catch {
    return '';
  }
}

export function recordDiagEvent(
  partial: Omit<DiagEvent, 'id' | 'ts' | 'iso' | 'visibilityState'>
): DiagEvent | null {
  if (!isFeatureEnabled('productionDiagLogger')) return null;

  const now = Date.now();
  const entry: DiagEvent = {
    ...partial,
    id: `ev_${now}_${Math.random().toString(36).slice(2, 7)}`,
    ts: now,
    iso: new Date(now).toISOString(),
    visibilityState:
      typeof document !== 'undefined' ? document.visibilityState : 'unknown',
  };

  memoryEvents.unshift(entry);
  if (memoryEvents.length > MAX_EVENTS) {
    memoryEvents.length = MAX_EVENTS;
  }

  scheduleFlush();
  notifyListeners();
  return entry;
}

export function getDiagEvents(): DiagEvent[] {
  return [...memoryEvents];
}

export async function clearDiagEvents(): Promise<void> {
  memoryEvents = [];
  try {
    await diagStore.removeItem(IDB_KEY);
  } catch {}
  notifyListeners();
}

export function subscribeDiagEvents(
  listener: (events: DiagEvent[]) => void
): () => void {
  listeners.add(listener);
  listener([...memoryEvents]);
  return () => {
    listeners.delete(listener);
  };
}

export function setLatestVideoQualitySnapshot(snap: VideoQualitySnapshot) {
  lastVideoSnapshot = snap;
  recordDiagEvent({
    category: 'video_quality',
    event: `VIDEO_METRICS_${snap.renditionLabel}`,
    elementId: 'video',
    src: snap.src,
    details: {
      videoDim: `${snap.videoWidth}x${snap.videoHeight}`,
      cssViewport: `${snap.cssWidth}x${snap.cssHeight} @${snap.dpr}x`,
      physicalViewport: `${snap.physicalViewportWidth}x${snap.physicalViewportHeight}`,
      visibleSourceStrip: `${Math.round(snap.visibleSourceWidth)}x${Math.round(snap.visibleSourceHeight)}`,
      effectiveUpscaleFactor: Number(snap.effectiveUpscaleFactor.toFixed(2)),
      droppedFrames: `${snap.droppedVideoFrames}/${snap.totalVideoFrames}`,
    },
  });
}

export function getLatestVideoQualitySnapshot(): VideoQualitySnapshot | null {
  return lastVideoSnapshot;
}

/**
 * Instruments a singleton HTMLAudioElement (`quran`, `ambient`, or `adhan`) to log:
 * - all media lifecycle events (`play`, `playing`, `pause`, `waiting`, `stalled`, `ended`, `error`)
 * - readyState, networkState, errorCode
 * - play() promise resolution or rejection with error name
 * - every programmatic `pause()` call with a stack trace
 * - every `src` assignment with a stack trace
 */
const instrumentedElements = new WeakSet<HTMLAudioElement>();

export function instrumentAudioElement(
  audio: HTMLAudioElement,
  elementId: 'quran' | 'ambient' | 'adhan'
): void {
  if (!audio || instrumentedElements.has(audio)) {
    return;
  }
  instrumentedElements.add(audio);

  const snapshotAudio = () => ({
    readyState: audio.readyState,
    networkState: audio.networkState,
    errorCode: audio.error ? audio.error.code : null,
    errorMessage: audio.error ? audio.error.message : null,
    currentTime: Number((audio.currentTime || 0).toFixed(2)),
    duration: Number((audio.duration || 0).toFixed(2)),
    paused: audio.paused,
    src: audio.currentSrc || audio.src || '',
  });

  // 1. Lifecycle events
  const mediaEvents = [
    'play',
    'playing',
    'pause',
    'waiting',
    'stalled',
    'ended',
    'error',
    'loadedmetadata',
    'canplay',
  ];

  for (const evName of mediaEvents) {
    audio.addEventListener(evName, () => {
      recordDiagEvent({
        category: evName === 'error' ? 'error' : 'audio_event',
        event: `AUDIO_${evName.toUpperCase()}`,
        elementId,
        ...snapshotAudio(),
      });
    });
  }

  // 2. Wrap `pause()` to capture stack trace of caller
  const origPause = audio.pause.bind(audio);
  audio.pause = function () {
    const stack = captureCompactStack(2);
    recordDiagEvent({
      category: 'pause_call',
      event: `CALL_PAUSE`,
      elementId,
      ...snapshotAudio(),
      stack,
    });
    return origPause();
  };

  // 3. Wrap `play()` to record promise outcome (resolved vs NotAllowedError / AbortError / etc.)
  const origPlay = audio.play.bind(audio);
  audio.play = function () {
    const stack = captureCompactStack(2);
    recordDiagEvent({
      category: 'play_promise',
      event: `CALL_PLAY_START`,
      elementId,
      ...snapshotAudio(),
      stack,
    });
    const p = origPlay();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        recordDiagEvent({
          category: 'play_promise',
          event: `PLAY_PROMISE_RESOLVED`,
          elementId,
          ...snapshotAudio(),
        });
      }).catch((err: any) => {
        recordDiagEvent({
          category: 'play_promise',
          event: `PLAY_PROMISE_REJECTED`,
          elementId,
          ...snapshotAudio(),
          errorMessage: `${err?.name || 'Error'}: ${err?.message || String(err)}`,
          stack,
        });
      });
    }
    return p;
  };

  // 4. Intercept `src` property setter to log stack traces whenever `audio.src` changes
  try {
    const proto = Object.getPrototypeOf(audio);
    const desc =
      Object.getOwnPropertyDescriptor(proto, 'src') ||
      Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (desc && desc.get && desc.set) {
      Object.defineProperty(audio, 'src', {
        configurable: true,
        enumerable: true,
        get() {
          return desc.get!.call(this);
        },
        set(newVal: string) {
          const prev = desc.get!.call(this);
          const stack = captureCompactStack(2);
          recordDiagEvent({
            category: 'src_change',
            event: `SET_AUDIO_SRC`,
            elementId,
            src: newVal,
            details: { previousSrc: prev },
            stack,
          });
          desc.set!.call(this, newVal);
        },
      });
    }
  } catch {}
}

/**
 * Probes an audio URL with a `Range: bytes=0-1023` header to verify HTTP 206 Partial Content
 * support and confirm whether the Service Worker intercepted it.
 */
export async function probeAudioRangeSupport(url: string): Promise<{
  url: string;
  status: number;
  is206: boolean;
  acceptRanges: string | null;
  contentRange: string | null;
  contentType: string | null;
  fromServiceWorker: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      cache: 'no-store',
    });
    const status = res.status;
    const acceptRanges = res.headers.get('accept-ranges');
    const contentRange = res.headers.get('content-range');
    const contentType = res.headers.get('content-type');
    const viaSw = res.headers.get('x-nooraya-sw') === '1';

    recordDiagEvent({
      category: 'sw_audio_fetch',
      event: status === 206 ? 'AUDIO_RANGE_206_OK' : `AUDIO_RANGE_${status}`,
      elementId: 'system',
      src: url,
      status,
      rangeHeader: 'bytes=0-1023',
      contentRange: contentRange || undefined,
      details: {
        acceptRanges,
        contentType,
        fromServiceWorker: viaSw,
      },
    });

    return {
      url,
      status,
      is206: status === 206,
      acceptRanges,
      contentRange,
      contentType,
      fromServiceWorker: viaSw,
    };
  } catch (err: any) {
    recordDiagEvent({
      category: 'sw_audio_fetch',
      event: 'AUDIO_RANGE_FETCH_ERROR',
      elementId: 'system',
      src: url,
      errorMessage: err?.message || String(err),
    });
    return {
      url,
      status: 0,
      is206: false,
      acceptRanges: null,
      contentRange: null,
      contentType: null,
      fromServiceWorker: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Installs global lifecycle, freeze-gap, Service Worker message, and error listeners once.
 */
let globalsInstalled = false;

export function installGlobalProdDiagnostics(): void {
  if (typeof window === 'undefined' || globalsInstalled) return;
  globalsInstalled = true;

  void initProdDiagnostics();

  recordDiagEvent({
    category: 'lifecycle',
    event: 'APP_BOOT',
    elementId: 'system',
    details: {
      buildVersion: APP_BUILD_VERSION,
      standalone:
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        (window.navigator as any)?.standalone === true,
      userAgent: navigator.userAgent,
      dpr: window.devicePixelRatio || 1,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
  });

  document.addEventListener('visibilitychange', () => {
    recordDiagEvent({
      category: 'lifecycle',
      event: `VISIBILITY_${document.visibilityState.toUpperCase()}`,
      elementId: 'system',
    });
  });

  window.addEventListener('pagehide', (e) => {
    recordDiagEvent({
      category: 'lifecycle',
      event: 'PAGEHIDE',
      elementId: 'system',
      details: { persisted: e.persisted },
    });
  });

  window.addEventListener('pageshow', (e) => {
    recordDiagEvent({
      category: 'lifecycle',
      event: 'PAGESHOW',
      elementId: 'system',
      details: { persisted: e.persisted },
    });
  });

  document.addEventListener('freeze', () => {
    recordDiagEvent({
      category: 'lifecycle',
      event: 'OS_PAGE_FREEZE',
      elementId: 'system',
    });
  });

  document.addEventListener('resume', () => {
    recordDiagEvent({
      category: 'lifecycle',
      event: 'OS_PAGE_RESUME',
      elementId: 'system',
    });
  });

  // Timestamp-gap detector: proves when the mobile OS suspended the JS thread in background
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const gapMs = now - lastTick;
    if (gapMs > 6000) {
      recordDiagEvent({
        category: 'freeze_gap',
        event: 'PROCESS_SUSPEND_GAP',
        elementId: 'system',
        details: {
          suspendedSeconds: Number((gapMs / 1000).toFixed(1)),
          fromIso: new Date(lastTick).toISOString(),
          toIso: new Date(now).toISOString(),
        },
      });
    }
    lastTick = now;
  }, 2000);

  // Listen for Service Worker audio fetch outcomes if posted
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (data && data.type === 'NOORAYA_SW_AUDIO_DIAG') {
        recordDiagEvent({
          category: 'sw_audio_fetch',
          event: data.event || 'SW_AUDIO_FETCH',
          elementId: 'system',
          src: data.url,
          status: data.status,
          rangeHeader: data.rangeHeader,
          contentRange: data.contentRange,
          details: data.details,
        });
      }
    });
  }

  // Global production error tracking (Sentry-compatible breadcrumb & error capture)
  window.addEventListener('error', (event) => {
    recordDiagEvent({
      category: 'error',
      event: 'WINDOW_UNCAUGHT_ERROR',
      elementId: 'system',
      errorMessage: event.message || 'Uncaught window error',
      stack: `${event.filename || ''}:${event.lineno || 0}:${event.colno || 0}`,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    recordDiagEvent({
      category: 'error',
      event: 'UNHANDLED_PROMISE_REJECTION',
      elementId: 'system',
      errorMessage: reason?.message || String(reason),
      stack: typeof reason?.stack === 'string' ? reason.stack.slice(0, 300) : undefined,
    });
  });
}

/**
 * Opt-in "Send to Support" upload to the rate-limited `/api/diag` endpoint.
 */
export async function uploadDiagReportToSupport(note?: string): Promise<{
  ok: boolean;
  reportId?: string;
  error?: string;
}> {
  try {
    const payload = {
      buildVersion: APP_BUILD_VERSION,
      note: note || '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      standalone:
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(display-mode: standalone)')?.matches ||
          (window.navigator as any)?.standalone === true),
      viewport:
        typeof window !== 'undefined'
          ? {
              width: window.innerWidth,
              height: window.innerHeight,
              dpr: window.devicePixelRatio || 1,
            }
          : null,
      videoSnapshot: lastVideoSnapshot,
      events: memoryEvents.slice(0, 250),
    };

    const res = await fetch('/api/diag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error || `Upload failed with status ${res.status}`,
      };
    }
    return {
      ok: true,
      reportId: data?.reportId || `diag_${Date.now()}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Network error while sending diagnostics',
    };
  }
}
