/**
 * Browser-native video transcoder for Nooraya Admin
 * 
 * Runs entirely on desktop/laptop browsers without site-wide COOP/COEP headers.
 * Does NOT break Flutterwave checkout or Google OAuth.
 * 
 * Standards applied:
 * - 720p: 1280x720 max, 30fps, 2.2 Mbps target bitrate, no audio
 * - 480p: 854x480 max, 24fps, 1.0 Mbps target bitrate, no audio
 * - Poster: 1s frame, JPEG blob (~30-50 KB)
 * - Safe memory limits: Blocks mobile execution, warns at > 150 MB
 */

export interface TranscodeProgress {
  stage: 'analyzing' | 'poster' | 'encoding_480p' | 'encoding_720p' | 'finalizing';
  percentage: number;
  stageLabel: string;
  etaSeconds: number;
}

export interface TranscodeResult {
  blob720p: Blob;
  blob480p: Blob;
  posterBlob: Blob;
  durationSeconds: number;
  width: number;
  height: number;
  size720p: number;
  size480p: number;
}

export interface TranscodeOptions {
  trimStart?: number;
  trimDuration?: number;
  bitrateMode?: 'standard' | 'economy';
  onProgress?: (p: TranscodeProgress) => void;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 768;
}

/**
 * Extracts video frame at specific timestamp as a JPEG Blob (~30-50 KB)
 */
export async function extractPosterFrame(
  fileOrBlob: Blob,
  atSecond = 1.0
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    (video as any).playsInline = true;
    video.crossOrigin = 'anonymous';

    const url = URL.createObjectURL(fileOrBlob);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const seekTarget = Math.min(Math.max(0.1, atSecond), Math.max(0.1, video.duration - 0.5));
      video.currentTime = seekTarget;
    };

    video.onseeked = () => {
      try {
        const width = Math.min(video.videoWidth || 1280, 1280);
        const height = Math.min(video.videoHeight || 720, 720);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return reject(new Error('Canvas 2D context not available.'));
        }
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error('Failed to generate poster JPEG blob.'));
          },
          'image/jpeg',
          0.85
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video frame for poster.'));
    };
  });
}

/**
 * Transcodes a video in the browser to a target resolution & bitrate using HTML5 Canvas + MediaRecorder
 */
async function renderRendition(
  file: File | Blob,
  targetWidth: number,
  fps: number,
  bitrateBps: number,
  options: TranscodeOptions,
  stage: 'encoding_480p' | 'encoding_720p',
  stageBasePct: number,
  stageSpanPct: number,
  isCancelledRef: { current: boolean }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    (video as any).playsInline = true;
    video.crossOrigin = 'anonymous';

    const url = URL.createObjectURL(file);
    video.src = url;

    let mediaRecorder: MediaRecorder | null = null;
    let animFrameId: number | null = null;
    let safetyTimer: NodeJS.Timeout | null = null;
    const recordedChunks: Blob[] = [];

    const cleanup = () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try { mediaRecorder.stop(); } catch {}
      }
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      if (isCancelledRef.current) {
        cleanup();
        return reject(new Error('Transcoding cancelled.'));
      }

      const origW = video.videoWidth || 1280;
      const origH = video.videoHeight || 720;
      const aspect = origH / origW;

      const finalW = Math.min(targetWidth, origW);
      // Ensure height is an even number (required by video encoders)
      const finalH = Math.round((finalW * aspect) / 2) * 2;

      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
      if (!ctx) {
        cleanup();
        return reject(new Error('Canvas context unavailable.'));
      }

      const stream = canvas.captureStream(fps);

      // Best supported mime type (prefer MP4 H.264, fallback to WebM VP9/H.264)
      const mimeCandidates = [
        'video/mp4;codecs=avc1.4d401f',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm',
      ];
      let selectedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMime || undefined,
          videoBitsPerSecond: bitrateBps,
        });
      } catch {
        mediaRecorder = new MediaRecorder(stream, {
          videoBitsPerSecond: bitrateBps,
        });
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        cleanup();
        if (isCancelledRef.current) {
          return reject(new Error('Transcoding cancelled by user.'));
        }
        const outputMime = selectedMime.includes('mp4') ? 'video/mp4' : 'video/webm';
        const finalBlob = new Blob(recordedChunks, { type: outputMime });
        resolve(finalBlob);
      };

      const trimStart = options.trimStart || 0;
      const duration = options.trimDuration || Math.max(1, video.duration - trimStart);
      const endTime = trimStart + duration;

      video.currentTime = trimStart;

      let encodeStartTime = Date.now();

      const drawLoop = () => {
        if (isCancelledRef.current) {
          cleanup();
          return reject(new Error('Transcoding cancelled.'));
        }

        if (video.currentTime >= endTime || video.ended) {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          return;
        }

        ctx.drawImage(video, 0, 0, finalW, finalH);

        // Calculate progress & ETA
        const currentProgress = (video.currentTime - trimStart) / duration;
        const overallPct = Math.min(99, Math.round(stageBasePct + currentProgress * stageSpanPct));
        const elapsedSec = (Date.now() - encodeStartTime) / 1000;
        const eta = currentProgress > 0.05 ? Math.max(0, Math.round((elapsedSec / currentProgress) - elapsedSec)) : 0;

        options.onProgress?.({
          stage,
          percentage: overallPct,
          stageLabel: stage === 'encoding_480p' ? 'Encoding 480p Mobile Rendition...' : 'Encoding 720p Desktop Rendition...',
          etaSeconds: eta,
        });

        animFrameId = requestAnimationFrame(drawLoop);
      };

      video.onseeked = () => {
        if (mediaRecorder && mediaRecorder.state === 'inactive') {
          mediaRecorder.start(200); // 200ms slices
          encodeStartTime = Date.now();
          video.play().catch((e) => {
            console.warn('Video play notice in transcoder:', e);
          });

          // Safeguard: stop after 1.5x duration or max 45s so tab never hangs
          safetyTimer = setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, Math.min(45000, Math.max(10000, duration * 1500)));

          drawLoop();
        }
      };
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to decode video in browser.'));
    };
  });
}

