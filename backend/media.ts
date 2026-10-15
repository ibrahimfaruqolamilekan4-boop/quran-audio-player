// Media upload & high-performance streaming endpoint for background videos and sheikh photos
// Supports byte range requests (206 Partial Content) required by iOS Safari, iPadOS, and Android.
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sendJson, readJson, q, isDbConfigured } from './_lib.mjs';

const UPLOADS_DIR = path.resolve(process.cwd(), 'public/videos/uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export default async function mediaHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. UPLOAD MEDIA (Video or Image)
  if (req.method === 'POST') {
    try {
      const body = await readJson(req);
      const filename = typeof body.filename === 'string' ? body.filename.trim() : `media_${Date.now()}`;
      const name = typeof body.name === 'string' ? body.name.trim() : filename;
      const dataStr = typeof body.data === 'string' ? body.data : '';
      const isDefault = Boolean(body.isDefault);
      const mediaType = typeof body.type === 'string' ? body.type : (filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');

      if (!dataStr) {
        return sendJson(res, 400, { error: 'No media data provided.' });
      }

      // Extract base64 payload
      const base64Data = dataStr.includes('base64,') ? dataStr.split('base64,')[1] : dataStr;
      const buffer = Buffer.from(base64Data, 'base64');

      // Determine extension
      let ext = path.extname(filename).toLowerCase();
      if (!ext) {
        if (mediaType.includes('mp4')) ext = '.mp4';
        else if (mediaType.includes('webm')) ext = '.webm';
        else if (mediaType.includes('png')) ext = '.png';
        else ext = '.jpg';
      }

      const safeId = `up_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const safeFilename = `${safeId}${ext}`;
      const filePath = path.join(UPLOADS_DIR, safeFilename);

      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/videos/uploads/${safeFilename}`;

      // If it is a video, save in global_background_videos and set active if isDefault
      if (mediaType.startsWith('video') || ext === '.mp4' || ext === '.webm') {
        const id = `bg_vid_${safeId}`;
        try {
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
             VALUES ($1, $2, $3, $4, $5, now())`,
            [id, name, publicUrl, 'Uploaded by admin', isDefault]
          );
        } catch (dbErr) {
          console.warn('DB recording for video skipped:', dbErr);
        }
      }

      return sendJson(res, 201, {
        ok: true,
        id: safeId,
        url: publicUrl,
        name: name,
        size: buffer.length,
        isDefault,
      });
    } catch (err: any) {
      console.error('Media upload error:', err);
      return sendJson(res, 500, { error: err.message || 'Failed to upload media.' });
    }
  }

  // 2. STREAM MEDIA WITH RANGE REQUESTS
  if (req.method === 'GET' || req.method === 'HEAD') {
    const fileParam = urlObj.searchParams.get('file') || pathname.replace(/^\/api\/media\/?/, '');
    if (!fileParam) {
      return sendJson(res, 400, { error: 'Missing file parameter' });
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

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm' : ext === '.png' ? 'image/png' : 'image/jpeg';

    const range = req.headers.range;

    if (range) {
      // Range header: bytes=start-end
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
        });
        res.end();
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      fs.createReadStream(filePath).pipe(res);
    }
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}
