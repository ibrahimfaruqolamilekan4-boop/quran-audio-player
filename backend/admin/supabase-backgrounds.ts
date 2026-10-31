// Admin API for Supabase / Neon backgrounds management
// Supports: list all (including inactive and drafts), add, update, delete, reorder, publish, signed-upload-url, upload
import { type Handler, q, requireAdmin, sendJson } from '../_lib.mjs';
import { readJsonLarge } from '../media-lib.mjs';
import { ensureBackgroundsTable } from '../backgrounds';
import { getSupabaseAdmin } from '../lib/supabase-server';

const handler: Handler = async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await ensureBackgroundsTable().catch(() => {});

    // GET /api/admin/supabase-backgrounds -> list all backgrounds including drafts
    if (req.method === 'GET') {
      const sb = getSupabaseAdmin();
      if (sb) {
        try {
          const { data, error } = await sb
            .from('backgrounds')
            .select('*')
            .order('sort_order', { ascending: true });
          if (!error && Array.isArray(data)) {
            return sendJson(res, 200, { backgrounds: data });
          }
        } catch (e) {
          console.warn('Supabase admin GET backgrounds notice:', e);
        }
      }

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
        const bucket = String(body.bucket || 'ambient-backgrounds');
        const filename = String(body.filename || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = body.path ? String(body.path) : `backgrounds/${Date.now()}_${filename}`;

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
        const renditions = Array.isArray(body.renditions) ? body.renditions : [];
        const storage_paths = Array.isArray(body.storage_paths) ? body.storage_paths : [];
        const attribution = body.attribution ? String(body.attribution).trim() : null;
        const sort_order = Number(body.sort_order || 0);
        // By default, new uploads go live immediately so they play instantly
        const is_active = body.is_active !== undefined ? Boolean(body.is_active) : true;
        const is_draft = body.is_draft !== undefined ? Boolean(body.is_draft) : false;
        const is_premium = Boolean(body.is_premium);

        if (!name_en || !video_url) {
          return sendJson(res, 400, { error: 'name_en and video_url are required.' });
        }

        // 1. Primary: Save directly to Supabase via Service Role (Bypasses RLS)
        const sb = getSupabaseAdmin();
        if (sb) {
          try {
            const { error: sbErr } = await sb.from('backgrounds').upsert(
              {
                id,
                name_en,
                name_ar,
                category,
                video_url,
                video_url_720p,
                video_url_480p,
                poster_url,
                size_bytes,
                duration_seconds,
                renditions,
                storage_paths,
                attribution,
                sort_order,
                is_active,
                is_draft,
                is_premium,
              },
              { onConflict: 'id' }
            );
            if (sbErr) console.warn('Supabase service role backgrounds upsert warning:', sbErr.message);
          } catch (e) {
            console.warn('Supabase service role write exception:', e);
          }
        }

        // 2. Secondary: Save to Neon database if active
        try {
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
              poster_url, size_bytes, duration_seconds, JSON.stringify(renditions), JSON.stringify(storage_paths),
              attribution, sort_order, is_active, is_draft, is_premium
            ]
          );
        } catch (dbErr) {
          console.warn('Neon backgrounds write notice:', dbErr);
        }

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
        const renditions = body.renditions !== undefined ? (Array.isArray(body.renditions) ? body.renditions : []) : undefined;
        const storage_paths = body.storage_paths !== undefined ? (Array.isArray(body.storage_paths) ? body.storage_paths : []) : undefined;
        const attribution = body.attribution !== undefined ? (body.attribution ? String(body.attribution).trim() : null) : undefined;
        const sort_order = body.sort_order !== undefined ? Number(body.sort_order) : undefined;
        const is_active = body.is_active !== undefined ? Boolean(body.is_active) : undefined;
        const is_draft = body.is_draft !== undefined ? Boolean(body.is_draft) : undefined;
        const is_premium = body.is_premium !== undefined ? Boolean(body.is_premium) : undefined;

        // 1. Update in Supabase via Service Role
        const sb = getSupabaseAdmin();
        if (sb) {
          try {
            const updatePayload: Record<string, any> = {};
            if (name_en !== undefined) updatePayload.name_en = name_en;
            if (name_ar !== undefined) updatePayload.name_ar = name_ar;
            if (category !== undefined) updatePayload.category = category;
            if (video_url !== undefined) updatePayload.video_url = video_url;
            if (video_url_720p !== undefined) updatePayload.video_url_720p = video_url_720p;
            if (video_url_480p !== undefined) updatePayload.video_url_480p = video_url_480p;
            if (poster_url !== undefined) updatePayload.poster_url = poster_url;
            if (size_bytes !== undefined) updatePayload.size_bytes = size_bytes;
            if (duration_seconds !== undefined) updatePayload.duration_seconds = duration_seconds;
            if (renditions !== undefined) updatePayload.renditions = renditions;
            if (storage_paths !== undefined) updatePayload.storage_paths = storage_paths;
            if (attribution !== undefined) updatePayload.attribution = attribution;
            if (sort_order !== undefined) updatePayload.sort_order = sort_order;
            if (is_active !== undefined) updatePayload.is_active = is_active;
            if (is_draft !== undefined) updatePayload.is_draft = is_draft;
            if (is_premium !== undefined) updatePayload.is_premium = is_premium;

            await sb.from('backgrounds').update(updatePayload).eq('id', id);
          } catch (e) {
            console.warn('Supabase admin backgrounds update notice:', e);
          }
        }

        // 2. Update in Neon
        try {
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
              poster_url, size_bytes, duration_seconds, renditions ? JSON.stringify(renditions) : null, storage_paths ? JSON.stringify(storage_paths) : null,
              attribution, sort_order, is_active, is_draft, is_premium
            ]
          );
        } catch (dbErr) {
          console.warn('Neon backgrounds update notice:', dbErr);
        }

        return sendJson(res, 200, { ok: true });
      }

      if (action === 'signed-upload-url') {
        const path = String(body.path || '').replace(/^\/+/, '');
        if (!path) return sendJson(res, 400, { error: 'Path is required' });

        const sb = getSupabaseAdmin();
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
        if (sb) {
          try {
            const { data, error } = await sb.storage
              .from('ambient-backgrounds')
              .createSignedUploadUrl(path);

            if (!error && data?.signedUrl) {
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/ambient-backgrounds/${path}`;
              return sendJson(res, 200, {
                ok: true,
                signedUrl: data.signedUrl,
                token: data.token,
                publicUrl,
              });
            }
          } catch (e: any) {
            console.warn('createSignedUploadUrl error:', e?.message);
          }
        }

        // Fallback: direct public URL
        const fallbackPublicUrl = `${supabaseUrl}/storage/v1/object/public/ambient-backgrounds/${path}`;
        return sendJson(res, 200, { ok: false, fallbackPublicUrl });
      }

      if (action === 'upload') {
        const path = String(body.path || '').replace(/^\/+/, '');
        const contentType = String(body.contentType || 'video/mp4');
        const base64Data = String(body.data || '');
        if (!path || !base64Data) return sendJson(res, 400, { error: 'Path and data are required' });

        const buffer = Buffer.from(base64Data, 'base64');
        const sb = getSupabaseAdmin();
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
        if (sb) {
          try {
            const { data, error } = await sb.storage
              .from('ambient-backgrounds')
              .upload(path, buffer, {
                contentType,
                upsert: true,
              });

            if (!error) {
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/ambient-backgrounds/${path}`;
              return sendJson(res, 200, { ok: true, publicUrl });
            }
            console.warn('Supabase service role upload error:', error);
          } catch (e: any) {
            console.warn('Upload exception:', e);
          }
        }

        return sendJson(res, 500, { error: 'Could not upload to storage.' });
      }

      if (action === 'delete') {
        const id = String(body.id || '');
        if (!id) return sendJson(res, 400, { error: 'ID is required' });

        // 1. Delete from Supabase via Service Role
        const sb = getSupabaseAdmin();
        if (sb) {
          try {
            await sb.from('backgrounds').delete().eq('id', id);
          } catch (e) {
            console.warn('Supabase delete background notice:', e);
          }
        }

        // 2. Delete from Neon
        let paths: string[] = [];
        try {
          const existing = await q('SELECT storage_paths FROM backgrounds WHERE id = $1', [id]);
          await q('DELETE FROM backgrounds WHERE id = $1', [id]);
          paths = existing.rows?.[0]?.storage_paths || [];
        } catch (dbErr) {
          console.warn('Neon delete background notice:', dbErr);
        }

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
