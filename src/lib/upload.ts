import localforage from 'localforage';
import { appApi } from './api';

export interface UploadValidationOptions {
  allowedTypes: string[];
  maxSizeMB: number;
  categoryName: string;
}

export const UPLOAD_RULES: Record<'image' | 'audio' | 'video', UploadValidationOptions> = {
  image: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxSizeMB: 10,
    categoryName: 'Profile Image',
  },
  audio: {
    allowedTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/aac'],
    maxSizeMB: 80,
    categoryName: 'Audio Recitation',
  },
  video: {
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxSizeMB: 150,
    categoryName: 'Ambient Background Video',
  },
};

export interface StoredMediaItem {
  id: string;
  name: string;
  type: 'image' | 'audio' | 'video';
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: number;
}

// Media storage store using localforage
export const mediaStore = localforage.createInstance({
  name: 'NoorayaMediaStorage',
  storeName: 'media_files',
});

export function validateFile(file: File, type: 'image' | 'audio' | 'video'): { valid: boolean; error?: string } {
  const rules = UPLOAD_RULES[type];
  if (!rules) {
    return { valid: false, error: 'Unknown file category.' };
  }

  // Check type (also allow by file extension fallback)
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const validExts: Record<string, string[]> = {
    image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    audio: ['.mp3', '.wav', '.m4a', '.ogg', '.aac'],
    video: ['.mp4', '.webm', '.mov'],
  };

  const hasValidMime = rules.allowedTypes.includes(file.type);
  const hasValidExt = validExts[type]?.includes(ext);

  if (!hasValidMime && !hasValidExt) {
    return {
      valid: false,
      error: `Invalid format for ${rules.categoryName}. Allowed: ${validExts[type].join(', ')}`,
    };
  }

  const maxBytes = rules.maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${rules.maxSizeMB} MB.`,
    };
  }

  return { valid: true };
}

/**
 * Uploads file with progress callback (0-100) and saves to local media database
 */
export async function processAndStoreFile(
  file: File,
  type: 'image' | 'audio' | 'video',
  onProgress?: (percent: number) => void
): Promise<StoredMediaItem> {
  const validation = validateFile(file, type);
  if (!validation.valid) {
    throw new Error(validation.error || 'Validation failed');
  }

  // Simulate chunked upload progress for realistic UI feedback
  if (onProgress) {
    onProgress(10);
    await new Promise((r) => setTimeout(r, 120));
    onProgress(45);
    await new Promise((r) => setTimeout(r, 150));
    onProgress(85);
    await new Promise((r) => setTimeout(r, 100));
  }

  // Convert File to array buffer or data URL
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type });
  const objectUrl = URL.createObjectURL(blob);

  const id = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const item: StoredMediaItem = {
    id,
    name: file.name,
    type,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    url: objectUrl,
    createdAt: Date.now(),
  };

  // Persist blob in localforage so it survives browser reload
  try {
    await mediaStore.setItem(id, {
      ...item,
      blob,
    });
  } catch (err) {
    console.warn('Could not persist to localforage, using in-memory ObjectURL', err);
  }

  if (onProgress) {
    onProgress(100);
  }

  return item;
}

export async function getStoredMediaList(): Promise<StoredMediaItem[]> {
  const items: StoredMediaItem[] = [];
  await mediaStore.iterate((val: any) => {
    if (val && val.id) {
      // Re-hydrate object URL if needed
      let url = val.url;
      if (val.blob) {
        url = URL.createObjectURL(val.blob);
      }
      items.push({
        id: val.id,
        name: val.name,
        type: val.type,
        mimeType: val.mimeType,
        sizeBytes: val.sizeBytes,
        url,
        createdAt: val.createdAt,
      });
    }
  });
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteStoredMedia(id: string): Promise<void> {
  await mediaStore.removeItem(id);
}

/**
 * Convert a Blob or File to a base64 Data URL string.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read media blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload an image or video (Blob, File, or data: URL) to /api/media.
 * Automatically splits large videos into ~1.35 MB base64 chunks so uploads
 * never hit Vercel's 4.5 MB serverless request payload limit, and returns
 * a permanent `/api/media/:id` URL that streams with HTTP 206 byte ranges
 * on iPhone, iPad, Android phones, tablets, and desktop browsers.
 */
export async function uploadMediaToServer(
  source: Blob | File | string,
  options: {
    filename?: string;
    name?: string;
    type?: string;
    isDefault?: boolean;
  } = {},
  onProgress?: (percent: number) => void
): Promise<string> {
  if (typeof source === 'string') {
    const trimmed = source.trim().replace(/^https?:\/\/localhost(:\d+)?/, '');
    if (trimmed.startsWith('/api/media/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (onProgress) onProgress(100);
      return trimmed;
    }
  }

  const dataUrl = typeof source === 'string' ? source : await blobToDataUrl(source);
  const mimeMatch = /^data:([^;,]+);base64,/.exec(dataUrl);
  const mimeType = options.type || (mimeMatch ? mimeMatch[1] : 'video/mp4');
  const rawBase64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;

  const filename = options.filename || `upload_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : mimeType.includes('webm') ? 'webm' : 'jpg'}`;
  const name = options.name || filename.replace(/\.[^/.]+$/, '');
  const isDefault = Boolean(options.isDefault);

  // 1,800,000 base64 chars is ~1.35 MB — safely under Vercel's 4.5 MB request limit
  const CHUNK_CHAR_LIMIT = 1_800_000;

  if (rawBase64.length <= CHUNK_CHAR_LIMIT) {
    if (onProgress) onProgress(30);
    const res = await appApi<{ ok: boolean; url: string }>('/media', {
      method: 'POST',
      body: {
        data: `data:${mimeType};base64,${rawBase64}`,
        filename,
        name,
        type: mimeType,
        isDefault,
      },
    });
    if (onProgress) onProgress(100);
    if (!res?.url) throw new Error('Server did not return a media URL.');
    return res.url;
  }

  // Multi-chunk upload for larger videos
  const totalChunks = Math.ceil(rawBase64.length / CHUNK_CHAR_LIMIT);
  const uploadId = `chunked_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let finalUrl = '';

  for (let i = 0; i < totalChunks; i++) {
    const chunkData = rawBase64.slice(i * CHUNK_CHAR_LIMIT, (i + 1) * CHUNK_CHAR_LIMIT);
    const isLast = i + 1 === totalChunks;
    const res = await appApi<{ ok: boolean; url?: string; complete?: boolean }>('/media', {
      method: 'POST',
      body: {
        action: 'chunk',
        uploadId,
        chunkIndex: i,
        totalChunks,
        chunkData,
        finalize: isLast,
        filename,
        name,
        type: mimeType,
        isDefault,
      },
    });

    if (onProgress) {
      onProgress(Math.min(99, Math.round(((i + 1) / totalChunks) * 95)));
    }
    if (res?.url) {
      finalUrl = res.url;
    }
  }

  if (onProgress) onProgress(100);
  if (!finalUrl) throw new Error('Chunked video upload did not return a final URL.');
  return finalUrl;
}

/**
 * Read an image picked from the device and shrink it to a portable form.
 *
 * Downsizes to `maxEdge` (512px) on the long side and re-encodes as JPEG (~35 KB).
 * Returns a clean `data:image/jpeg;base64,...` string which is 100% portable,
 * stores directly in `global_reciters.image_url`, and renders immediately on
 * every phone, tablet, and desktop without domain or CORS issues.
 */
export async function resizeImageToDataUrl(
  file: File,
  maxEdge = 512,
  quality = 0.85
): Promise<string | null> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (typeof bitmap.close === 'function') bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === 'function') bitmap.close();
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

