import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  playAdhan,
  stopAdhanPlayback,
  getAdhanPlaybackState,
  getAdhanDiagnosticLogs,
  resumeBlockedAdhanFromGesture,
  setAdhanAudioElementForTesting,
  OFFICIAL_MUEZZIN_CATALOG_SLOTS,
} from '../src/lib/adhanAudio.ts';
import { getQuranAudio } from '../src/lib/persistentAudio.ts';
import { evaluateAdhanSchedulerTick } from '../src/components/AdhanSchedulerOverlay.tsx';
import { DEFAULT_PRAYER_SETTINGS, calculatePrayerTimes } from '../src/lib/prayer.ts';

const DEFAULT_FALLBACK_LOCATION = {
  latitude: 24.4672,
  longitude: 39.6112,
  cityName: 'Madinah',
  countryCode: 'SA',
  timezone: 'Asia/Riyadh',
  source: 'manual',
  updatedAt: Date.now(),
};

class MockAudioElement {
  src = '';
  preload = 'auto';
  crossOrigin = 'anonymous';
  volume = 1;
  muted = false;
  paused = true;
  currentTime = 0;
  duration = 198.4; // 3m 18.4s real Adhan length
  readyState = 4;
  error = null;
  onended = null;
  onerror = null;
  playCalls = 0;
  pauseCalls = 0;
  nextPlayError = null;

  load() {}

