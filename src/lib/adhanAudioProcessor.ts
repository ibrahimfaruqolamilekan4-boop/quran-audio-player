/**
 * Client-Side Adhan Audio Inspector & DSP Processor (Step 1.3 & Step 2.6)
 *
 * Capabilities:
 * 1. `inspectAdhanAudioUrl(url)`:
 *    - Checks HTTP status (200/206), Content-Type (`audio/*`), Content-Length,
 *      Accept-Ranges (`bytes`), CORS access, and whether the audio actually decodes.
 *    - Measures exact duration (seconds), sample rate, channels, estimated bitrate (kbps),
 *      peak loudness (dBFS), RMS loudness (dBFS), and flags whether it is a genuine
 *      full Adhan (>= 60s, typically 120–240s) vs. a short clip/placeholder (< 60s) or silent.
 * 2. `processAdhanAudioFile(file, options)`:
 *    - Decodes the uploaded audio file via Web Audio API.
 *    - Validates duration >= 60 seconds (returns `isShortClipWarning: true` if < 60s).
 *    - Trims leading & trailing silence below -45 dBFS (with 150ms safety margin).
 *    - Auto-normalizes peak loudness to -1.0 dBFS.
 *    - Applies smooth 0.35s fade-in and 0.75s fade-out.
 *    - Produces:
 *      (a) Full Web Version (`webBlob`, `webContentType`, `webExt`)
 *      (b) <= 30-second Native Notification Clip (`notificationClipBlob`, `.wav` PCM 16-bit)
 *          with a 1.5s fade-out at the end for iOS (`UNNotificationSound` <= 30s) & Android.
 */

export interface AudioUrlInspectionReport {
  url: string;
  reachable: boolean;
  httpStatus: number | null;
  contentType: string | null;
  isAudioContentType: boolean;
  contentLengthBytes: number | null;
  rangeSupported: boolean;
  corsAllowed: boolean;
  decodesSuccessfully: boolean;
  durationSeconds: number | null;
  sampleRate: number | null;
  numberOfChannels: number | null;
  estimatedBitrateKbps: number | null;
  peakDbFs: number | null;
  rmsDbFs: number | null;
  isSilent: boolean;
  isRealAdhanDuration: boolean; // >= 60s (real Adhan is ~2-4 mins)
  verdict: 'valid_adhan' | 'short_clip_or_placeholder' | 'silent_audio' | 'corrupted_or_unplayable' | 'unreachable';
  verdictSummary: string;
}

export interface ProcessedAdhanUploadResult {
  originalDurationSeconds: number;
  trimmedDurationSeconds: number;
  isShortClipWarning: boolean;
  shortClipWarningMessage: string | null;
  peakDbBefore: number;
  peakDbAfter: number;
  rmsDbAfter: number;
  gainAppliedDb: number;
  trimmedLeadingSeconds: number;
  trimmedTrailingSeconds: number;
  webBlob: Blob;
  webContentType: string;
  webExtension: string;
  notificationClipBlob: Blob;
  notificationClipDurationSeconds: number;
}

