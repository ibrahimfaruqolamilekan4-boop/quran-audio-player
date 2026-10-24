/**
 * Supabase client & ambient backgrounds synchronization layer.
 * 
 * Manages fetching, caching, and uploading ambient backgrounds to Supabase Storage
 * ('ambient-backgrounds' bucket) and the 'backgrounds' table.
 */

export interface BackgroundRow {
  id: string;
  name_en: string;
  name_ar?: string | null;
  category: string;
  video_url: string;
  poster_url?: string | null;
  size_bytes?: number | null;
  sort_order: number;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

// In-memory cache for fast, stale-while-revalidate lookups
let cachedBackgrounds: BackgroundRow[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
export const STORAGE_BUCKET = 'ambient-backgrounds';

/**
 * Validates a video file for mobile-friendly ambient background playback.
 * Constraints:
 * - Format: video/mp4
 * - Max size: 50 MB (optimal 3-8 MB)
 * - Resolution: Up to 1280x720 (720p max for battery & mobile data efficiency)
 */
export async function validateAmbientVideo(file: File): Promise<{
  valid: boolean;
  warning?: string;
  error?: string;
  width?: number;
  height?: number;
  duration?: number;
}> {
  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
  if (!isMp4) {
    return {
      valid: false,
      error: 'Invalid format. Backgrounds must be MP4 (H.264 video codec) for universal mobile support.',
    };
  }

  const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB hard limit
  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is 50 MB.`,
    };
  }

  // Probe video metadata via object URL
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    (video as any).playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const timer = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      // If metadata probe times out, allow with warning
      resolve({
        valid: true,
        warning: 'Could not probe video dimensions; file size is acceptable.',
      });
    }, 4000);

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);

      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;

      let warning: string | undefined;

      if (width > 1280 || height > 720) {
        warning = `Resolution is ${width}x${height}. Recommended is 720p (1280x720 max) to conserve mobile battery and bandwidth.`;
      }

      if (file.size > 8 * 1024 * 1024) {
        warning = (warning ? warning + ' ' : '') + `Video is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Target range for smooth mobile looping is 3–8 MB.`;
      }

      resolve({
        valid: true,
        warning,
        width,
        height,
        duration,
      });
    };

    video.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Unable to decode video. Ensure it is encoded with H.264 and no audio track.',
      });
    };
  });
}

/**
 * Extracts a lightweight poster thumbnail from a video file or blob using HTML5 Canvas.
 * Returns a JPEG Blob (~30-50 KB).
 */
export async function extractVideoPoster(fileOrBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    (video as any).playsInline = true;
    video.crossOrigin = 'anonymous';

    const url = URL.createObjectURL(fileOrBlob);
    video.src = url;
    video.currentTime = 0.5; // capture at 0.5s to avoid initial black frames

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onseeked = () => {
      try {
        const width = Math.min(video.videoWidth || 640, 1280);
        const height = Math.min(video.videoHeight || 360, 720);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return reject(new Error('Canvas 2D context unavailable'));
        }
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate poster JPEG blob'));
            }
          },
          'image/jpeg',
          0.82
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error('Failed to load video frame for poster'));
    };
  });
}

/**
 * Uploads a file directly to Supabase Storage bucket 'ambient-backgrounds'
 * or falls back to backend proxy.
 */
export async function uploadToSupabaseStorage(
  fileOrBlob: Blob,
  path: string,
  contentType: string
): Promise<string> {
  const cleanPath = path.replace(/^\/+/, '');

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const uploadUrl = `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/${STORAGE_BUCKET}/${cleanPath}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: fileOrBlob,
    });

    if (res.ok) {
      return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${STORAGE_BUCKET}/${cleanPath}`;
    }
  }

  // Fallback to backend media API
  const formData = new FormData();
  formData.append('file', fileOrBlob, cleanPath);
  formData.append('bucket', STORAGE_BUCKET);
  formData.append('path', cleanPath);

  const res = await fetch('/api/admin/supabase-backgrounds', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed: ${errText || res.statusText}`);
  }

  const data = await res.json();
  return data.publicUrl || data.url;
}

/**
 * Fetches all active ambient backgrounds from Supabase or the backend API.
 */
export async function fetchActiveBackgrounds(forceRefresh = false): Promise<BackgroundRow[]> {
  const now = Date.now();
  if (!forceRefresh && cachedBackgrounds && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedBackgrounds;
  }

  // 1. Try Supabase REST API directly if credentials exist
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const restUrl = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/backgrounds?is_active=eq.true&order=sort_order.asc,created_at.desc`;
      const res = await fetch(restUrl, {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const rows: BackgroundRow[] = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          cachedBackgrounds = rows;
          lastFetchTime = now;
          return rows;
        }
      }
    } catch (err) {
      console.warn('Direct Supabase fetch fallback to API:', err);
    }
  }

  // 2. Fetch from backend /api/backgrounds
  try {
    const res = await fetch('/api/backgrounds');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.backgrounds)) {
        cachedBackgrounds = data.backgrounds;
        lastFetchTime = now;
        return data.backgrounds;
      }
    }
  } catch (err) {
    console.warn('API /api/backgrounds fetch error:', err);
  }

  return cachedBackgrounds || [];
}