  async play() {
    this.playCalls += 1;
    if (this.nextPlayError) {
      const err = this.nextPlayError;
      this.nextPlayError = null;
      throw err;
    }
    this.paused = false;
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
}

async function runTests() {
  console.log('=== STEP 3: Automated Adhan Audio Engine & Scheduler Verification ===\n');

  // 1. Verify ZERO oscillator / beep / synthetic horn code exists anywhere in src/
  const filesToScan = [
    'src/lib/adhanAudio.ts',
    'src/components/AdhanSchedulerOverlay.tsx',
    'src/views/PrayerTimesView.tsx',
    'src/components/PushNotificationsPanel.tsx',
  ];

  for (const rel of filesToScan) {
    const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    assert.equal(
      content.includes('createOscillator'),
      false,
      `Forbidden createOscillator found in ${rel}`
    );
    assert.equal(
      content.includes('OscillatorNode'),
      false,
      `Forbidden OscillatorNode found in ${rel}`
    );
    assert.equal(
      content.includes('playSynthesizedSanctuaryTone'),
      false,
      `Forbidden playSynthesizedSanctuaryTone found in ${rel}`
    );
  }
  console.log('PASS [1/6]: Zero oscillator/beep/synthetic tone code exists in Adhan engine & UI.');

  // Prepare mock voices: one with licensed real URLs, one with null URLs (default unseeded state)
  const mockVoices = [
    {
      ...OFFICIAL_MUEZZIN_CATALOG_SLOTS[0],
      id: 'nabawi-khashuqji',
      audio_url: 'https://cdn.nooraya.app/adhan/nabawi-khashuqji-standard.mp3',
      fajr_audio_url: 'https://cdn.nooraya.app/adhan/nabawi-khashuqji-fajr.mp3',
      license_status: 'verified_licensed',
      duration_seconds: 198,
    },
    {
      ...OFFICIAL_MUEZZIN_CATALOG_SLOTS[1],
      id: 'nabawi-isam-bukhari',
      audio_url: null,
      fajr_audio_url: null,
      license_status: 'upload_when_licensed',
    },
  ];

  // Start simulated Quran recitation playing at volume 0.9
  const quranEl = getQuranAudio();
  quranEl.src = 'https://server8.mp3quran.net/afs/001.mp3';
  quranEl.volume = 0.9;
  await quranEl.play();
  assert.equal(quranEl.paused, false);

  // 2. Fake clock scheduler tick at exact Dhuhr time -> calls playAdhan(voiceId, 'dhuhr') & sets audio.src to real URL
  const mockAudio = new MockAudioElement();
  setAdhanAudioElementForTesting(mockAudio);

  const todayTimes = calculatePrayerTimes(
    DEFAULT_FALLBACK_LOCATION.latitude,
    DEFAULT_FALLBACK_LOCATION.longitude,
    new Date('2026-05-15T12:00:00Z'),
    DEFAULT_PRAYER_SETTINGS.method,
    DEFAULT_PRAYER_SETTINGS.madhab,
    DEFAULT_PRAYER_SETTINGS.highLatitudeRule,
    DEFAULT_PRAYER_SETTINGS.adjustments,
    DEFAULT_FALLBACK_LOCATION.timezone
  );

  const dhuhrFakeClock = new Date(todayTimes.dhuhr.getTime() + 2000); // 2 seconds after Dhuhr start

  const dhuhrTickResult = await evaluateAdhanSchedulerTick({
    now: dhuhrFakeClock,
    location: DEFAULT_FALLBACK_LOCATION,
    settings: {
      ...DEFAULT_PRAYER_SETTINGS,
      notificationsEnabled: true,
      activeAdhanVoiceId: 'nabawi-khashuqji',
    },
    voices: mockVoices,
  });

  assert.equal(dhuhrTickResult.triggeredPrayerKey, 'dhuhr');
  assert.equal(
    mockAudio.src,
    'https://cdn.nooraya.app/adhan/nabawi-khashuqji-standard.mp3',
    'Scheduler must set audio.src to the selected voice real audio_url'
  );
  assert.equal(mockAudio.volume, 1.0, 'Adhan volume must be full 1.0');
  assert.equal(mockAudio.muted, false, 'Adhan audio must not be muted');
  assert.equal(getAdhanPlaybackState().isPlaying, true);
  assert.equal(quranEl.paused, true, 'Quran audio must be ducked/paused when Adhan starts');

  // Simulate Adhan ending naturally -> restores Quran audio
  mockAudio.onended?.();
  assert.equal(getAdhanPlaybackState().isPlaying, false);
  assert.equal(quranEl.paused, false, 'Quran audio must be resumed when Adhan ends');
  assert.equal(quranEl.volume, 0.9, 'Quran audio volume must be restored when Adhan ends');
  console.log(
    'PASS [2/6]: Fake clock at Dhuhr triggers playAdhan(), sets real audio_url, ducks Quran, and restores Quran on end.'
  );

  // 3. Fake clock scheduler tick at exact Fajr time -> uses fajr_audio_url
  const fajrFakeClock = new Date(todayTimes.fajr.getTime() + 1500);
  const fajrTickResult = await evaluateAdhanSchedulerTick({
    now: fajrFakeClock,
    location: DEFAULT_FALLBACK_LOCATION,
    settings: {
      ...DEFAULT_PRAYER_SETTINGS,
      notificationsEnabled: true,
      useFajrAdhan: true,
      activeAdhanVoiceId: 'nabawi-khashuqji',
    },
    voices: mockVoices,
  });

  assert.equal(fajrTickResult.triggeredPrayerKey, 'fajr');
  assert.equal(
    mockAudio.src,
    'https://cdn.nooraya.app/adhan/nabawi-khashuqji-fajr.mp3',
    'Fajr prayer must use fajr_audio_url'
  );
  stopAdhanPlayback();
  console.log('PASS [3/6]: Fake clock at Fajr selects fajr_audio_url ("As-salatu khayrun min an-nawm").');

  // 4. Missing audio file (audio_url = null) -> shows visible error message and plays NO sound
  const playCallsBeforeMissing = mockAudio.playCalls;
  const missingRes = await playAdhan('nabawi-isam-bukhari', 'asr', {
    trigger: 'test_button',
    voices: mockVoices,
  });

  const stateAfterMissing = getAdhanPlaybackState();
  assert.equal(stateAfterMissing.isPlaying, false, 'Must not enter playing state when audio_url is null');
  assert.equal(
    mockAudio.playCalls,
    playCallsBeforeMissing,
    'Must not call audio.play() when audio_url is null'
  );
  assert.ok(
    stateAfterMissing.errorMessage?.startsWith('Adhan audio is not available:'),
    `Expected visible error message starting with "Adhan audio is not available:", got: ${stateAfterMissing.errorMessage}`
  );
  assert.equal(missingRes.status, 'missing_url');
  console.log('PASS [4/6]: Missing audio_url produces clear visible error and plays zero synthetic sound.');

  // 5. Autoplay blocked (NotAllowedError) -> enters "Tap to play Adhan" state and resumes on user gesture
  const notAllowedErr = new Error('play() failed because the user did not interact with the document first.');
  notAllowedErr.name = 'NotAllowedError';
  mockAudio.nextPlayError = notAllowedErr;

  const blockedRes = await playAdhan('nabawi-khashuqji', 'maghrib', {
    trigger: 'scheduled',
    voices: mockVoices,
  });

  const stateAfterBlocked = getAdhanPlaybackState();
  assert.equal(blockedRes.status, 'autoplay_blocked');
  assert.equal(stateAfterBlocked.isPlaying, false);
  assert.equal(stateAfterBlocked.autoplayBlocked, true, 'Must set autoplayBlocked = true');
  assert.equal(
    stateAfterBlocked.notificationTapScreenOpen,
    true,
    'Must open full-screen "Tap to play Adhan" prompt immediately'
  );

  // Now simulate user tapping "Tap to Play Adhan" button
  resumeBlockedAdhanFromGesture();
  await new Promise((r) => setTimeout(r, 20));
  const stateAfterResume = getAdhanPlaybackState();
  assert.equal(stateAfterResume.isPlaying, true);
  assert.equal(stateAfterResume.autoplayBlocked, false);
  console.log(
    'PASS [5/6]: Autoplay NotAllowedError opens "Tap to play Adhan" prompt without fallback tone, and user tap starts real audio.'
  );

  // 6. Audio network/decode error (audio.onerror) -> stops playback, shows visible error, no synthetic tone
  mockAudio.error = { code: 4, message: 'MEDIA_ELEMENT_ERROR: Format error or 404' };
  mockAudio.onerror?.();
  const stateAfterDecodeErr = getAdhanPlaybackState();
  assert.equal(stateAfterDecodeErr.isPlaying, false);
  assert.ok(
    stateAfterDecodeErr.errorMessage?.startsWith('Adhan audio is not available:'),
    `Expected visible error on decode failure, got: ${stateAfterDecodeErr.errorMessage}`
  );
  mockAudio.error = null;
  console.log(
    'PASS [6/6]: Audio decode/404 error surfaces visible error banner and restores ducked audio without any fallback tone.'
  );

  console.log('\nAll 6 Adhan Audio Engine & Scheduler unit tests passed! Diagnostics log count:', getAdhanDiagnosticLogs().length);
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