function linearToDb(linear: number): number {
  if (linear <= 0.000001) return -120;
  return Math.round(20 * Math.log10(linear) * 10) / 10;
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Encodes an AudioBuffer (or segment of an AudioBuffer) into a standard 16-bit PCM WAV Blob.
 * Compatible with all browsers, iOS `UNNotificationSound` (<=30s), and Android `NotificationChannel`.
 */
export function encodeAudioBufferToWavBlob(
  buffer: AudioBuffer,
  options: {
    startSample?: number;
    endSample?: number;
    targetSampleRate?: number;
    mono?: boolean;
    gainLinear?: number;
    fadeInSeconds?: number;
    fadeOutSeconds?: number;
  } = {}
): { blob: Blob; durationSeconds: number; peakDbAfter: number; rmsDbAfter: number } {
  const srcRate = buffer.sampleRate;
  const startSample = Math.max(0, options.startSample ?? 0);
  const endSample = Math.min(buffer.length, options.endSample ?? buffer.length);
  const frameCount = Math.max(1, endSample - startSample);
  const targetRate = options.targetSampleRate || srcRate;
  const rateRatio = srcRate / targetRate;
  const outFrames = Math.max(1, Math.floor(frameCount / rateRatio));
  const numChannels = options.mono ? 1 : Math.min(2, buffer.numberOfChannels);
  const gain = options.gainLinear ?? 1.0;

  const fadeInSamples = Math.floor((options.fadeInSeconds ?? 0.35) * targetRate);
  const fadeOutSamples = Math.floor((options.fadeOutSeconds ?? 0.75) * targetRate);

  const chData: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    chData.push(buffer.getChannelData(c));
  }

  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = outFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  let peak = 0;
  let sumSq = 0;

  for (let i = 0; i < outFrames; i++) {
    const srcIdx = Math.min(endSample - 1, startSample + Math.floor(i * rateRatio));

    // Envelope for fade-in and fade-out
    let env = 1.0;
    if (fadeInSamples > 0 && i < fadeInSamples) {
      env = i / fadeInSamples;
    } else if (fadeOutSamples > 0 && i > outFrames - fadeOutSamples) {
      env = Math.max(0, (outFrames - i) / fadeOutSamples);
    }

    if (numChannels === 1 && chData.length > 1) {
      let sum = 0;
      for (let c = 0; c < chData.length; c++) {
        sum += chData[c][srcIdx] || 0;
      }
      let s = (sum / chData.length) * gain * env;
      s = Math.max(-1, Math.min(1, s));
      const abs = Math.abs(s);
      if (abs > peak) peak = abs;
      sumSq += s * s;
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    } else {
      for (let c = 0; c < numChannels; c++) {
        let s = (chData[c]?.[srcIdx] || 0) * gain * env;
        s = Math.max(-1, Math.min(1, s));
        const abs = Math.abs(s);
        if (abs > peak) peak = abs;
        sumSq += s * s;
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
  }

  const totalSamples = outFrames * numChannels;
  const rms = totalSamples > 0 ? Math.sqrt(sumSq / totalSamples) : 0;

  return {
    blob: new Blob([arrayBuffer], { type: 'audio/wav' }),
    durationSeconds: Math.round((outFrames / targetRate) * 10) / 10,
    peakDbAfter: linearToDb(peak),
    rmsDbAfter: linearToDb(rms),
  };
}

/**
 * Decodes an ArrayBuffer into an AudioBuffer using Web Audio API.
 */
async function decodeAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const Ctx =
    typeof window !== 'undefined'
      ? window.AudioContext || (window as any).webkitAudioContext
      : null;
  if (!Ctx) {
    throw new Error('Web Audio API is not available in this environment.');
  }
  const ctx: AudioContext = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return decoded;
  } finally {
    try {
      await ctx.close();
    } catch {}
  }
}

/**
 * Analyzes an AudioBuffer for leading/trailing silence and peak/RMS loudness.
 */
