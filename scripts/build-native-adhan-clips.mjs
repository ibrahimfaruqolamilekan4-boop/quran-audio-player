#!/usr/bin/env node
/**
 * Builds & syncs authentic <=28-second notification sound clips directly from
 * `/public/audio/adhan/*.mp3` into:
 *  - `public/audio/adhan/clips/*-28s.wav` (Web / PWA / Native sync source)
 *  - `android/app/src/main/res/raw/*.wav` (Android NotificationChannel raw resources, lowercase_underscores)
 *  - `ios/App/App/Sounds/*.wav` (iOS UNNotificationSound bundle resources, strictly < 30.0s Linear PCM)
 *
 * ZERO synthetic audio is ever generated. Requires `ffmpeg` on PATH.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'public', 'audio', 'adhan');
const CLIPS_DIR = path.join(SRC_DIR, 'clips');
const ANDROID_RAW_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'raw');
const IOS_SOUNDS_DIR = path.join(ROOT, 'ios', 'App', 'App', 'Sounds');

fs.mkdirSync(CLIPS_DIR, { recursive: true });

const mp3Files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => f.toLowerCase().endsWith('.mp3'))
  .sort();

if (mp3Files.length === 0) {
  console.error('No source Adhan MP3 files found in public/audio/adhan/.');
  process.exit(1);
}

for (const file of mp3Files) {
  const base = file.replace(/\.mp3$/i, '');
  const srcPath = path.join(SRC_DIR, file);
  const outWebWav = path.join(CLIPS_DIR, `${base}-28s.wav`);
  const nativeSafeName = `${base.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_28s.wav`;

  // Trim strictly to 28.0s (<30s iOS UNNotificationSound limit), 16-bit Linear PCM mono 22.05kHz
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      srcPath,
      '-t',
      '28',
      '-ac',
      '1',
      '-ar',
      '22050',
      '-af',
      'afade=t=in:st=0:d=0.25,afade=t=out:st=26.5:d=1.5',
      '-c:a',
      'pcm_s16le',
      outWebWav,
      '-loglevel',
      'error',
    ],
    { stdio: 'inherit' }
  );

  // If Capacitor Android project exists, copy into res/raw/
  if (fs.existsSync(path.join(ROOT, 'android', 'app', 'src', 'main'))) {
    fs.mkdirSync(ANDROID_RAW_DIR, { recursive: true });
    fs.copyFileSync(outWebWav, path.join(ANDROID_RAW_DIR, nativeSafeName));
  }

  // If Capacitor iOS project exists, copy into App/Sounds/
  if (fs.existsSync(path.join(ROOT, 'ios', 'App', 'App'))) {
    fs.mkdirSync(IOS_SOUNDS_DIR, { recursive: true });
    fs.copyFileSync(outWebWav, path.join(IOS_SOUNDS_DIR, nativeSafeName));
  }

  console.log(`Built real 28s Adhan clip: ${path.basename(outWebWav)} -> ${nativeSafeName}`);
}
