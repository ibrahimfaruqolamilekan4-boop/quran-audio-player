// Shared helpers for portable admin-uploaded media (reciter portraits, ids
// that other devices must be able to load).
//
// WHY THIS EXISTS
// Admin uploads used to stay on the admin's own device: the browser downsized
// a portrait to a data: URL and either skipped the publish entirely or had the
// value dropped by the server-side image sanitiser, which only accepted
// absolute http(s) URLs. A background video upload behaved the same way, and on
// top of that the JSON body reader rejected anything over 1,000,000 characters,
// so even the small files that WERE sent never landed. Every other device (the
// phone) therefore saw nothing. These helpers make uploads genuinely portable.
import { q } from './_lib.mjs';

/** Hard ceiling for an inline media payload (characters of base64). */
export const MAX_INLINE_MEDIA_CHARS = 250_000_000;

/** Cap for a portrait, matching the 512px JPEG the client produces. */
export const MAX_INLINE_IMAGE_CHARS = 5_000_000;

const DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
const DATA_VIDEO_RE = /^data:video\/(mp4|webm|quicktime|ogg);base64,[A-Za-z0-9+/=\s]+$/;

/**
 * Body reader that accepts large-but-bounded uploads.
 * `readJson` in _lib.mjs stops at 1,000,000 characters, which is smaller than a
 * single portrait or video after base64 encoding, so uploads are parsed here instead.
 */
export function readJsonLarge(req, limit = MAX_INLINE_MEDIA_CHARS) {
  const pre = req.body;
  if (pre && typeof pre === 'object' && Object.keys(pre).length > 0) return Promise.resolve(pre);
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function parseInline(value, re, maxChars) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.length > maxChars) return null;
  return re.test(url) ? url : null;
}

/**
 * Normalise an optional image value. Absolute http(s) URLs, /api/media paths,
 * and bounded inline data:image payloads are all portable.
 */
export function cleanPortableImageUrl(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;

  const inline = parseInline(url, DATA_IMAGE_RE, MAX_INLINE_IMAGE_CHARS);
  if (inline) return inline;

  if (url.startsWith('/') && url.length <= 2048) return url;
  if (url.length > 2048) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Normalise an ambient background-video value. Accepts a hosted URL, a path
 * into the bundled /videos or /api/media library, or a bounded inline data:video payload.
 */
export function cleanPortableVideoUrl(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;

  const inline = parseInline(url, DATA_VIDEO_RE, MAX_INLINE_MEDIA_CHARS);
  if (inline) return inline;

  if (url.startsWith('/') && url.length <= 2048) return url;
  if (url.length > 2048) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- media store

let tableReady = false;

/** Idempotent table creation, mirroring the pattern used by admin/ambient. */
async function ensureMediaTable() {
  if (tableReady) return;
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS global_media (
        id         TEXT PRIMARY KEY,
        kind       TEXT NOT NULL,
        mime_type  TEXT NOT NULL,
        data_url   TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await q(`
      CREATE TABLE IF NOT EXISTS global_media_chunks (
        upload_id   TEXT NOT NULL,
        chunk_index INT NOT NULL,
        chunk_data  TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (upload_id, chunk_index)
      )
    `);
    tableReady = true;
  } catch (err) {
    console.warn('Media table initialization note:', err?.message || err);
  }
}

/** Store an inline data URL and return the id it can be served from. */
export async function saveInlineMedia(dataUrl, kind, customId) {
  const match = /^data:([^;,]+);base64,/.exec(dataUrl);
  const mimeType = match ? match[1] : (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const normalizedDataUrl = match ? dataUrl : `data:${mimeType};base64,${dataUrl}`;
  await ensureMediaTable();
  const id = customId || `media_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await q(
    'INSERT INTO global_media (id, kind, mime_type, data_url, created_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (id) DO UPDATE SET data_url = EXCLUDED.data_url, mime_type = EXCLUDED.mime_type',
    [id, kind, mimeType, normalizedDataUrl]
  );
  return { id, mimeType };
}

/** Save a single base64 chunk for a multi-part upload (bypasses Vercel's 4.5MB per-request limit). */
export async function saveMediaChunk(uploadId, chunkIndex, chunkData) {
  await ensureMediaTable();
  await q(
    'INSERT INTO global_media_chunks (upload_id, chunk_index, chunk_data, created_at) VALUES ($1, $2, $3, now()) ON CONFLICT (upload_id, chunk_index) DO UPDATE SET chunk_data = EXCLUDED.chunk_data',
    [uploadId, Number(chunkIndex), String(chunkData || '')]
  );
}

/** Reassemble all chunks for uploadId into global_media and clean up the temporary chunks. */
export async function assembleMediaChunks(uploadId, mimeType, kind, customId) {
  await ensureMediaTable();
  const { rows } = await q(
    'SELECT chunk_index, chunk_data FROM global_media_chunks WHERE upload_id = $1 ORDER BY chunk_index ASC',
    [uploadId]
  );
  if (!rows || rows.length === 0) {
    throw new Error('No chunks found for upload ' + uploadId);
  }
  const combinedBase64 = rows.map(r => r.chunk_data).join('');
  const cleanBase64 = combinedBase64.includes('base64,') ? combinedBase64.split('base64,')[1] : combinedBase64;
  const fullDataUrl = `data:${mimeType};base64,${cleanBase64}`;
  const saved = await saveInlineMedia(fullDataUrl, kind, customId);
  await q('DELETE FROM global_media_chunks WHERE upload_id = $1', [uploadId]).catch(() => {});
  return { ...saved, size: Math.floor((cleanBase64.length * 3) / 4) };
}

/** Fetch a stored inline data URL, or null. */
export async function getInlineMedia(id) {
  if (!id) return null;
  await ensureMediaTable();
  const { rows } = await q('SELECT mime_type, data_url FROM global_media WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Stream a binary Buffer with full HTTP 206 Partial Content (Byte-Range) support.
 * Mandatory for iOS Safari (iPhone), iPadOS Safari (iPad), and Android video playback.
 */
export function streamBufferWithRange(req, res, buffer, mimeType) {
  const total = buffer.length;
  const range = req.headers?.range;

  const commonHeaders = {
    'Accept-Ranges': 'bytes',
    'Content-Type': mimeType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
  };

  if (range) {
    const parts = String(range).replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), total - 1) : total - 1;

    if (isNaN(start) || isNaN(end) || start >= total || end >= total || start > end) {
      res.writeHead(416, {
        ...commonHeaders,
        'Content-Range': `bytes */${total}`,
      });
      res.end();
      return;
    }

    const chunkLength = end - start + 1;
    res.writeHead(206, {
      ...commonHeaders,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(chunkLength),
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    res.end(buffer.subarray(start, end + 1));
    return;
  }

  res.writeHead(200, {
    ...commonHeaders,
    'Content-Length': String(total),
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.end(buffer);
}