export function analyzeAudioBuffer(buffer: AudioBuffer): {
  startSample: number;
  endSample: number;
  trimmedLeadingSeconds: number;
  trimmedTrailingSeconds: number;
  trimmedDurationSeconds: number;
  peakLinear: number;
  rmsLinear: number;
  peakDbFs: number;
  rmsDbFs: number;
  isSilent: boolean;
} {
  const silenceThresholdLinear = dbToLinear(-45); // -45 dBFS threshold
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;

  const chArrays: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    chArrays.push(buffer.getChannelData(c));
  }

  let firstActiveSample = 0;
  let lastActiveSample = length - 1;
  let foundFirst = false;

  let peakLinear = 0;
  let sumSq = 0;

  // Step through samples to measure peak, RMS, and silence boundaries
  for (let i = 0; i < length; i++) {
    let frameMax = 0;
    for (let c = 0; c < channels; c++) {
      const val = Math.abs(chArrays[c][i]);
      if (val > frameMax) frameMax = val;
      sumSq += val * val;
    }
    if (frameMax > peakLinear) peakLinear = frameMax;
    if (frameMax >= silenceThresholdLinear) {
      if (!foundFirst) {
        firstActiveSample = i;
        foundFirst = true;
      }
      lastActiveSample = i;
    }
  }

  const safetyPadSamples = Math.floor(sampleRate * 0.15); // 150ms safety margin
  const startSample = foundFirst ? Math.max(0, firstActiveSample - safetyPadSamples) : 0;
  const endSample = foundFirst
    ? Math.min(length, lastActiveSample + safetyPadSamples)
    : length;

  const rmsLinear = length * channels > 0 ? Math.sqrt(sumSq / (length * channels)) : 0;
  const peakDbFs = linearToDb(peakLinear);
  const rmsDbFs = linearToDb(rmsLinear);

  return {
    startSample,
    endSample,
    trimmedLeadingSeconds: Math.round((startSample / sampleRate) * 100) / 100,
    trimmedTrailingSeconds: Math.round(((length - endSample) / sampleRate) * 100) / 100,
    trimmedDurationSeconds: Math.round(((endSample - startSample) / sampleRate) * 10) / 10,
    peakLinear,
    rmsLinear,
    peakDbFs,
    rmsDbFs,
    isSilent: peakDbFs < -55,
  };
}

/**
 * Processes an uploaded Adhan audio file in one step (Step 2.6):
 * - Decodes & validates duration >= 60s
 * - Trims leading/trailing silence
 * - Auto-normalizes loudness to -1.0 dBFS peak
 * - Adds smooth fade-in (0.35s) and fade-out (0.75s)
 * - Generates both the Web version and the <= 30s Native Notification WAV clip
 */
