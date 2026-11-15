import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getFeatureFlags,
  setFeatureFlagOverride,
  resetFeatureFlagOverrides,
  isFeatureEnabled,
  APP_BUILD_VERSION,
} from '../featureFlags';
import {
  recordDiagEvent,
  getDiagEvents,
  clearDiagEvents,
  instrumentAudioElement,
} from '../prodDiagnostics';
import {
  getQuranAudio,
  markDeliberateUserPause,
  isDeliberatelyPausedByUser,
  setLastCanonicalStreamUrl,
  getLastCanonicalStreamUrl,
  resumeQuranPlaybackSync,
} from '../persistentAudio';
import {
  selectAdaptiveVideoUrl,
  computeVideoQualityMetrics,
  reportVideoPerformanceDegradation,
  resetVideoQualityStepDown,
} from '../backgrounds';
import { computeCropAndDimensions } from '../browserVideoTranscoder';
import { hydrateAdhanVoiceUrls } from '../adhanAudio';
import type { CustomVideo } from '../../types';

describe('Production Fix Pack — Phases 0 to 5 Verification Suite', () => {
  beforeEach(async () => {
    resetFeatureFlagOverrides();
    resetVideoQualityStepDown();
    await clearDiagEvents();
  });

  it('Phase 0B: static Decisive Control Test page exists with zero React and MediaSession handlers', () => {
    const filePath = path.resolve(process.cwd(), 'public/control-audio-test.html');
    expect(fs.existsSync(filePath)).toBe(true);
    const html = fs.readFileSync(filePath, 'utf8');
    expect(html).toContain('<audio id="controlAudio"');
    expect(html).toContain("navigator.mediaSession.setActionHandler('play'");
    expect(html).toContain("navigator.mediaSession.setActionHandler('pause'");
    expect(html).toContain('FREEZE_GAP_DETECTED');
  });

  it('Phase 0C & Phase 5: feature flags support instant runtime kill-switches and diagnostics logging', () => {
    expect(APP_BUILD_VERSION).toBeTruthy();
    expect(isFeatureEnabled('newAudioResumeEngine')).toBe(true);
    expect(isFeatureEnabled('hdPortraitVideoEngine')).toBe(true);
    expect(isFeatureEnabled('opaqueBackdropStack')).toBe(true);

    setFeatureFlagOverride('hdPortraitVideoEngine', false);
    expect(isFeatureEnabled('hdPortraitVideoEngine')).toBe(false);

    resetFeatureFlagOverrides();
    expect(getFeatureFlags().hdPortraitVideoEngine).toBe(true);

    const ev = recordDiagEvent({
      category: 'media_session',
      event: 'TEST_LOCK_SCREEN_RESUME',
      elementId: 'quran',
      readyState: 4,
      networkState: 1,
    });
    expect(ev).not.toBeNull();
    expect(getDiagEvents()[0]?.event).toBe('TEST_LOCK_SCREEN_RESUME');
  });

  it('Phase 0C: instrumentAudioElement logs pause() and src changes with stack traces', () => {
    const quran = getQuranAudio();
    instrumentAudioElement(quran, 'quran');

    quran.src = 'https://server8.mp3quran.net/afs/001.mp3';
    quran.pause();

    const events = getDiagEvents();
    const hasPauseCall = events.some(
      (e) => e.category === 'pause_call' && e.elementId === 'quran' && Boolean(e.stack)
    );
    expect(hasPauseCall).toBe(true);
  });

  it('Phase 1A: tracks deliberate user/lock-screen pause and recovers stream synchronously when readyState === 0', async () => {
    markDeliberateUserPause(true);
    expect(isDeliberatelyPausedByUser()).toBe(true);

    setLastCanonicalStreamUrl('https://server8.mp3quran.net/afs/002.mp3');
    expect(getLastCanonicalStreamUrl()).toBe('https://server8.mp3quran.net/afs/002.mp3');

    const quran = getQuranAudio();
    // Simulate browser evicting stream after prolonged lock-screen pause (readyState = 0)
    Object.defineProperty(quran, 'readyState', { value: 0, configurable: true });
    await resumeQuranPlaybackSync({
      fallbackUrls: ['https://server8.mp3quran.net/afs/002.mp3'],
      resumePositionSec: 42.5,
    });

    expect(isDeliberatelyPausedByUser()).toBe(false);
    expect(quran.src).toContain('002.mp3');
  });

  it('Phase 2A & 2B: smart rendition selector serves HD 720p/1080p by default and steps down to 480p only on degradation', () => {
    const sampleVideo: CustomVideo = {
      id: 'bg_test_1',
      name: 'Medina Palm Grove',
      videoUrl: 'https://cdn.example.com/palm_720p.mp4',
      videoUrl720p: 'https://cdn.example.com/palm_720p.mp4',
      videoUrl480p: 'https://cdn.example.com/palm_480p.mp4',
      renditions: [
        {
          resolution: '720p-portrait',
          url: 'https://cdn.example.com/palm_720p_portrait.mp4',
          width: 720,
          height: 1280,
        },
        {
          resolution: '720p',
          url: 'https://cdn.example.com/palm_720p.mp4',
          width: 1280,
          height: 720,
        },
        {
          resolution: '480p',
          url: 'https://cdn.example.com/palm_480p.mp4',
          width: 854,
          height: 480,
        },
      ],
    };

    // By default, hdPortraitVideoEngine does NOT force 480p on mobile
    const defaultPicked = selectAdaptiveVideoUrl(sampleVideo);
    expect(defaultPicked).not.toBe('https://cdn.example.com/palm_480p.mp4');

    // After measured dropped-frame degradation, it steps down to 480p
    reportVideoPerformanceDegradation('dropped_frames_test');
    const degradedPicked = selectAdaptiveVideoUrl(sampleVideo);
    expect(degradedPicked).toBe('https://cdn.example.com/palm_480p.mp4');
  });

  it('Phase 2B: computeCropAndDimensions crops 16:9 landscape to 9:16 portrait around focusX so phone upscale stays <= 1.5x', () => {
    // 1920x1080 landscape source cropped to 720x1280 portrait around focusX = 0.25 (left subject)
    const cropLeft = computeCropAndDimensions(1920, 1080, 1280, 'portrait', 0.25, 0.5);
    expect(cropLeft.outW).toBe(608);
    expect(cropLeft.outH).toBe(1080);
    expect(cropLeft.sx).toBeGreaterThan(0);

    // Measure effective upscale of a 1080x1920 portrait video on a 390x844 @3x (1170x2532) phone
    const fakePortraitVideo = {
      videoWidth: 1080,
      videoHeight: 1920,
      currentSrc: 'https://cdn.example.com/scene_1080p_portrait.mp4',
      getVideoPlaybackQuality: () => ({ totalVideoFrames: 300, droppedVideoFrames: 1 }),
    } as unknown as HTMLVideoElement;

    const metrics = computeVideoQualityMetrics(fakePortraitVideo, '1080p-portrait');
    expect(metrics).not.toBeNull();
    expect(metrics!.effectiveUpscaleFactor).toBeLessThanOrEqual(1.5);
  });

  it('Phase 3: NowPlayingOverlay, QuranicPremiumBackground, and PlayerContext contain zero mojibake UTF-8 strings and enforce opaque #06150F base', () => {
    const filesToCheck = [
      'src/components/NowPlayingOverlay.tsx',
      'src/components/QuranicPremiumBackground.tsx',
      'src/context/PlayerContext.tsx',
    ];
    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      expect(content).not.toContain('â€¢');
      expect(content).not.toContain('Ã˜');
      expect(content).not.toContain('Ù‚');
    }

    const overlayContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/NowPlayingOverlay.tsx'),
      'utf8'
    );
    expect(overlayContent).toContain('bg-[#06150F]');
    expect(overlayContent).toContain('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
  });

  it('Phase 4: hydrateAdhanVoiceUrls ensures every Muezzin voice has a valid real MP3 URL and Fajr URL', () => {
    const hydrated = hydrateAdhanVoiceUrls([
      {
        id: 'nabawi-isam-bukhari',
        muezzin_name_en: 'Sheikh Isam bin Husain Bukhari',
        muezzin_name_ar: 'الشيخ عصام بن حسين بخاري',
        title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
        mosque_en: "Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)",
        audio_url: null,
        fajr_audio_url: null,
        duration_seconds: null,
        fajr_duration_seconds: null,
        license_status: 'upload_when_licensed',
        is_active: true,
        is_premium: false,
      },
    ]);
    expect(hydrated[0].audio_url).toBe('/audio/adhan/madinah-standard.mp3');
    expect(hydrated[0].fajr_audio_url).toBe('/audio/adhan/madinah-fajr-bukhari.mp3');
  });
});

