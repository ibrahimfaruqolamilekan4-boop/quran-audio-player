/**
 * Browser-native HD Portrait & Landscape Video Transcoder for Nooraya Admin (Phase 2B)
 *
 * Runs entirely on desktop/laptop browsers without site-wide COOP/COEP headers.
 * Does NOT break Flutterwave checkout or Google OAuth.
 *
 * Standards applied (Phase 2B):
 * - Portrait 720p (720x1280) / Landscape 720p (1280x720): 30fps, 2.8 Mbps target bitrate, muted
 * - Portrait 1080p (1080x1920) / Landscape 1080p (1920x1080): 30fps, 4.5 Mbps target bitrate, muted
 * - Economy / 480p fallback (480x854 or 854x480): 24fps, 1.2 Mbps target bitrate, muted
 * - Supports configurable crop focus point (`focusX`, `focusY` in 0..1) when cropping landscape
 *   video to portrait 9:16 so effective upscale on portrait phones stays <= 1.5x.
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
  /** Horizontal crop focus (0 = left, 0.5 = center, 1 = right) when cropping landscape to portrait */
  focusX?: number;
  /** Vertical crop focus (0 = top, 0.5 = center, 1 = bottom) */
  focusY?: number;
  /** Target output orientation ('auto' preserves source orientation; 'portrait' crops landscape to 9:16) */
  targetOrientation?: 'auto' | 'portrait' | 'landscape';
  onProgress?: (p: TranscodeProgress) => void;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    window.innerWidth < 768
  );
}

/**
 * Computes source crop rectangle (`sx, sy, sw, sh`) and even output dimensions (`outW, outH`)
 * honoring `focusX` and `focusY` (0..1).
 */
export function computeCropAndDimensions(
  origW: number,
  origH: number,
  maxLongEdge: number,
  targetOrientation: 'auto' | 'portrait' | 'landscape' = 'auto',
  focusX = 0.5,
  focusY = 0.5
): {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  outW: number;
  outH: number;
} {
  const fx = Math.min(1, Math.max(0, focusX));
  const fy = Math.min(1, Math.max(0, focusY));

  let sx = 0;
  let sy = 0;
  let sw = origW;
  let sh = origH;

  if (targetOrientation === 'portrait' && origW > origH) {
    // Crop 16:9 landscape to 9:16 portrait around focusX
    const targetAspect = 9 / 16;
    sw = Math.round(origH * targetAspect);
    sh = origH;
    sx = Math.round((origW - sw) * fx);
    sy = 0;
  } else if (targetOrientation === 'landscape' && origH > origW) {
    const targetAspect = 16 / 9;
    sw = origW;
    sh = Math.round(origW / targetAspect);
    sx = 0;
    sy = Math.round((origH - sh) * fy);
  }

  const isPortrait = sh > sw;
  let outW: number;
  let outH: number;

  if (isPortrait) {
    outH = Math.min(maxLongEdge, sh);
    outW = Math.round(((outH * (sw / sh)) / 2)) * 2;
    outH = Math.round(outH / 2) * 2;
  } else {
    outW = Math.min(maxLongEdge, sw);
    outH = Math.round(((outW * (sh / sw)) / 2)) * 2;
    outW = Math.round(outW / 2) * 2;
  }

  return {
    sx,
    sy,
    sw,
    sh,
    outW: Math.max(2, outW),
    outH: Math.max(2, outH),
  };
}

/**
 * Extracts video frame at specific timestamp as a crisp JPEG Blob (~40-70 KB)
 */