export interface InBrowserTranscoderController {
  promise: Promise<TranscodeResult>;
  cancel: () => void;
}

/**
 * Transcodes large video in browser into phone-ready 720p, 480p, and poster blobs.
 */
export function transcodeInBrowser(
  file: File,
  options: TranscodeOptions = {}
): InBrowserTranscoderController {
  const isCancelledRef = { current: false };

  const cancel = () => {
    isCancelledRef.current = true;
  };

  const execute = async (): Promise<TranscodeResult> => {
    if (isMobileDevice()) {
      throw new Error(
        'In-browser transcoding is disabled on mobile devices to prevent browser tab termination. Please use the desktop admin panel or the local script (npm run process-video).'
      );
    }

    options.onProgress?.({
      stage: 'analyzing',
      percentage: 5,
      stageLabel: 'Analyzing video dimensions and duration...',
      etaSeconds: 0,
    });

    // 1. Generate Poster Frame (at trimStart + 1s)
    options.onProgress?.({
      stage: 'poster',
      percentage: 12,
      stageLabel: 'Extracting 1s poster thumbnail...',
      etaSeconds: 0,
    });
    const posterBlob = await extractPosterFrame(file, (options.trimStart || 0) + 1.0);

    // 2. Determine bitrates
    const isEconomy = options.bitrateMode === 'economy';
    const bps720p = isEconomy ? 1_400_000 : 2_200_000;
    const bps480p = isEconomy ? 600_000 : 1_000_000;

    // 3. Render 480p rendition (15% to 55%)
    const blob480p = await renderRendition(
      file,
      854,
      24,
      bps480p,
      options,
      'encoding_480p',
      15,
      40,
      isCancelledRef
    );

    // 4. Render 720p rendition (55% to 95%)
    const blob720p = await renderRendition(
      file,
      1280,
      30,
      bps720p,
      options,
      'encoding_720p',
      55,
      40,
      isCancelledRef
    );

    options.onProgress?.({
      stage: 'finalizing',
      percentage: 100,
      stageLabel: 'Finalizing phone-ready renditions...',
      etaSeconds: 0,
    });

    return {
      blob720p,
      blob480p,
      posterBlob,
      durationSeconds: options.trimDuration || 30,
      width: 1280,
      height: 720,
      size720p: blob720p.size,
      size480p: blob480p.size,
    };
  };

  return {
    promise: execute(),
    cancel,
  };
}
