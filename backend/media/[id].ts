// GET /api/media/:id  -> the stored bytes of an admin-uploaded asset.
//
// Portraits and background clips are public assets (the same values are already
// exposed through /api/reciters and /api/ambient), so no session is required;
// the id itself is an unguessable random token.
import { type Handler, sendJson } from '../_lib.mjs';
import { getInlineMedia } from '../media-lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const url = (req.url || '').split('?')[0];
  const id = decodeURIComponent(url.replace(/^\/api\/media\//, ''));
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return sendJson(res, 400, { error: 'Invalid media id' });
  }

  try {
    const row = await getInlineMedia(id);
    if (!row) return sendJson(res, 404, { error: 'Not found' });

    const base64 = String(row.data_url).split(',')[1] || '';
    const buffer = Buffer.from(base64, 'base64');

    res.statusCode = 200;
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', String(buffer.length));
    // Uploaded assets are immutable, so they can cache hard.
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(buffer);
    return;
  } catch (err: any) {
    console.error('media fetch failed:', err);
    return sendJson(res, 500, { error: 'Could not load that asset.' });
  }
};

export default handler;
