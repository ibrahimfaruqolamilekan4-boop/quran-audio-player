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
import { q, isDbConfigured } from './_lib.mjs';

/** Hard ceiling for an inline media payload (characters of base64). */
export const MAX_INLINE_MEDIA_CHARS = 6_000_000;

/** Cap for a portrait, matching the 512px JPEG the client produces. */
export const MAX_INLINE_IMAGE_CHARS = 1_500_000;

const DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
const DATA_VIDEO_RE = /^data:video\/(mp4|webm|quicktime);base64,[A-Za-z0-9+/=\s]+$/;

/**
 * Body reader that accepts large-but-bounded uploads.
 * `readJson` in _lib.mjs stops at 1,000,000 characters, which is smaller than a
 * single portrait after base64 encoding, so uploads are parsed here instead.
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
 * Normalise an optional image value. Absolute http(s) URLs and bounded inline
 * data:image payloads are both portable, so both are accepted; anything else is
 * dropped rather than stored.
 */
export function cleanPortableImageUrl(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;

  const inline = parseInline(url, DATA_IMAGE_RE, MAX_INLINE_IMAGE_CHARS);
  if (inline) return inline;

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
 * into the bundled /videos library, or a bounded inline data:video payload, so
 * a small clip uploaded from the admin keeps working on every device.
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
  await q(`
    CREATE TABLE IF NOT EXISTS global_media (
      id         TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,
      mime_type  TEXT NOT NULL,
      data_url   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

/** Store an inline data URL and return the id it can be served from. */
export async function saveInlineMedia(dataUrl, kind) {
  if (!isDbConfigured()) throw new Error('DATABASE_URL environment variable is not set');
  const match = /^data:([^;,]+);base64,/.exec(dataUrl);
  if (!match) throw new Error('Unsupported media payload');
  await ensureMediaTable();
  const id = `media_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await q(
    'INSERT INTO global_media (id, kind, mime_type, data_url, created_at) VALUES ($1, $2, $3, $4, now())',
    [id, kind, match[1], dataUrl]
  );
  return { id, mimeType: match[1] };
}

/** Fetch a stored inline data URL, or null. */
export async function getInlineMedia(id) {
  if (!isDbConfigured() || !id) return null;
  await ensureMediaTable();
  const { rows } = await q('SELECT mime_type, data_url FROM global_media WHERE id = $1', [id]);
  return rows[0] || null;
}
