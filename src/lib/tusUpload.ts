/**
 * Resumable TUS & Direct Browser Upload Client for Supabase Storage
 * 
 * Implements the TUS 1.0.0 protocol for files > 6 MB directly from browser
 * to Supabase Storage, bypassing Vercel serverless payload limits.
 * Supports:
 * - Chunked resumable streaming (6 MB chunks)
 * - Pause & Resume controls
 * - Automatic exponential retry on network drops
 * - Cache-Control: max-age=31536000 (1 year immutable CDN caching)
 * - Fallback to standard Supabase object upload
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './supabase';

export interface ResumableUploadOptions {
  bucket?: string;
  path: string;
  fileOrBlob: Blob;
  contentType: string;
  cacheControl?: string;
  authToken?: string;
  chunkSize?: number; // default 6 MB
  maxRetries?: number;
  onProgress?: (bytesUploaded: number, totalBytes: number, percentage: number) => void;
  onStateChange?: (state: 'idle' | 'uploading' | 'paused' | 'retrying' | 'completed' | 'error') => void;
}

export interface UploadController {
  promise: Promise<string>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

function base64Encode(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

export function uploadResumableToSupabase(options: ResumableUploadOptions): UploadController {
  const {
    bucket = STORAGE_BUCKET,
    path,
    fileOrBlob,
    contentType,
    cacheControl = 'max-age=31536000',
    authToken = SUPABASE_ANON_KEY,
    chunkSize = 6 * 1024 * 1024, // 6 MB chunk
    maxRetries = 5,
    onProgress,
    onStateChange,
  } = options;

  const cleanPath = path.replace(/^\/+/, '');
  const totalBytes = fileOrBlob.size;
  let isPaused = false;
  let isCancelled = false;
  let resumeCallback: (() => void) | null = null;

  const pause = () => {
    isPaused = true;
    onStateChange?.('paused');
  };

  const resume = () => {
    if (isPaused) {
      isPaused = false;
      onStateChange?.('uploading');
      if (resumeCallback) {
        const cb = resumeCallback;
        resumeCallback = null;
        cb();
      }
    }
  };

  const cancel = () => {
    isCancelled = true;
    isPaused = false;
    onStateChange?.('error');
    if (resumeCallback) {
      const cb = resumeCallback;
      resumeCallback = null;
      cb();
    }
  };

  const waitIfPaused = async () => {
    while (isPaused && !isCancelled) {
      await new Promise<void>((resolve) => {
        resumeCallback = resolve;
      });
    }
    if (isCancelled) {
      throw new Error('Upload cancelled by user.');
    }
  };

  const executeUpload = async (): Promise<string> => {
    onStateChange?.('uploading');

    // For files smaller than 6 MB, direct standard upload is faster and atomic
    if (totalBytes <= 6 * 1024 * 1024) {
      return uploadDirectAtomic(bucket, cleanPath, fileOrBlob, contentType, cacheControl, authToken, onProgress);
    }

    // TUS Resumable Upload
    const tusEndpoint = `${SUPABASE_URL}/storage/v1/upload/resumable`;
    const metadata = [
      `bucketName ${base64Encode(bucket)}`,
      `objectName ${base64Encode(cleanPath)}`,
      `contentType ${base64Encode(contentType)}`,
      `cacheControl ${base64Encode(cacheControl)}`,
    ].join(',');

    let uploadLocation: string | null = null;
    let offset = 0;

    // Step 1: Create TUS Upload Resource
    try {
      const initRes = await fetch(tusEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          apikey: authToken,
          'Upload-Length': String(totalBytes),
          'Upload-Metadata': metadata,
          'Tus-Resumable': '1.0.0',
          'x-upsert': 'true',
        },
      });

      if (initRes.status === 201 || initRes.ok) {
        uploadLocation = initRes.headers.get('Location');
        // If relative URL returned, resolve it against tusEndpoint
        if (uploadLocation && !uploadLocation.startsWith('http')) {
          uploadLocation = new URL(uploadLocation, tusEndpoint).toString();
        }
      }
    } catch (e) {
      console.warn('TUS init failed, falling back to direct upload:', e);
    }

    // If TUS is unsupported or endpoint not reachable, fallback to direct upload
    if (!uploadLocation) {
      return uploadDirectAtomic(bucket, cleanPath, fileOrBlob, contentType, cacheControl, authToken, onProgress);
    }

    // Step 2: Upload chunks sequentially with pause/resume and retry
    while (offset < totalBytes) {
      await waitIfPaused();

      const chunkEnd = Math.min(offset + chunkSize, totalBytes);
      const chunk = fileOrBlob.slice(offset, chunkEnd);

      let chunkSuccess = false;
      let attempt = 0;

      while (!chunkSuccess && attempt < maxRetries) {
        await waitIfPaused();
        attempt++;

        try {
          const patchRes = await fetch(uploadLocation, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${authToken}`,
              apikey: authToken,
              'Upload-Offset': String(offset),
              'Content-Type': 'application/offset+octet-stream',
              'Tus-Resumable': '1.0.0',
            },
            body: chunk,
          });

          if (patchRes.status === 204 || patchRes.ok) {
            const nextOffsetHeader = patchRes.headers.get('Upload-Offset');
            offset = nextOffsetHeader ? parseInt(nextOffsetHeader, 10) : chunkEnd;
            chunkSuccess = true;

            const pct = Math.min(100, Math.round((offset / totalBytes) * 100));
            onProgress?.(offset, totalBytes, pct);
          } else if (patchRes.status === 409) {
            // Offset mismatch: query current offset with HEAD
            const headRes = await fetch(uploadLocation, {
              method: 'HEAD',
              headers: {
                Authorization: `Bearer ${authToken}`,
                apikey: authToken,
                'Tus-Resumable': '1.0.0',
              },
            });
            if (headRes.ok) {
              const currentOffset = headRes.headers.get('Upload-Offset');
              if (currentOffset) {
                offset = parseInt(currentOffset, 10);
                chunkSuccess = true;
              }
            }
          } else {
            throw new Error(`TUS chunk failed with status ${patchRes.status}`);
          }
        } catch (err: any) {
          if (isCancelled) throw new Error('Upload cancelled by user.');
          console.warn(`Chunk retry ${attempt}/${maxRetries}:`, err?.message);
          onStateChange?.('retrying');
          if (attempt >= maxRetries) {
            // Last attempt failed: fallback to direct atomic upload
            return uploadDirectAtomic(bucket, cleanPath, fileOrBlob, contentType, cacheControl, authToken, onProgress);
          }
          await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 8000)));
          onStateChange?.('uploading');
        }
      }
    }

    onStateChange?.('completed');
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
  };

  return {
    promise: executeUpload(),
    pause,
    resume,
    cancel,
  };
}

/**
 * Direct atomic upload with progress tracking and automatic retry.
 */