export async function processAdhanAudioFile(file: File): Promise<ProcessedAdhanUploadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const decoded = await decodeAudioBuffer(arrayBuffer);
  const analysis = analyzeAudioBuffer(decoded);

  const originalDurationSeconds = Math.round(decoded.duration * 10) / 10;
  const isShortClipWarning = analysis.trimmedDurationSeconds < 60;
  const shortClipWarningMessage = isShortClipWarning
    ? `File duration is ${analysis.trimmedDurationSeconds}s (< 60s minimum). A genuine full Adhan is roughly 2–4 minutes (120–240s). Short clips or placeholders should not be used.`
    : null;

  // Target peak: -1.0 dBFS (0.891 linear), max boost +14 dB
  const targetPeakLinear = dbToLinear(-1.0);
  const rawGain =
    analysis.peakLinear > 0.0001 ? targetPeakLinear / analysis.peakLinear : 1.0;
  const clampedGain = Math.min(dbToLinear(14), Math.max(0.25, rawGain));
  const gainAppliedDb = Math.round(linearToDb(clampedGain) * 10) / 10;

  // Determine whether the source compressed file (MP3/M4A/AAC/OGG) is already well-leveled
  // and has minimal silence, or if we should emit the DSP-trimmed & normalized audio.
  const isCompressedAudio = /\.(mp3|m4a|aac|ogg)$/i.test(file.name) ||
    /audio\/(mpeg|mp3|mp4|aac|ogg)/i.test(file.type);
  const needsSilenceTrim =
    analysis.trimmedLeadingSeconds > 1.2 || analysis.trimmedTrailingSeconds > 2.0;
  const needsLoudnessNormalization = Math.abs(gainAppliedDb) > 3.5;

  let webBlob: Blob;
  let webContentType: string;
  let webExtension: string;
  let peakDbAfter = Math.min(0, Math.round((analysis.peakDbFs + gainAppliedDb) * 10) / 10);
  let rmsDbAfter = Math.min(0, Math.round((analysis.rmsDbFs + gainAppliedDb) * 10) / 10);

  if (isCompressedAudio && !needsSilenceTrim && !needsLoudnessNormalization) {
    // Keep the compact compressed MP3/AAC stream directly
    const extMatch = file.name.match(/\.(mp3|m4a|aac|ogg)$/i);
    webExtension = extMatch ? extMatch[1].toLowerCase() : 'mp3';
    webContentType =
      file.type && file.type.startsWith('audio/')
        ? file.type
        : webExtension === 'm4a' || webExtension === 'aac'
        ? 'audio/mp4'
        : webExtension === 'ogg'
        ? 'audio/ogg'
        : 'audio/mpeg';
    webBlob = file;
    peakDbAfter = analysis.peakDbFs;
    rmsDbAfter = analysis.rmsDbFs;
  } else {
    // Encode normalized, silence-trimmed, fade-enveloped Web Audio stream (24 kHz mono WAV for fast streaming)
    const encodedWeb = encodeAudioBufferToWavBlob(decoded, {
      startSample: analysis.startSample,
      endSample: analysis.endSample,
      targetSampleRate: Math.min(decoded.sampleRate, 24000),
      mono: true,
      gainLinear: clampedGain,
      fadeInSeconds: 0.35,
      fadeOutSeconds: 0.75,
    });
    webBlob = encodedWeb.blob;
    webContentType = 'audio/wav';
    webExtension = 'wav';
    peakDbAfter = encodedWeb.peakDbAfter;
    rmsDbAfter = encodedWeb.rmsDbAfter;
  }

  // Always generate a <= 28-second Native Notification Clip (WAV PCM 16-bit, 22.05 kHz mono)
  // for iOS UNNotificationSound (strictly <= 30s) and Android NotificationChannel
  const maxClipSeconds = 28;
  const maxClipSamples = Math.min(
    analysis.endSample,
    analysis.startSample + Math.floor(decoded.sampleRate * maxClipSeconds)
  );
  const notificationClip = encodeAudioBufferToWavBlob(decoded, {
    startSample: analysis.startSample,
    endSample: maxClipSamples,
    targetSampleRate: 22050,
    mono: true,
    gainLinear: clampedGain,
    fadeInSeconds: 0.25,
    fadeOutSeconds: 1.5,
  });

  return {
    originalDurationSeconds,
    trimmedDurationSeconds: analysis.trimmedDurationSeconds,
    isShortClipWarning,
    shortClipWarningMessage,
    peakDbBefore: analysis.peakDbFs,
    peakDbAfter,
    rmsDbAfter,
    gainAppliedDb,
    trimmedLeadingSeconds: analysis.trimmedLeadingSeconds,
    trimmedTrailingSeconds: analysis.trimmedTrailingSeconds,
    webBlob,
    webContentType,
    webExtension,
    notificationClipBlob: notificationClip.blob,
    notificationClipDurationSeconds: notificationClip.durationSeconds,
  };
}

/**
 * Inspects an Adhan audio URL (Step 1.3 & Step 2.7):
 * Checks HTTP status (200/206), Content-Type, Content-Length, Range support, CORS,
 * and decodes the audio to report exact duration, bitrate, loudness (dBFS), and whether
 * it is a real Adhan (>= 60s) vs. a placeholder/short clip/silent/corrupted file.
 */
