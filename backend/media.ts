// Media upload & high-performance streaming endpoint for background videos and sheikh photos
// Supports byte range requests (206 Partial Content) required by iOS Safari, iPadOS, and Android.
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sendJson, q } from './_lib.mjs';
import {
  readJsonLarge,
  saveInlineMedia,
  saveMediaChunk,
  assembleMediaChunks,
  getInlineMedia,
  streamBufferWithRange,
} from './media-lib.mjs';

const UPLOADS_DIR = path.resolve(process.cwd(), 'public/videos/uploads');

/**
 * Lazily create the upload directory, tolerating a read-only filesystem.
 */
function ensureUploadsDir(): boolean {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

async function recordVideoInAmbientDb(id: string, name: string, publicUrl: string, isDefault: boolean) {
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS global_background_videos (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        video_url   TEXT NOT NULL,
        description TEXT,
        is_default  BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    if (isDefault) {
      await q('UPDATE global_background_videos SET is_default = false');
      await q(
        `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
         VALUES ('default', 'Default Video', $1, now())
         ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
        [publicUrl]
      );
    }
    await q(
      `INSERT INTO global_background_videos (id, name, video_url, description, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, name = EXCLUDED.name, is_default = EXCLUDED.is_default`,
      [id, name, publicUrl, 'Uploaded by admin', isDefault]
    );
  } catch (dbErr) {
    console.warn('DB recording for video skipped:', dbErr);
  }
}

export default async function mediaHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. UPLOAD MEDIA (Single-shot or Chunked Video / Image)
  if (req.method === 'POST') {
    try {
      const body = await readJsonLarge(req);
      const action = typeof body.action === 'string' ? body.action : 'upload';
      const filename = typeof body.filename === 'string' ? body.filename.trim() : `media_${Date.now()}`;
      const name = typeof body.name === 'string' ? body.name.trim() : filename;
      const isDefault = Boolean(body.isDefault);
      const mediaType =
        typeof body.type === 'string' && body.type
          ? body.type
          : filename.endsWith('.mp4')
            ? 'video/mp4'
            : filename.endsWith('.webm')
              ? 'video/webm'
              : 'image/jpeg';
      const kind = mediaType.startsWith('video') || filename.endsWith('.mp4') || filename.endsWith('.webm') ? 'video' : 'image';

      // A) CHUNKED UPLOAD (Bypasses Vercel 4.5MB limit for large videos)
      if (action === 'chunk') {
        const uploadId = typeof body.uploadId === 'string' ? body.uploadId.trim() : '';
        const chunkIndex = Number(body.chunkIndex ?? 0);
        const totalChunks = Number(body.totalChunks ?? 1);
        const chunkData = typeof body.chunkData === 'string' ? body.chunkData : '';

        if (!uploadId || !chunkData) {
          return sendJson(res, 400, { error: 'Missing uploadId or chunkData.' });
        }

        await saveMediaChunk(uploadId, chunkIndex, chunkData);

        const isLastChunk = Boolean(body.finalize) || chunkIndex + 1 >= totalChunks;
        if (!isLastChunk) {
          return sendJson(res, 200, {
            ok: true,
            chunkIndex,
            totalChunks,
            complete: false,
          });
        }

        // Final chunk received: assemble into global_media
        const assembled = await assembleMediaChunks(uploadId, mediaType, kind);
        const publicUrl = `/api/media/${assembled.id}`;

        if (kind === 'video') {
          await recordVideoInAmbientDb(`bg_vid_${assembled.id}`, name, publicUrl, isDefault);
        }

        return sendJson(res, 201, {
          ok: true,
          complete: true,
          id: assembled.id,
          url: publicUrl,
          name,
          size: assembled.size,
          isDefault,
        });
      }

      // B) SINGLE-SHOT UPLOAD
      const dataStr = typeof body.data === 'string' ? body.data.trim() : '';
      if (!dataStr) {
        return sendJson(res, 400, { error: 'No media data provided.' });
      }

      // Guard: if the caller passed an existing URL (/api/media/... or http(s)://...), return it as-is
      // instead of corrupting it by base64-decoding the URL text!
      if (dataStr.startsWith('http://') || dataStr.startsWith('https://') || dataStr.startsWith('/api/media/')) {
        const cleanUrl = dataStr.replace(/^https?:\/\/localhost(:\d+)?/, '');
        return sendJson(res, 200, {
          ok: true,
          id: path.basename(cleanUrl),
          url: cleanUrl,
          name,
          size: 0,
          isDefault,
        });
      }

      const base64Data = dataStr.includes('base64,') ? dataStr.split('base64,')[1] : dataStr;
      const buffer = Buffer.from(base64Data, 'base64');

      let ext = path.extname(filename).toLowerCase();
      if (!ext) {
        if (mediaType.includes('mp4')) ext = '.mp4';
        else if (mediaType.includes('webm')) ext = '.webm';
        else if (mediaType.includes('png')) ext = '.png';
        else ext = '.jpg';
      }

      const safeId = `media_${kind}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const safeFilename = `${safeId}${ext}`;

      // 1. Always save into the database-backed media store first so every phone, tablet,
      // and serverless instance can stream the asset from /api/media/:id!
      const saved = await saveInlineMedia(
        `data:${mediaType};base64,${base64Data}`,
        kind,
        safeId
      );
      const publicUrl = `/api/media/${saved.id}`;

      // 2. Also cache on local disk when writable for fast local dev
      if (ensureUploadsDir()) {
        try {
          fs.writeFileSync(path.join(UPLOADS_DIR, safeFilename), buffer);
        } catch {}
      }

      if (kind === 'video') {
        await recordVideoInAmbientDb(`bg_vid_${saved.id}`, name, publicUrl, isDefault);
      }

      return sendJson(res, 201, {
        ok: true,
        id: saved.id,
        url: publicUrl,
        name,
        size: buffer.length,
        isDefault,
      });
    } catch (err: any) {
      console.error('Media upload error:', err);
      return sendJson(res, 500, { error: err.message || 'Failed to upload media.' });
    }
  }

  // 2. STREAM MEDIA WITH RANGE REQUESTS (HTTP 206 Partial Content for iOS/Android)
  if (req.method === 'GET' || req.method === 'HEAD') {
    const fileParam = urlObj.searchParams.get('file') || pathname.replace(/^\/api\/media\/?/, '');
    if (!fileParam) {
      return sendJson(res, 400, { error: 'Missing file parameter' });
    }

    const cleanId = decodeURIComponent(fileParam).replace(/\.[^/.]+$/, '');
    try {
      const row = (await getInlineMedia(fileParam)) || (await getInlineMedia(cleanId));
      if (row && row.data_url) {
        const base64 = String(row.data_url).includes(',')
          ? String(row.data_url).split(',')[1]
          : String(row.data_url);
        const buffer = Buffer.from(base64, 'base64');
        streamBufferWithRange(req, res, buffer, row.mime_type || 'application/octet-stream');
        return;
      }
    } catch (err) {
      console.warn('DB media lookup fallback:', err);
    }

    const safeFilename = path.basename(fileParam);
    let filePath = path.join(UPLOADS_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      const publicVideosPath = path.resolve(process.cwd(), 'public/videos', safeFilename);
      if (fs.existsSync(publicVideosPath)) {
        filePath = publicVideosPath;
      } else {
        return sendJson(res, 404, { error: 'File not found' });
      }
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(safeFilename).toLowerCase();
    const contentType =
      ext === '.mp4' ? 'video/mp4' :
      ext === '.webm' ? 'video/webm' :
      ext === '.png' ? 'image/png' :
      'image/jpeg';

    streamBufferWithRange(req, res, buffer, contentType);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

