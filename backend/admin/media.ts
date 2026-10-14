// POST /api/admin/media  { dataUrl, kind: 'image' | 'video' }
//   -> { ok, id, url }
//
// Turns a device upload into a real, portable URL so portraits and background
// clips added in the admin panel load on every device, not just the admin's.
import { type Handler, requireAdmin, sendJson } from '../_lib.mjs';
import {
  cleanPortableImageUrl,
  cleanPortableVideoUrl,
  readJsonLarge,
  saveInlineMedia,
} from '../media-lib.mjs';

const KINDS = new Set(['image', 'video']);

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    let body;
    try {
      body = await readJsonLarge(req);
    } catch (err) {
      return sendJson(res, 413, { error: err?.message || 'Upload too large' });
    }

    const kind = KINDS.has(body.kind) ? body.kind : 'image';
    const dataUrl =
      kind === 'image' ? cleanPortableImageUrl(body.dataUrl) : cleanPortableVideoUrl(body.dataUrl);

    // Only inline payloads need storing; a hosted URL is already portable.
    if (!dataUrl) return sendJson(res, 400, { error: 'A valid image or video payload is required.' });
    if (!dataUrl.startsWith('data:')) return sendJson(res, 200, { ok: true, url: dataUrl });

    const saved = await saveInlineMedia(dataUrl, kind);
    return sendJson(res, 201, { ok: true, id: saved.id, url: `/api/media/${saved.id}` });
  } catch (err: any) {
    console.error('admin media upload failed:', err);
    return sendJson(res, 500, { error: 'Could not store that upload.' });
  }
};

export default handler;