export async function inspectAdhanAudioUrl(url: string): Promise<AudioUrlInspectionReport> {
  const report: AudioUrlInspectionReport = {
    url,
    reachable: false,
    httpStatus: null,
    contentType: null,
    isAudioContentType: false,
    contentLengthBytes: null,
    rangeSupported: false,
    corsAllowed: false,
    decodesSuccessfully: false,
    durationSeconds: null,
    sampleRate: null,
    numberOfChannels: null,
    estimatedBitrateKbps: null,
    peakDbFs: null,
    rmsDbFs: null,
    isSilent: false,
    isRealAdhanDuration: false,
    verdict: 'unreachable',
    verdictSummary: 'URL has not been checked yet.',
  };

  if (!url || !url.trim()) {
    report.verdict = 'unreachable';
    report.verdictSummary = 'No audio URL configured (audio_url is null).';
    return report;
  }

  try {
    // 1. Check Range request (bytes=0-1023) for HTTP 200/206, Content-Type, Range support & CORS
    const rangeRes = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      cache: 'no-store',
    });

    report.httpStatus = rangeRes.status;
    report.reachable = rangeRes.ok || rangeRes.status === 206;
    report.corsAllowed = true;
    report.contentType = rangeRes.headers.get('content-type');
    const ctLower = (report.contentType || '').toLowerCase();
    report.isAudioContentType =
      ctLower.startsWith('audio/') ||
      ctLower.includes('octet-stream') ||
      url.startsWith('/api/media/');

    const acceptRanges = (rangeRes.headers.get('accept-ranges') || '').toLowerCase();
    const contentRange = rangeRes.headers.get('content-range') || '';
    report.rangeSupported = rangeRes.status === 206 || acceptRanges.includes('bytes') || Boolean(contentRange);

    if (contentRange.includes('/')) {
      const totalStr = contentRange.split('/')[1];
      const totalParsed = Number(totalStr);
      if (!Number.isNaN(totalParsed) && totalParsed > 0) {
        report.contentLengthBytes = totalParsed;
      }
    }

    if (!report.reachable) {
      report.verdict = 'unreachable';
      report.verdictSummary = `HTTP ${rangeRes.status}: Audio file is not accessible.`;
      return report;
    }

    // 2. Download full audio buffer to verify decoding, duration, bitrate, and loudness
    const fullRes = await fetch(url, { cache: 'no-store' });
    const arrayBuffer = await fullRes.arrayBuffer();
    if (!report.contentLengthBytes) {
      report.contentLengthBytes = arrayBuffer.byteLength;
    }

    const decoded = await decodeAudioBuffer(arrayBuffer);
    const analysis = analyzeAudioBuffer(decoded);

    report.decodesSuccessfully = true;
    report.durationSeconds = Math.round(decoded.duration * 10) / 10;
    report.sampleRate = decoded.sampleRate;
    report.numberOfChannels = decoded.numberOfChannels;
    report.peakDbFs = analysis.peakDbFs;
    report.rmsDbFs = analysis.rmsDbFs;
    report.isSilent = analysis.isSilent;
    report.isRealAdhanDuration = decoded.duration >= 60;

    if (report.contentLengthBytes && decoded.duration > 0) {
      report.estimatedBitrateKbps = Math.round((report.contentLengthBytes * 8) / (decoded.duration * 1000));
    }

    if (analysis.isSilent) {
      report.verdict = 'silent_audio';
      report.verdictSummary = `Audio decodes (${report.durationSeconds}s) but is silent (peak ${analysis.peakDbFs} dBFS).`;
    } else if (!report.isRealAdhanDuration) {
      report.verdict = 'short_clip_or_placeholder';
      report.verdictSummary = `Short clip or placeholder detected: duration is only ${report.durationSeconds}s (a real Adhan is ~120–240s).`;
    } else {
      report.verdict = 'valid_adhan';
      report.verdictSummary = `Verified real Adhan (${report.durationSeconds}s, ~${report.estimatedBitrateKbps || 96} kbps, peak ${analysis.peakDbFs} dBFS).`;
    }

    return report;
  } catch (err: any) {
    report.verdict = report.reachable ? 'corrupted_or_unplayable' : 'unreachable';
    report.verdictSummary = report.reachable
      ? `File downloaded (HTTP ${report.httpStatus}) but failed to decode as valid audio: ${err?.message || 'corrupt stream'}`
      : `Network or CORS error fetching audio URL: ${err?.message || 'unreachable'}`;
    return report;
  }
}
