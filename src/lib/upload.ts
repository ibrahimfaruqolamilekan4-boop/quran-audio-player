import localforage from 'localforage';

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
 * Read an image picked from the device and shrink it to a portable data URL.
 *
 * Phone portraits run to multiple megabytes, which do not belong in IndexedDB
 * or an <img> src. This downscales to `maxEdge` on the long side and re-encodes
 * as JPEG, which is what the admin panel stores as a reciter photo. Returns
 * null when the file cannot be decoded — callers treat that as "no photo".
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
