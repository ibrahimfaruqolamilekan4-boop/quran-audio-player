/**
 * Phase 1C: Capacitor Native Audio & Notification Bridge
 *
 * Detects whether Nooraya is running inside a native iOS/Android Capacitor shell
 * (`window.Capacitor?.isNativePlatform()`) vs. a Standalone PWA vs. a mobile browser tab.
 *
 * Why this exists:
 * - On iOS Safari / Standalone PWA, WebKit suspends the WebContent process ~3–5 minutes
 *   after the user pauses audio from the lock screen, releasing `AVAudioSession` and
 *   removing the lock-screen Now Playing widget.
 * - Inside the Capacitor native wrapper:
 *   - iOS uses native `AVPlayer` + `AVAudioSessionCategoryPlayback` + `MPRemoteCommandCenter`
 *     (`UIBackgroundModes: ["audio"]`), which survives indefinite lock-screen pauses (30m+).
 *   - Android uses a Media3 `MediaSessionService` Foreground Service (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`),
 *     which survives screen lock and task switching indefinitely.
 */

export type RuntimePlatformMode =
  | 'capacitor-ios'
  | 'capacitor-android'
  | 'pwa-ios'
  | 'pwa-android'
  | 'browser-ios'
  | 'browser-android'
  | 'desktop';

export function detectRuntimePlatform(): RuntimePlatformMode {
  if (typeof window === 'undefined') return 'desktop';

  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    const p = cap.getPlatform?.() || '';
    if (p === 'ios') return 'capacitor-ios';
    if (p === 'android') return 'capacitor-android';
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    (window.navigator as any)?.standalone === true;

  if (isIOS) return isStandalone ? 'pwa-ios' : 'browser-ios';
  if (isAndroid) return isStandalone ? 'pwa-android' : 'browser-android';
  return 'desktop';
}

export function isNativeCapacitorApp(): boolean {
  const mode = detectRuntimePlatform();
  return mode === 'capacitor-ios' || mode === 'capacitor-android';
}
