/**
 * Production Feature Flags & Staged Rollout Controller (Phase 5)
 *
 * Allows enabling/disabling each Production Fix Pack subsystem independently
 * with staged rollout (admin -> 10% -> 100%) and instant runtime kill-switches
 * stored in localStorage (`nooraya_feature_flags_v1`) without requiring a redeploy.
 */

export const APP_BUILD_VERSION = '2025.05.18-prod-fix-pack-v1';
export const ADMIN_EMAIL = 'ibrahimfaruqolamilekan4@gmail.com';

export interface FeatureFlagsState {
  /** Phase 0C: Persistent IndexedDB production diagnostics & /diag telemetry */
  productionDiagLogger: boolean;
  /** Phase 1: Synchronous MediaSession lock-screen resume & stream recovery engine */
  newAudioResumeEngine: boolean;
  /** Phase 2: Portrait/Landscape smart HD rendition selector & compositor-isolated video */
  hdPortraitVideoEngine: boolean;
  /** Phase 3: 4-layer opaque Medina Emerald backdrop & non-bleed Now Playing screen */
  opaqueBackdropStack: boolean;
  /** Phase 4: Real Muezzin Adhan scheduler, wake-catchup & push notification engine */
  scheduledAdhanEngine: boolean;
}

export interface FeatureFlagMetadata {
  key: keyof FeatureFlagsState;
  label: string;
  phase: string;
  description: string;
  rolloutPercentage: number;
  defaultEnabled: boolean;
  rollbackPlan: string;
}

export const FEATURE_FLAG_CATALOG: FeatureFlagMetadata[] = [
  {
    key: 'productionDiagLogger',
    label: 'Production Diagnostics Logger (/diag)',
    phase: 'Phase 0C',
    description:
      'Records timestamped audio events, readyState/networkState, play() promise outcomes, MediaSession actions, visibility/freeze gaps, SW audio fetch statuses, and pause/src stack traces into IndexedDB.',
    rolloutPercentage: 100,
    defaultEnabled: true,
    rollbackPlan:
      'Toggle off `productionDiagLogger` in /diag or revert PR #0 (`phase-0-evidence-diag`). Logger is non-blocking and fails open.',
  },
  {
    key: 'newAudioResumeEngine',
    label: 'Synchronous Lock-Screen Audio Resume Engine',
    phase: 'Phase 1',
    description:
      'Fixes lock-screen pause/resume desync, synchronous MediaSession play/pause handlers, automatic stream recovery on readyState===0, and synchronizes ambient audio pause with Quran pause.',
    rolloutPercentage: 100,
    defaultEnabled: true,
    rollbackPlan:
      'Toggle off `newAudioResumeEngine` in /diag or revert PR #1 (`phase-1-background-playback-resume`) to restore legacy play/pause handlers.',
  },
  {
    key: 'hdPortraitVideoEngine',
    label: 'Smart HD Portrait/Landscape Video & Compositor Engine',
    phase: 'Phase 2',
    description:
      'Serves sharp 720p/1080p renditions to portrait & retina phones instead of forcing 480p landscape (eliminating 4.3x upscale blur), removes GPU-heavy CSS filters/blurs on <video>, and steps down only on measured dropped frames.',
    rolloutPercentage: 100,
    defaultEnabled: true,
    rollbackPlan:
      'Toggle off `hdPortraitVideoEngine` in /diag or revert PR #2 (`phase-2-hd-portrait-video-smoothness`) to fall back to legacy 480p mobile selection.',
  },
  {
    key: 'opaqueBackdropStack',
    label: '4-Layer Opaque Medina Emerald Backdrop Stack',
    phase: 'Phase 3',
    description:
      'Enforces solid #06150F/#F4EFE6 base layer, full-bleed video/poster/gradient layer, WCAG AA contrast scrim, and a 100% opaque Now Playing overlay so underlying lists never bleed through.',
    rolloutPercentage: 100,
    defaultEnabled: true,
    rollbackPlan:
      'Toggle off `opaqueBackdropStack` in /diag or revert PR #3 (`phase-3-opaque-backdrop-stack`).',
  },
  {
    key: 'scheduledAdhanEngine',
    label: 'Verified Real-Voice Adhan & Push Notification Engine',
    phase: 'Phase 4',
    description:
      'Plays full-length Madinah & Alafasy MP3 recordings with preload, Web Push fallback when closed, and 10-second real-device verification harness.',
    rolloutPercentage: 100,
    defaultEnabled: true,
    rollbackPlan:
      'Toggle off `scheduledAdhanEngine` in /diag or revert PR #4 (`phase-4-5-adhan-prod-safety`).',
  },
];

const STORAGE_KEY = 'nooraya_feature_flags_v1';
const DEVICE_BUCKET_KEY = 'nooraya_rollout_bucket_v1';

const DEFAULT_FLAGS: FeatureFlagsState = {
  productionDiagLogger: true,
  newAudioResumeEngine: true,
  hdPortraitVideoEngine: true,
  opaqueBackdropStack: true,
  scheduledAdhanEngine: true,
};

/**
 * Deterministic 0–99 rollout bucket per device for staged 10% -> 100% rollouts.
 */
export function getDeviceRolloutBucket(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const saved = localStorage.getItem(DEVICE_BUCKET_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < 100) return parsed;
    }
    const bucket = Math.floor(Math.random() * 100);
    localStorage.setItem(DEVICE_BUCKET_KEY, String(bucket));
    return bucket;
  } catch {
    return 0;
  }
}

let memoryOverrides: Partial<FeatureFlagsState> = {};

export function getFeatureFlags(userEmail?: string | null): FeatureFlagsState {
  try {
    let overrides: Partial<FeatureFlagsState> = { ...memoryOverrides };
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        overrides = { ...overrides, ...JSON.parse(raw) };
      }
    }
    const isAdminUser =
      Boolean(userEmail && userEmail.toLowerCase() === ADMIN_EMAIL);
    const bucket = getDeviceRolloutBucket();

    const resolved: FeatureFlagsState = { ...DEFAULT_FLAGS };
    for (const meta of FEATURE_FLAG_CATALOG) {
      const k = meta.key;
      if (typeof overrides[k] === 'boolean') {
        resolved[k] = overrides[k] as boolean;
      } else if (isAdminUser) {
        resolved[k] = true;
      } else {
        resolved[k] = meta.defaultEnabled && bucket < meta.rolloutPercentage;
      }
    }
    return resolved;
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

export function isFeatureEnabled(
  key: keyof FeatureFlagsState,
  userEmail?: string | null
): boolean {
  return getFeatureFlags(userEmail)[key];
}

export function setFeatureFlagOverride(
  key: keyof FeatureFlagsState,
  enabled: boolean
): FeatureFlagsState {
  memoryOverrides[key] = enabled;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const overrides: Partial<FeatureFlagsState> = raw ? JSON.parse(raw) : {};
      overrides[key] = enabled;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      window.dispatchEvent(
        new CustomEvent('nooraya-feature-flags-changed', { detail: overrides })
      );
    } catch {}
  }
  return getFeatureFlags();
}

export function resetFeatureFlagOverrides(): FeatureFlagsState {
  memoryOverrides = {};
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('nooraya-feature-flags-changed'));
    } catch {}
  }
  return getFeatureFlags();
}

