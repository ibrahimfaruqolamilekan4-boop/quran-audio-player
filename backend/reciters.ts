// GET /api/reciters -> { reciters: [{ id, name, style, serverUrl, imageUrl }] }
//
// Public (no session required): these are the admin-managed global reciters and portraits,
// identical for every visitor, and the landing page shows some of them.
import { type Handler, qWithFallback, sendJson } from './_lib.mjs';

interface GlobalRow {
  id: string;
  name: string;
  style: string | null;
  server_url: string | null;
  image_url?: string | null;
}

const handler: Handler = async (_req, res) => {
  try {
    const { rows } = await qWithFallback<GlobalRow>([
      { text: 'SELECT id, name, style, server_url, image_url FROM global_reciters' },
      {
        // global_reciters.image_url not migrated yet (run `node scripts/apply-schema.mjs`).
        text: 'SELECT id, name, style, server_url FROM global_reciters',
      },
    ]);
    return sendJson(res, 200, {
      reciters: rows.map(r => ({
        id: r.id,
        name: r.name,
        style: r.style ?? null,
        serverUrl: r.server_url ?? null,
        ...(r.image_url ? { imageUrl: r.image_url } : {}),
      })),
    });
  } catch (err) {
    console.error('public reciters failed:', err);
    return sendJson(res, 500, { error: 'Could not load reciters.' });
  }
};

export default handler;
