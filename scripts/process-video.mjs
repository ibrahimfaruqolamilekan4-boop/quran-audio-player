#!/usr/bin/env node
/**
 * Nooraya Video Processor
 * 
 * Transforms large source videos (e.g. 130 MB - 500 MB+) into phone-ready,
 * bandwidth-efficient renditions (720p, 480p, poster) for Supabase Storage.
 * 
 * GUARANTEE: Never modifies, overwrites, moves, or deletes source files.
 * Source integrity is verified via pre- and post-processing SHA-256 checksums.
 * 
 * Standards applied:
 * - Format: MP4 container
 * - Video Codec: H.264 Main Profile, yuv420p pixel format
 * - Audio: Stripped (-an) to save mobile data & memory
 * - Framerate: Constant 30 fps (720p) / 24 fps (480p)
 * - Bitrate: Max 2.2-2.5 Mbps (720p) / 1.0-1.2 Mbps (480p)
 * - GOP / Keyframes: Keyframe every 1s (-g 30/-g 24, sc_threshold 0) for instantaneous looping
 * - Faststart: Enabled (-movflags +faststart) for immediate web playback before full download
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';

// ANSI terminal colors for high-contrast CLI output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function findFFmpeg() {
  // 1. Try PATH
  const check = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (check.status === 0) return 'ffmpeg';

  // 2. Common Windows paths
  if (process.platform === 'win32') {
    const commonWinPaths = [
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\WinGet\\Links\\ffmpeg.exe'),
      'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
    ];
    for (const p of commonWinPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  // 3. Common Mac paths
  if (process.platform === 'darwin') {
    const commonMacPaths = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
    for (const p of commonMacPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  return null;
}

function printInstallInstructions() {
  console.error(`\n${colors.red}${colors.bold}Error: FFmpeg is not installed or not found in PATH.${colors.reset}\n`);
  console.error(`${colors.cyan}Please install FFmpeg to run the high-performance local video processor:${colors.reset}\n`);

  if (process.platform === 'win32') {
    console.error(`  ${colors.bold}Windows (Winget - Recommended):${colors.reset}`);
    console.error(`    ${colors.green}winget install Gyan.FFmpeg${colors.reset}`);
    console.error(`    (After install, restart your terminal or PowerShell)\n`);
    console.error(`  ${colors.bold}Windows (Manual):${colors.reset}`);
    console.error(`    Download from https://www.gyan.dev/ffmpeg/builds/ and add ffmpeg/bin to PATH.\n`);
  } else if (process.platform === 'darwin') {
    console.error(`  ${colors.bold}macOS (Homebrew):${colors.reset}`);
    console.error(`    ${colors.green}brew install ffmpeg${colors.reset}\n`);
  } else {
    console.error(`  ${colors.bold}Linux (apt / yum):${colors.reset}`);
    console.error(`    ${colors.green}sudo apt update && sudo apt install -y ffmpeg${colors.reset}\n`);
  }
}

async function runFFmpegCommand(ffmpegBin, args, label) {
  process.stdout.write(`  ${colors.cyan}Processing ${label}...${colors.reset} `);
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) {
        process.stdout.write(`${colors.green}Done.${colors.reset}\n`);
        resolve(true);
      } else {
        process.stdout.write(`${colors.red}Failed!${colors.reset}\n`);
        reject(new Error(`FFmpeg failed with exit code ${code}:\n${stderr.slice(-500)}`));
      }
    });
    proc.on('error', reject);
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    console.log(`
${colors.bold}${colors.green}=== Nooraya Ambient Video Processor ===${colors.reset}
Transforms source background videos into phone-ready renditions for Supabase Storage.

${colors.bold}Usage:${colors.reset}
  npm run process-video -- <input-video> [options]

${colors.bold}Options:${colors.reset}
  --name <title>         Custom display title (e.g. "Serene Fireplace")
  --category <cat>       Category: fireplace, rain, ocean, forest, cosmos, night (default auto)
  --start <seconds>      Trim start time in seconds (e.g. --start 10)
  --duration <seconds>   Trim duration in seconds (e.g. --duration 30)
  --focus-x <0..1>       Horizontal focal point for 9:16 portrait crop (default 0.5 center)
  --out-dir <path>       Custom output folder (defaults to ./processed/<slug>_<timestamp>)

${colors.bold}Guarantees:${colors.reset}
  Strict read-only access to source file. Original files are NEVER modified or deleted.
`);
    process.exit(0);
  }

  let inputPath = null;
  let customName = null;
  let category = null;
  let trimStart = null;
  let trimDuration = null;
  let focusX = 0.5;
  let outDirOverride = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--name' && rawArgs[i + 1]) {
      customName = rawArgs[++i];
    } else if (arg === '--category' && rawArgs[i + 1]) {
      category = rawArgs[++i].toLowerCase();
    } else if (arg === '--start' && rawArgs[i + 1]) {
      trimStart = parseFloat(rawArgs[++i]);
    } else if (arg === '--duration' && rawArgs[i + 1]) {
      trimDuration = parseFloat(rawArgs[++i]);
    } else if (arg === '--focus-x' && rawArgs[i + 1]) {
      focusX = Math.min(1, Math.max(0, parseFloat(rawArgs[++i]) || 0.5));
    } else if (arg === '--out-dir' && rawArgs[i + 1]) {
      outDirOverride = rawArgs[++i];
    } else if (!arg.startsWith('-') && !inputPath) {
      inputPath = arg;
    }
  }

  if (!inputPath) {
    console.error(`${colors.red}Error: Please provide a source video file path.${colors.reset}`);
    process.exit(1);
  }

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`${colors.red}Error: Input file does not exist: ${resolvedInput}${colors.reset}`);
    process.exit(1);
  }

  try {
    fs.accessSync(resolvedInput, fs.constants.R_OK);
  } catch {
    console.error(`${colors.red}Error: Cannot read input file. Check file permissions.${colors.reset}`);
    process.exit(1);
  }

  const ffmpegBin = findFFmpeg();
  if (!ffmpegBin) {
    printInstallInstructions();
    process.exit(1);
  }

  console.log(`\n${colors.bold}${colors.green}=== Starting Nooraya HD Portrait + Landscape Video Processing ===${colors.reset}`);
  console.log(`  Source File: ${colors.bold}${resolvedInput}${colors.reset}`);

  const originalStat = fs.statSync(resolvedInput);
  console.log(`  Source Size: ${colors.yellow}${formatBytes(originalStat.size)}${colors.reset}`);

  process.stdout.write(`  ${colors.cyan}Calculating source SHA-256 checksum...${colors.reset} `);
  const preChecksum = await computeSha256(resolvedInput);
  process.stdout.write(`${colors.green}${preChecksum.slice(0, 16)}...${colors.reset}\n`);

  const fileBasename = path.basename(resolvedInput, path.extname(resolvedInput));
  const title = (customName || fileBasename).trim();
  const safeSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) || 'ambient';

  if (!category) {
    const lower = fileBasename.toLowerCase();
    if (lower.includes('fire') || lower.includes('flame')) category = 'fireplace';
    else if (lower.includes('rain') || lower.includes('waterfall')) category = 'rain';
    else if (lower.includes('ocean') || lower.includes('sea') || lower.includes('wave')) category = 'ocean';
    else if (lower.includes('forest') || lower.includes('tree') || lower.includes('nature')) category = 'forest';
    else if (lower.includes('star') || lower.includes('space') || lower.includes('cosmos')) category = 'cosmos';
    else if (lower.includes('night') || lower.includes('moon')) category = 'night';
    else category = 'nature';
  }

  const timestamp = Date.now();
  const outDir = outDirOverride
    ? path.resolve(process.cwd(), outDirOverride)
    : path.resolve(process.cwd(), 'processed', `${safeSlug}_${timestamp}`);

  fs.mkdirSync(outDir, { recursive: true });
  console.log(`  Output Folder: ${colors.bold}${outDir}${colors.reset}\n`);

  const startTime = Date.now();
  const trimArgs = [];
  if (trimStart !== null && !isNaN(trimStart) && trimStart > 0) {
    trimArgs.push('-ss', String(trimStart));
  }
  if (trimDuration !== null && !isNaN(trimDuration) && trimDuration > 0) {
    trimArgs.push('-t', String(trimDuration));
  }

  // Task 1: Generate Crisp Poster Thumbnail
  const posterPath = path.join(outDir, 'poster.jpg');
  await runFFmpegCommand(
    ffmpegBin,
    [
      '-y',
      ...(trimStart ? ['-ss', String(trimStart)] : ['-ss', '00:00:01']),
      '-i', resolvedInput,
      '-vframes', '1',
      '-vf', "scale='min(1280,iw)':-2:flags=lanczos",
      '-q:v', '2',
      posterPath,
    ],
    'Poster Thumbnail'
  );

  // Common H.264 High@L4.1 encoding profile (yuv420p, 30fps, 2s keyframe, CRF 21, no audio, faststart)
  const buildVideoArgs = ({ vf, outFile, profile, level, crf, maxrate, bufsize, fps }) => [
    '-y',
    ...trimArgs,
    '-i', resolvedInput,
    '-vf', vf,
    '-c:v', 'libx264',
    '-profile:v', profile,
    '-level:v', level,
    '-pix_fmt', 'yuv420p',
    '-an',
    '-r', String(fps),
    '-crf', String(crf),
    '-maxrate', maxrate,
    '-bufsize', bufsize,
    '-g', String(fps * 2),
    '-keyint_min', String(fps * 2),
    '-sc_threshold', '0',
    '-movflags', '+faststart',
    outFile,
  ];

  // Portrait 9:16 crop filter centered on admin focusX (0..1) when source is wider than 9:16
  const portraitFilter = (w, h) =>
    `crop='min(iw,ih*9/16)':'ih':'(iw-min(iw,ih*9/16))*${focusX}':0,scale=${w}:${h}:flags=lanczos`;

  const out720pPortrait = path.join(outDir, '720p-portrait.mp4');
  await runFFmpegCommand(
    ffmpegBin,
    buildVideoArgs({
      vf: portraitFilter(720, 1280),
      outFile: out720pPortrait,
      profile: 'high',
      level: '4.1',
      crf: 21,
      maxrate: '3500k',
      bufsize: '7000k',
      fps: 30,
    }),
    'Portrait 720x1280 (Mobile High@L4.1, CRF 21, faststart)'
  );

  const out1080pPortrait = path.join(outDir, '1080p-portrait.mp4');
  await runFFmpegCommand(
    ffmpegBin,
    buildVideoArgs({
      vf: portraitFilter(1080, 1920),
      outFile: out1080pPortrait,
      profile: 'high',
      level: '4.1',
      crf: 20,
      maxrate: '5500k',
      bufsize: '11000k',
      fps: 30,
    }),
    'Portrait 1080x1920 (Retina Wi-Fi High@L4.1, CRF 20, faststart)'
  );

  const out720pLandscape = path.join(outDir, '720p.mp4');
  await runFFmpegCommand(
    ffmpegBin,
    buildVideoArgs({
      vf: "scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720",
      outFile: out720pLandscape,
      profile: 'high',
      level: '4.1',
      crf: 21,
      maxrate: '3500k',
      bufsize: '7000k',
      fps: 30,
    }),
    'Landscape 1280x720 (Desktop/Tablet High@L4.1, CRF 21, faststart)'
  );

  const out480pFallback = path.join(outDir, '480p.mp4');
  await runFFmpegCommand(
    ffmpegBin,
    buildVideoArgs({
      vf: "scale=854:480:force_original_aspect_ratio=increase:flags=lanczos,crop=854:480",
      outFile: out480pFallback,
      profile: 'main',
      level: '4.0',
      crf: 23,
      maxrate: '1400k',
      bufsize: '2800k',
      fps: 24,
    }),
    '480p Economy Fallback (Main@L4.0, Save-Data/Degraded)'
  );

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const postChecksum = await computeSha256(resolvedInput);
  if (preChecksum !== postChecksum) {
    console.error(`\n${colors.red}${colors.bold}CRITICAL SAFETY ALERT: Source file checksum mismatch!${colors.reset}`);
    process.exit(1);
  }

  const statPoster = fs.statSync(posterPath);
  const stat720pPortrait = fs.statSync(out720pPortrait);
  const stat1080pPortrait = fs.statSync(out1080pPortrait);
  const stat720p = fs.statSync(out720pLandscape);
  const stat480p = fs.statSync(out480pFallback);

  const manifest = {
    name: title,
    category,
    focusX,
    source: {
      originalFilename: path.basename(resolvedInput),
      originalSizeBytes: originalStat.size,
      sha256: postChecksum,
      immutabilityConfirmed: true,
    },
    renditions: [
      { resolution: '1080p-portrait', filename: '1080p-portrait.mp4', width: 1080, height: 1920, sizeBytes: stat1080pPortrait.size, fps: 30 },
      { resolution: '720p-portrait', filename: '720p-portrait.mp4', width: 720, height: 1280, sizeBytes: stat720pPortrait.size, fps: 30 },
      { resolution: '720p', filename: '720p.mp4', width: 1280, height: 720, sizeBytes: stat720p.size, fps: 30 },
      { resolution: '480p', filename: '480p.mp4', width: 854, height: 480, sizeBytes: stat480p.size, fps: 24 },
    ],
    poster: { filename: 'poster.jpg', sizeBytes: statPoster.size },
    durationSeconds: trimDuration || null,
    generatedAt: new Date().toISOString(),
    processingTimeSeconds: parseFloat(elapsedSec),
  };

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n${colors.bold}${colors.green}=== Processing Complete in ${elapsedSec}s ===${colors.reset}`);
  console.log(`  1080p Portrait: ${formatBytes(stat1080pPortrait.size)}`);
  console.log(`  720p Portrait : ${formatBytes(stat720pPortrait.size)}`);
  console.log(`  720p Landscape: ${formatBytes(stat720p.size)}`);
  console.log(`  480p Fallback : ${formatBytes(stat480p.size)}`);
}

main().catch((err) => {
  console.error(`\n${colors.red}${colors.bold}Fatal Error:${colors.reset}`, err?.message || err);
  process.exit(1);
});