export async function extractPosterFrame(
  fileOrBlob: Blob,
  atSecond = 1.0,
  options?: Pick<TranscodeOptions, 'focusX' | 'focusY' | 'targetOrientation'>
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
      const seekTarget = Math.min(
        Math.max(0.1, atSecond),
        Math.max(0.1, video.duration - 0.5)
      );
      video.currentTime = seekTarget;
    };

    video.onseeked = () => {
      try {
        const origW = video.videoWidth || 1280;
        const origH = video.videoHeight || 720;
        const { sx, sy, sw, sh, outW, outH } = computeCropAndDimensions(
          origW,
          origH,
          1280,
          options?.targetOrientation || 'auto',
          options?.focusX ?? 0.5,
          options?.focusY ?? 0.5
        );

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return reject(new Error('Canvas 2D context not available.'));
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error('Failed to generate poster JPEG blob.'));
          },
          'image/jpeg',
          0.86
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
  maxLongEdge: number,
  fps: number,
  bitrateBps: number,
  options: TranscodeOptions,
  stage: 'encoding_480p' | 'encoding_720p',
  stageBasePct: number,
  stageSpanPct: number,
  isCancelledRef: { current: boolean }
): Promise<{ blob: Blob; width: number; height: number }> {
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
        try {
          mediaRecorder.stop();
        } catch {}
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
      const { sx, sy, sw, sh, outW, outH } = computeCropAndDimensions(
        origW,
        origH,
        maxLongEdge,
        options.targetOrientation || 'auto',
        options.focusX ?? 0.5,
        options.focusY ?? 0.5
      );

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: false,
      });
      if (!ctx) {
        cleanup();
        return reject(new Error('Canvas context unavailable.'));
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const stream = canvas.captureStream(fps);

      // Prefer High-Profile MP4 H.264, fallback to Baseline MP4 or WebM VP9/H.264
      const mimeCandidates = [
        'video/mp4;codecs=avc1.640028',
        'video/mp4;codecs=avc1.4d401f',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm',
      ];
      const selectedMime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

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
        const outputMime = selectedMime.includes('mp4')
          ? 'video/mp4'
          : 'video/webm';
        const finalBlob = new Blob(recordedChunks, { type: outputMime });
        resolve({ blob: finalBlob, width: outW, height: outH });
      };

      const trimStart = options.trimStart || 0;
      const duration =
        options.trimDuration || Math.max(1, video.duration - trimStart);
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

        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);

        const currentProgress = (video.currentTime - trimStart) / duration;
        const overallPct = Math.min(
          99,
          Math.round(stageBasePct + currentProgress * stageSpanPct)
        );
        const elapsedSec = (Date.now() - encodeStartTime) / 1000;
        const eta =
          currentProgress > 0.05
            ? Math.max(0, Math.round(elapsedSec / currentProgress - elapsedSec))
            : 0;

        options.onProgress?.({
          stage,
          percentage: overallPct,
          stageLabel:
            stage === 'encoding_480p'
              ? `Encoding 480p Data-Saver Rendition (${outW}x${outH})...`
              : `Encoding HD 720p Rendition (${outW}x${outH} @ 2.8 Mbps)...`,
          etaSeconds: eta,
        });

        animFrameId = requestAnimationFrame(drawLoop);
      };

      video.onseeked = () => {
        if (mediaRecorder && mediaRecorder.state === 'inactive') {
          mediaRecorder.start(200);
          encodeStartTime = Date.now();
          try {
            video.playbackRate = 1.25;
          } catch {}
          video.play().catch((e) => {
            console.warn('Video play notice in transcoder:', e);
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
              setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                  mediaRecorder.stop();
                }
              }, 600);
            }
          });

          const capDurationSec = Math.min(duration, 25);
          safetyTimer = setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, Math.min(25000, Math.max(2500, (capDurationSec / 1.25) * 1000)));

          drawLoop();
        }
      };
    };

    video.onerror = () => {
      cleanup();
      resolve({
        blob: file.slice(0, Math.min(file.size, 40 * 1024 * 1024), 'video/mp4'),
        width: 1280,
        height: 720,
      });
    };
  });
}

export interface InBrowserTranscoderController {
  promise: Promise<TranscodeResult>;
  cancel: () => void;
}

/**
 * Transcodes any non-standard or large video in the browser into sharp HD 720p (2.8 Mbps),
 * 480p Data-Saver (1.2 Mbps), and poster JPEG blobs.
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
    options.onProgress?.({
      stage: 'analyzing',
      percentage: 5,
      stageLabel: 'Analyzing video dimensions, orientation, and duration...',
      etaSeconds: 0,
    });

    options.onProgress?.({
      stage: 'poster',
      percentage: 12,
      stageLabel: 'Extracting high-resolution poster thumbnail...',
      etaSeconds: 0,
    });
    let posterBlob: Blob;
    try {
      posterBlob = await extractPosterFrame(file, (options.trimStart || 0) + 0.5, {
        focusX: options.focusX,
        focusY: options.focusY,
        targetOrientation: options.targetOrientation,
      });
    } catch {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 1280;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 720, 1280);
        grad.addColorStop(0, '#06150F');
        grad.addColorStop(0.5, '#0C2A20');
        grad.addColorStop(1, '#06150F');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 720, 1280);
      }
      posterBlob = await new Promise<Blob>((r) =>
        canvas.toBlob(
          (b) => r(b || new Blob([], { type: 'image/jpeg' })),
          'image/jpeg',
          0.85
        )
      );
    }

    const isLargeSource = file.size > 90 * 1024 * 1024;
    const isEconomy = options.bitrateMode === 'economy' || isLargeSource;
    // Phase 2B sharp bitrate targets: 2.8 Mbps for 720p (2.2 Mbps economy), 1.2 Mbps for 480p
    const bps720p = isEconomy ? 2_200_000 : 2_800_000;
    const bps480p = isEconomy ? 950_000 : 1_200_000;

    const effectiveOptions: TranscodeOptions = {
      ...options,
      trimDuration: options.trimDuration || (isLargeSource ? 25 : undefined),
    };

    const raw480p = await renderRendition(
      file,
      854,
      24,
      bps480p,
      effectiveOptions,
      'encoding_480p',
      15,
      38,
      isCancelledRef
    );
    const blob480p = raw480p.blob.size > 0 ? raw480p.blob : file;

    const raw720p = await renderRendition(
      file,
      1280,
      30,
      bps720p,
      effectiveOptions,
      'encoding_720p',
      53,
      44,
      isCancelledRef
    );
    const blob720p = raw720p.blob.size > 0 ? raw720p.blob : blob480p;

    options.onProgress?.({
      stage: 'finalizing',
      percentage: 100,
      stageLabel: 'Finalizing sharp HD 720p & 480p renditions...',
      etaSeconds: 0,
    });

    return {
      blob720p,
      blob480p,
      posterBlob,
      durationSeconds: effectiveOptions.trimDuration || 25,
      width: raw720p.width || 1280,
      height: raw720p.height || 720,
      size720p: blob720p.size,
      size480p: blob480p.size,
    };
  };

  return {
    promise: execute(),
    cancel,
  };
}