async function uploadDirectAtomic(
  bucket: string,
  cleanPath: string,
  fileOrBlob: Blob,
  contentType: string,
  cacheControl: string,
  authToken: string,
  onProgress?: (uploaded: number, total: number, pct: number) => void
): Promise<string> {
  // Try signed upload URL first (bypasses RLS)
  try {
    const signRes = await fetch('/api/admin/supabase-backgrounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signed-upload-url', path: cleanPath }),
    });
    if (signRes.ok) {
      const signData = await signRes.json();
      if (signData.ok && signData.signedUrl) {
        onProgress?.(Math.round(totalBytes * 0.3), totalBytes, 30);
        const putRes = await fetch(signData.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            'cache-control': cacheControl,
          },
          body: fileOrBlob,
        });
        if (putRes.ok && signData.publicUrl) {
          onProgress?.(totalBytes, totalBytes, 100);
          return signData.publicUrl;
        }
      }
    }
  } catch (signErr) {
    console.warn('Signed upload URL notice in direct upload:', signErr);
  }

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${cleanPath}`;
  const totalBytes = fileOrBlob.size;

  onProgress?.(Math.round(totalBytes * 0.1), totalBytes, 10);

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      apikey: authToken,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': cacheControl,
    },
    body: fileOrBlob,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Direct upload failed (${res.status}): ${errorText || res.statusText}`);
  }

  onProgress?.(totalBytes, totalBytes, 100);
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}
