// Admin API for Supabase / Neon backgrounds management
// Supports: list all (including inactive), add, update, delete, reorder, toggle active
import { type Handler, q, requireAdmin, sendJson } from '../_lib.mjs';
import { readJsonLarge } from '../media-lib.mjs';
import { ensureBackgroundsTable } from '../backgrounds';

const handler: Handler = async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await ensureBackgroundsTable().catch(() => {});

    // GET /api/admin/supabase-backgrounds -> list all backgrounds
    if (req.method === 'GET') {
      const result = await q(`
        SELECT id, name_en, name_ar, category, video_url, poster_url, size_bytes, sort_order, is_active, is_premium, created_at
        FROM backgrounds
        ORDER BY sort_order ASC, created_at DESC
      `);
      return sendJson(res, 200, { backgrounds: result.rows });
    }

    // POST /api/admin/supabase-backgrounds
    if (req.method === 'POST') {
      const body = await readJsonLarge(req);
      const action = body.action || 'add';

      if (action === 'add') {
        const id = body.id || `bg_${Date.now()}`;
        const name_en = String(body.name_en || '').trim();
        const name_ar = body.name_ar ? String(body.name_ar).trim() : null;
        const category = String(body.category || 'general').trim().toLowerCase();
        const video_url = String(body.video_url || '').trim();
        const poster_url = body.poster_url ? String(body.poster_url).trim() : null;
        const size_bytes = Number(body.size_bytes || 0);
        const sort_order = Number(body.sort_order || 0);
        const is_active = body.is_active !== false;
        const is_premium = Boolean(body.is_premium);

        if (!name_en || !video_url) {
          return sendJson(res, 400, { error: 'name_en and video_url are required.' });
        }

        await q(
          `INSERT INTO backgrounds (id, name_en, name_ar, category, video_url, poster_url, size_bytes, sort_order, is_active, is_premium, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
           ON CONFLICT (id) DO UPDATE SET
             name_en = EXCLUDED.name_en,
             name_ar = EXCLUDED.name_ar,
             category = EXCLUDED.category,
             video_url = EXCLUDED.video_url,
             poster_url = EXCLUDED.poster_url,
             size_bytes = EXCLUDED.size_bytes,
             sort_order = EXCLUDED.sort_order,
             is_active = EXCLUDED.is_active,
             is_premium = EXCLUDED.is_premium`,
          [id, name_en, name_ar, category, video_url, poster_url, size_bytes, sort_order, is_active, is_premium]
        );

        return sendJson(res, 201, {
          ok: true,
          background: { id, name_en, name_ar, category, video_url, poster_url, size_bytes, sort_order, is_active, is_premium },
        });
      }

      if (action === 'update') {
        const id = String(body.id || '');
        if (!id) return sendJson(res, 400, { error: 'ID is required' });

        const name_en = body.name_en !== undefined ? String(body.name_en).trim() : undefined;
        const name_ar = body.name_ar !== undefined ? (body.name_ar ? String(body.name_ar).trim() : null) : undefined;
        const category = body.category !== undefined ? String(body.category).trim().toLowerCase() : undefined;
        const video_url = body.video_url !== undefined ? String(body.video_url).trim() : undefined;
        const poster_url = body.poster_url !== undefined ? (body.poster_url ? String(body.poster_url).trim() : null) : undefined;
        const sort_order = body.sort_order !== undefined ? Number(body.sort_order) : undefined;
        const is_active = body.is_active !== undefined ? Boolean(body.is_active) : undefined;
        const is_premium = body.is_premium !== undefined ? Boolean(body.is_premium) : undefined;

        await q(
          `UPDATE backgrounds
           SET name_en = COALESCE($2, name_en),
               name_ar = COALESCE($3, name_ar),
               category = COALESCE($4, category),
               video_url = COALESCE($5, video_url),
               poster_url = COALESCE($6, poster_url),
               sort_order = COALESCE($7, sort_order),
               is_active = COALESCE($8, is_active),
               is_premium = COALESCE($9, is_premium)
           WHERE id = $1`,
          [id, name_en, name_ar, category, video_url, poster_url, sort_order, is_active, is_premium]
        );

        return sendJson(res, 200, { ok: true });
      }

      if (action === 'delete') {
        const id = String(body.id || '');
        if (!id) return sendJson(res, 400, { error: 'ID is required' });
        await q('DELETE FROM backgrounds WHERE id = $1', [id]);
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 400, { error: 'Unknown action' });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Admin backgrounds error:', err);
    return sendJson(res, 500, { error: err?.message || 'Server error' });
  }
};

export default handler;
