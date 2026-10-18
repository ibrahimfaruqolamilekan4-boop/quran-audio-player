// GET /api/media/:id  -> the stored bytes of an admin-uploaded asset.
//
// Portraits and background clips are public assets (the same values are already
// exposed through /api/reciters and /api/ambient), so no session is required;
// the id itself is an unguessable random token.
import fs from 'node:fs';
import path from 'node:path';
import { type Handler, sendJson } from '../_lib.mjs';
import { getInlineMedia, streamBufferWithRange } from '../media-lib.mjs';

const UPLOADS_DIR = path.resolve(process.cwd(), 'public/videos/uploads');
const PUBLIC_VIDEOS_DIR = path.resolve(process.cwd(), 'public/videos');

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const url = (req.url || '').split('?')[0];
  const id = decodeURIComponent(url.replace(/^\/api\/media\//, ''));
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(id)) {
    return sendJson(res, 400, { error: 'Invalid media id' });
  }

  try {
    // 1. Check database / portable media store first
    const row = await getInlineMedia(id);
    if (row && row.data_url) {
      const base64 = String(row.data_url).includes(',')
        ? String(row.data_url).split(',')[1]
        : String(row.data_url);
      const buffer = Buffer.from(base64, 'base64');
      streamBufferWithRange(req, res, buffer, row.mime_type || 'application/octet-stream');
      return;
    }

    // 2. Fallback to local disk uploads or public videos if present
    const safeName = path.basename(id);
    for (const dir of [UPLOADS_DIR, PUBLIC_VIDEOS_DIR]) {
      const candidate = path.join(dir, safeName);
      if (fs.existsSync(candidate)) {
        const buffer = fs.readFileSync(candidate);
        const ext = path.extname(safeName).toLowerCase();
        const mimeType =
          ext === '.mp4' ? 'video/mp4' :
          ext === '.webm' ? 'video/webm' :
          ext === '.mov' ? 'video/quicktime' :
          ext === '.png' ? 'image/png' :
          ext === '.webp' ? 'image/webp' :
          'image/jpeg';
        streamBufferWithRange(req, res, buffer, mimeType);
        return;
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err: any) {
    console.error('media fetch failed:', err);
    return sendJson(res, 500, { error: 'Could not load that asset.' });
  }
};

export default handler;

