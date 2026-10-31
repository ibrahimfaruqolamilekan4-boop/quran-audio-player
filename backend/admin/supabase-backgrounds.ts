// Admin API for Supabase / Neon backgrounds management
// Supports: list all (including inactive and drafts), add, update, delete, reorder, publish, signed-upload-url
import { type Handler, q, requireAdmin, sendJson, getSupabaseAdmin } from '../_lib.mjs';
import { readJsonLarge } from '../media-lib.mjs';
import { ensureBackgroundsTable } from '../backgrounds';

const handler: Handler = async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await ensureBackgroundsTable().catch(() => {});

    // GET /api/admin/supabase-backgrounds -> list all backgrounds including drafts
    if (req.method === 'GET') {
      const result = await q(`
        SELECT id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p, poster_url, size_bytes, duration_seconds, renditions, storage_paths, attribution, sort_order, is_active, is_draft, is_premium, created_at
        FROM backgrounds
        ORDER BY sort_order ASC, created_at DESC
      `);
      return sendJson(res, 200, { backgrounds: result.rows });
    }

    // POST /api/admin/supabase-backgrounds
    if (req.method === 'POST') {
      const body = await readJsonLarge(req);
      const action = body.action || 'add';

      // Signed Upload URL for 1-Click Fast Background Video & Poster Upload (bypasses RLS issues)
      if (action === 'signed-upload-url') {
        const sb = getSupabaseAdmin();
        if (!sb) {
          return sendJson(res, 500, { error: 'Supabase admin client not initialized' });
        }
        const filename = String(body.filename || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
        const bucket = String(body.bucket || 'ambient-backgrounds');
        const path = `backgrounds/${Date.now()}_${filename}`;

        const { data, error } = await sb.storage
          .from(bucket)
          .createSignedUploadUrl(path);

        if (error || !data) {
          return sendJson(res, 500, { error: error?.message || 'Could not generate signed upload URL' });
        }

        const { data: publicUrlData } = sb.storage.from(bucket).getPublicUrl(path);

        return sendJson(res, 200, {
          signedUrl: data.signedUrl,
          token: data.token,
          path: data.path,
          publicUrl: publicUrlData.publicUrl,
        });
      }

      if (action === 'add') {
        const id = body.id || `bg_${Date.now()}`;
        const name_en = String(body.name_en || '').trim();
        const name_ar = body.name_ar ? String(body.name_ar).trim() : null;
        const category = String(body.category || 'general').trim().toLowerCase();
        const video_url = String(body.video_url || '').trim();
        const video_url_720p = body.video_url_720p ? String(body.video_url_720p).trim() : video_url;
        const video_url_480p = body.video_url_480p ? String(body.video_url_480p).trim() : null;
        const poster_url = body.poster_url ? String(body.poster_url).trim() : null;
        const size_bytes = Number(body.size_bytes || 0);
        const duration_seconds = Number(body.duration_seconds || 0);
        const renditions = JSON.stringify(body.renditions || []);
        const storage_paths = JSON.stringify(body.storage_paths || []);
        const attribution = body.attribution ? String(body.attribution).trim() : null;
        const sort_order = Number(body.sort_order || 0);
        // By default, new uploads go live immediately so they play instantly
        const is_active = body.is_active !== undefined ? Boolean(body.is_active) : true;
        const is_draft = body.is_draft !== undefined ? Boolean(body.is_draft) : false;
        const is_premium = Boolean(body.is_premium);

        if (!name_en || !video_url) {
          return sendJson(res, 400, { error: 'name_en and video_url are required.' });
        }

        await q(
          `INSERT INTO backgrounds (
             id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
             poster_url, size_bytes, duration_seconds, renditions, storage_paths,
             attribution, sort_order, is_active, is_draft, is_premium, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())
           ON CONFLICT (id) DO UPDATE SET
             name_en = EXCLUDED.name_en,
             name_ar = EXCLUDED.name_ar,
             category = EXCLUDED.category,
             video_url = EXCLUDED.video_url,
             video_url_720p = EXCLUDED.video_url_720p,
             video_url_480p = EXCLUDED.video_url_480p,
             poster_url = EXCLUDED.poster_url,
             size_bytes = EXCLUDED.size_bytes,
             duration_seconds = EXCLUDED.duration_seconds,
             renditions = EXCLUDED.renditions,
             storage_paths = EXCLUDED.storage_paths,
             attribution = EXCLUDED.attribution,
             sort_order = EXCLUDED.sort_order,
             is_active = EXCLUDED.is_active,
             is_draft = EXCLUDED.is_draft,
             is_premium = EXCLUDED.is_premium`,
          [
            id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
            poster_url, size_bytes, duration_seconds, renditions, storage_paths,
            attribution, sort_order, is_active, is_draft, is_premium
          ]
        );

        return sendJson(res, 201, {
          ok: true,
          background: {
            id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
            poster_url, size_bytes, duration_seconds, sort_order, is_active, is_draft, is_premium
          },
        });
      }

      if (action === 'update') {
        const id = String(body.id || '');
        if (!id) return sendJson(res, 400, { error: 'ID is required' });

        const name_en = body.name_en !== undefined ? String(body.name_en).trim() : undefined;
        const name_ar = body.name_ar !== undefined ? (body.name_ar ? String(body.name_ar).trim() : null) : undefined;
        const category = body.category !== undefined ? String(body.category).trim().toLowerCase() : undefined;
        const video_url = body.video_url !== undefined ? String(body.video_url).trim() : undefined;
        const video_url_720p = body.video_url_720p !== undefined ? String(body.video_url_720p).trim() : undefined;
        const video_url_480p = body.video_url_480p !== undefined ? (body.video_url_480p ? String(body.video_url_480p).trim() : null) : undefined;
        const poster_url = body.poster_url !== undefined ? (body.poster_url ? String(body.poster_url).trim() : null) : undefined;
        const size_bytes = body.size_bytes !== undefined ? Number(body.size_bytes) : undefined;
        const duration_seconds = body.duration_seconds !== undefined ? Number(body.duration_seconds) : undefined;
        const renditions = body.renditions !== undefined ? JSON.stringify(body.renditions) : undefined;
        const storage_paths = body.storage_paths !== undefined ? JSON.stringify(body.storage_paths) : undefined;
        const attribution = body.attribution !== undefined ? (body.attribution ? String(body.attribution).trim() : null) : undefined;
        const sort_order = body.sort_order !== undefined ? Number(body.sort_order) : undefined;
        const is_active = body.is_active !== undefined ? Boolean(body.is_active) : undefined;
        const is_draft = body.is_draft !== undefined ? Boolean(body.is_draft) : undefined;
        const is_premium = body.is_premium !== undefined ? Boolean(body.is_premium) : undefined;

        await q(
          `UPDATE backgrounds
           SET name_en = COALESCE($2, name_en),
               name_ar = COALESCE($3, name_ar),
               category = COALESCE($4, category),
               video_url = COALESCE($5, video_url),
               video_url_720p = COALESCE($6, video_url_720p),
               video_url_480p = COALESCE($7, video_url_480p),
               poster_url = COALESCE($8, poster_url),
               size_bytes = COALESCE($9, size_bytes),
               duration_seconds = COALESCE($10, duration_seconds),
               renditions = COALESCE($11::jsonb, renditions),
               storage_paths = COALESCE($12::jsonb, storage_paths),
               attribution = COALESCE($13, attribution),
               sort_order = COALESCE($14, sort_order),
               is_active = COALESCE($15, is_active),
               is_draft = COALESCE($16, is_draft),
               is_premium = COALESCE($17, is_premium)
           WHERE id = $1`,
          [
            id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
            poster_url, size_bytes, duration_seconds, renditions, storage_paths,
            attribution, sort_order, is_active, is_draft, is_premium
          ]
        );

        return sendJson(res, 200, { ok: true });
      }

      if (action === 'delete') {
        const id = String(body.id || '');
        if (!id) return sendJson(res, 400, { error: 'ID is required' });

        // Retrieve storage_paths if available to return to caller for storage cleanup
        const existing = await q('SELECT storage_paths FROM backgrounds WHERE id = $1', [id]);
        await q('DELETE FROM backgrounds WHERE id = $1', [id]);

        const paths = existing.rows?.[0]?.storage_paths || [];
        return sendJson(res, 200, { ok: true, deleted_storage_paths: paths });
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
