// GET /api/reciters -> { reciters: [{ id, name, nameArabic, style, category, bio, serverUrl, imageUrl }] }
//
// Public (no session required): these are the admin-managed global reciters and portraits,
// identical for every visitor, and the landing page shows some of them.
import fs from 'node:fs';
import path from 'node:path';
import { type Handler, qWithFallback, sendJson } from './_lib.mjs';

interface GlobalRow {
  id: string;
  name: string;
  name_arabic?: string | null;
  style: string | null;
  category?: string | null;
  bio?: string | null;
  server_url: string | null;
  image_url?: string | null;
}

function sanitizePublicImageUrl(url: string | null | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim().replace(/^https?:\/\/localhost(:\d+)?/, '');
  if (!trimmed) return undefined;
  // If it points to a local disk upload /videos/uploads/..., verify it exists on disk
  if (trimmed.startsWith('/videos/uploads/')) {
    const fileOnDisk = path.resolve(process.cwd(), 'public', trimmed.replace(/^\//, ''));
    if (!fs.existsSync(fileOnDisk)) return undefined;
  }
  return trimmed;
}

const handler: Handler = async (_req, res) => {
  try {
    const { rows } = await qWithFallback<GlobalRow>([
      { text: 'SELECT id, name, name_arabic, style, category, bio, server_url, image_url FROM global_reciters' },
      { text: 'SELECT id, name, style, server_url, image_url FROM global_reciters' },
      { text: 'SELECT id, name, style, server_url FROM global_reciters' },
    ]);
    return sendJson(res, 200, {
      reciters: rows.map(r => {
        const cleanImg = sanitizePublicImageUrl(r.image_url);
        return {
          id: r.id,
          name: r.name,
          ...(r.name_arabic ? { nameArabic: r.name_arabic } : {}),
          style: r.style ?? null,
          ...(r.category ? { category: r.category } : {}),
          ...(r.bio ? { bio: r.bio } : {}),
          serverUrl: r.server_url ?? null,
          ...(cleanImg ? { imageUrl: cleanImg } : {}),
        };
      }),
    });
  } catch (err: any) {
    console.warn('public reciters unavailable, using fallback:', err?.message || String(err));
    return sendJson(res, 200, { reciters: [] });
  }
};

export default handler;

