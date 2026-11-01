// Admin API for Supabase / Neon / Cloud Store backgrounds management
// Supports: list all (including inactive and drafts), add, update, delete, reorder, signed-upload-url, upload
import { type Handler, q, requireAdmin, sendJson, APPROVED_NASA_BACKGROUNDS } from '../_lib.mjs';
import { readJsonLarge } from '../media-lib.mjs';
import { ensureBackgroundsTable, bumpBackgroundsVersion } from '../backgrounds';
import { getSupabaseAdmin } from '../lib/supabase-server';

const handler: Handler = async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await ensureBackgroundsTable().catch(() => {});

    // GET /api/admin/supabase-backgrounds -> list all backgrounds including hidden & drafts
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const byId = new Map<string, any>();

      const sb = getSupabaseAdmin();
      if (sb) {
        try {
          const { data, error } = await sb
            .from('backgrounds')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
          if (!error && Array.isArray(data)) {
            for (const row of data) {
              byId.set(row.id, row);
            }
          }
        } catch (e) {
          console.warn('Supabase admin GET backgrounds notice:', e);
        }
      }

      try {
        const result = await q(`
          SELECT id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p, poster_url,
                 size_bytes, duration_seconds, renditions, storage_paths, attribution,
                 source_url, creator, license_name, license_url, date_checked, attribution_required,
                 sort_order, is_active, is_draft, is_premium, created_at
          FROM backgrounds
          ORDER BY sort_order ASC, created_at DESC
        `);
        for (const row of result.rows || []) {
          if (!byId.has(row.id)) {
            byId.set(row.id, row);
          } else {
            // Merge any newly updated local/Postgres fields
            byId.set(row.id, { ...byId.get(row.id), ...row });
          }
        }
      } catch (e) {
        console.warn('Local/Postgres admin GET backgrounds notice:', e);
      }

      const backgrounds = Array.from(byId.values()).sort((a, b) => {
        const sa = Number(a.sort_order ?? 0);
        const sbOrder = Number(b.sort_order ?? 0);
        if (sa !== sbOrder) return sa - sbOrder;
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });

      return sendJson(res, 200, { backgrounds });
    }

    // POST /api/admin/supabase-backgrounds
    if (req.method === 'POST') {
      const body = await readJsonLarge(req);
      const action = body.action || 'add';

      if (action === 'add') {
        const id = body.id || `bg_${Date.now()}`;
        const name_en = String(body.name_en || '').trim();
        const name_ar = body.name_ar ? String(body.name_ar).trim() : null;
        const category = String(body.category || 'nature').trim().toLowerCase();
        const video_url = String(body.video_url || '').trim();
        const video_url_720p = body.video_url_720p ? String(body.video_url_720p).trim() : video_url;
        const video_url_480p = body.video_url_480p ? String(body.video_url_480p).trim() : null;
        const poster_url = body.poster_url ? String(body.poster_url).trim() : null;
        const size_bytes = Number(body.size_bytes || 0);
        const duration_seconds = Number(body.duration_seconds || 0);
        const renditions = Array.isArray(body.renditions) ? body.renditions : [];
        const storage_paths = Array.isArray(body.storage_paths) ? body.storage_paths : [];
        const attribution = body.attribution ? String(body.attribution).trim() : null;
        const source_url = body.source_url ? String(body.source_url).trim() : null;
        const creator = body.creator ? String(body.creator).trim() : null;
        const license_name = body.license_name ? String(body.license_name).trim() : null;
        const license_url = body.license_url ? String(body.license_url).trim() : null;
        const date_checked = body.date_checked ? String(body.date_checked).trim() : null;
        const attribution_required = Boolean(body.attribution_required);
        const sort_order = Number(body.sort_order || 0);
        // PUBLISH IMMEDIATELY BY DEFAULT: is_active = true unless explicitly false
        const is_active = body.is_active !== undefined ? Boolean(body.is_active) : true;
        const is_draft = body.is_draft !== undefined ? Boolean(body.is_draft) : false;
        const is_premium = Boolean(body.is_premium);

        if (!name_en || !video_url) {
          return sendJson(res, 400, { error: 'Video name and video URL are required.' });
        }

        let savedToSupabase = false;
        let savedToDatabase = false;
        let lastSaveError = '';

        // 1. Primary: Save directly to Supabase via Service Role (Bypasses RLS)
        const sb = getSupabaseAdmin();
        if (sb) {
          try {
            const fullPayload: Record<string, any> = {
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
              source_url,
              creator,
              license_name,
              license_url,
              date_checked,
              attribution_required,
              sort_order,
              is_active,
              is_draft,
              is_premium,
            };
            let { error: sbErr } = await sb.from('backgrounds').upsert(fullPayload, { onConflict: 'id' });
            if (sbErr && sbErr.message?.includes('column')) {
              // Retry without optional licence columns if SQL migration hasn't been run yet
              const {
                source_url: _su,
                creator: _cr,
                license_name: _ln,
                license_url: _lu,
                date_checked: _dc,
                attribution_required: _ar,
                ...corePayload
              } = fullPayload;
              const retry = await sb.from('backgrounds').upsert(corePayload, { onConflict: 'id' });
              sbErr = retry.error;
            }
            if (!sbErr) {
              savedToSupabase = true;
            } else {
              lastSaveError = `Supabase error: ${sbErr.message}`;
              console.warn('Supabase service role backgrounds upsert warning:', sbErr.message);
            }
          } catch (e: any) {
            lastSaveError = e?.message || 'Supabase write exception';
            console.warn('Supabase service role write exception:', e);
          }
        }

        // 2. Secondary: Save to Postgres / persistent serverStore
        try {
          await q(
            `INSERT INTO backgrounds (
               id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
               poster_url, size_bytes, duration_seconds, renditions, storage_paths,
               attribution, sort_order, is_active, is_draft, is_premium,
               source_url, creator, license_name, license_url, date_checked, attribution_required,
               created_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, now())
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
               is_premium = EXCLUDED.is_premium,
               source_url = EXCLUDED.source_url,
               creator = EXCLUDED.creator,
               license_name = EXCLUDED.license_name,
               license_url = EXCLUDED.license_url,
               date_checked = EXCLUDED.date_checked,
               attribution_required = EXCLUDED.attribution_required`,
            [
              id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
              poster_url, size_bytes, duration_seconds, JSON.stringify(renditions), JSON.stringify(storage_paths),
              attribution, sort_order, is_active, is_draft, is_premium,
              source_url, creator, license_name, license_url, date_checked, attribution_required,
            ]
          );
          savedToDatabase = true;
        } catch (dbErr: any) {
          lastSaveError = dbErr?.message || String(dbErr);
          console.warn('Database backgrounds write notice:', dbErr);
        }

        if (!savedToSupabase && !savedToDatabase) {
          return sendJson(res, 500, {
            error: `Upload worked, but saving the database row failed: ${lastSaveError || 'permission or schema error'}`,
          });
        }

        const version = await bumpBackgroundsVersion();

        return sendJson(res, 201, {
          ok: true,
          version,
          background: {
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
            source_url,
            creator,
            license_name,
            license_url,
            date_checked,
            attribution_required,
            sort_order,
            is_active,
            is_draft,
            is_premium,
            created_at: new Date().toISOString(),
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
        const source_url = body.source_url !== undefined ? (body.source_url ? String(body.source_url).trim() : null) : undefined;
        const creator = body.creator !== undefined ? (body.creator ? String(body.creator).trim() : null) : undefined;
        const license_name = body.license_name !== undefined ? (body.license_name ? String(body.license_name).trim() : null) : undefined;
        const license_url = body.license_url !== undefined ? (body.license_url ? String(body.license_url).trim() : null) : undefined;
        const date_checked = body.date_checked !== undefined ? (body.date_checked ? String(body.date_checked).trim() : null) : undefined;
        const attribution_required = body.attribution_required !== undefined ? Boolean(body.attribution_required) : undefined;
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
            if (source_url !== undefined) updatePayload.source_url = source_url;
            if (creator !== undefined) updatePayload.creator = creator;
            if (license_name !== undefined) updatePayload.license_name = license_name;
            if (license_url !== undefined) updatePayload.license_url = license_url;
            if (date_checked !== undefined) updatePayload.date_checked = date_checked;
            if (attribution_required !== undefined) updatePayload.attribution_required = attribution_required;
            if (sort_order !== undefined) updatePayload.sort_order = sort_order;
            if (is_active !== undefined) updatePayload.is_active = is_active;
            if (is_draft !== undefined) updatePayload.is_draft = is_draft;
            if (is_premium !== undefined) updatePayload.is_premium = is_premium;

            await sb.from('backgrounds').update(updatePayload).eq('id', id);
          } catch (e) {
            console.warn('Supabase admin backgrounds update notice:', e);
          }
        }

        // 2. Update in Postgres / persistent serverStore
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
                 is_premium = COALESCE($17, is_premium),
                 source_url = COALESCE($18, source_url),
                 creator = COALESCE($19, creator),
                 license_name = COALESCE($20, license_name),
                 license_url = COALESCE($21, license_url),
                 date_checked = COALESCE($22, date_checked),
                 attribution_required = COALESCE($23, attribution_required)
             WHERE id = $1`,
            [
              id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
              poster_url, size_bytes, duration_seconds, renditions ? JSON.stringify(renditions) : null, storage_paths ? JSON.stringify(storage_paths) : null,
              attribution, sort_order, is_active, is_draft, is_premium,
              source_url, creator, license_name, license_url, date_checked, attribution_required,
            ]
          );
        } catch (dbErr) {
          console.warn('Database backgrounds update notice:', dbErr);
        }

        const version = await bumpBackgroundsVersion();
        return sendJson(res, 200, { ok: true, version });
      }

      if (action === 'reorder') {
        const order: Array<{ id: string; sort_order: number }> = Array.isArray(body.order) ? body.order : [];
        const sb = getSupabaseAdmin();
        for (const item of order) {
          if (!item?.id) continue;
          const sortVal = Number(item.sort_order ?? 0);
          if (sb) {
            try {
              await sb.from('backgrounds').update({ sort_order: sortVal }).eq('id', item.id);
            } catch {}
          }
          try {
            await q(
              `UPDATE backgrounds
               SET name_en = COALESCE($2, name_en),
                   sort_order = COALESCE($14, sort_order)
               WHERE id = $1`,
              [
                item.id, undefined, undefined, undefined, undefined, undefined, undefined,
                undefined, undefined, undefined, null, null,
                undefined, sortVal, undefined, undefined, undefined,
                undefined, undefined, undefined, undefined, undefined, undefined,
              ]
            );
          } catch {}
        }
        const version = await bumpBackgroundsVersion();
        return sendJson(res, 200, { ok: true, version });
      }

      if (action === 'signed-upload-url') {
        const path = String(body.path || '').replace(/^\/+/, '');
        if (!path) return sendJson(res, 400, { error: 'Path is required' });

        const sb = getSupabaseAdmin();
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
        if (sb && supabaseUrl) {
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

        const fallbackPublicUrl = supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/ambient-backgrounds/${path}`
          : `/api/media/${path.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
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
        if (sb && supabaseUrl) {
          try {
            const { error } = await sb.storage
              .from('ambient-backgrounds')
              .upload(path, buffer, {
                contentType,
                upsert: true,
                cacheControl: '31536000',
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

        // Resilient fallback: store in global_media so `/api/media/:id` serves it with HTTP Range support
        const mediaId = `bgmedia_${Date.now()}_${path.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-36)}`;
        const dataUrl = `data:${contentType};base64,${base64Data}`;
        await q(
          'INSERT INTO global_media (id, kind, mime_type, data_url) VALUES ($1, $2, $3, $4)',
          [mediaId, contentType.startsWith('image/') ? 'image' : 'video', contentType, dataUrl]
        );
        return sendJson(res, 200, { ok: true, publicUrl: `/api/media/${mediaId}` });
      }

      if (action === 'delete') {
        const id = String(body.id || '');
        if (!id) return sendJson(res, 400, { error: 'ID is required' });

        let paths: string[] = [];
        const sb = getSupabaseAdmin();
        if (sb) {
          try {
            const { data: existingRow } = await sb.from('backgrounds').select('storage_paths').eq('id', id).maybeSingle();
            if (Array.isArray(existingRow?.storage_paths)) {
              paths = existingRow.storage_paths;
            }
            await sb.from('backgrounds').delete().eq('id', id);
            if (paths.length > 0) {
              await sb.storage.from('ambient-backgrounds').remove(paths.map((p: string) => p.replace(/^\/+/, '')));
            }
          } catch (e) {
            console.warn('Supabase delete background notice:', e);
          }
        }

        try {
          const existing = await q('SELECT storage_paths FROM backgrounds WHERE id = $1', [id]);
          await q('DELETE FROM backgrounds WHERE id = $1', [id]);
          if (paths.length === 0 && Array.isArray(existing.rows?.[0]?.storage_paths)) {
            paths = existing.rows[0].storage_paths;
          }
        } catch (dbErr) {
          console.warn('Database delete background notice:', dbErr);
        }

        const version = await bumpBackgroundsVersion();
        return sendJson(res, 200, { ok: true, version, deleted_storage_paths: paths });
      }

      if (action === 'seed-approved-nasa') {
        const targetId = body.id ? String(body.id) : null;
        const scenes = targetId
          ? APPROVED_NASA_BACKGROUNDS.filter((b: any) => b.id === targetId)
          : APPROVED_NASA_BACKGROUNDS;

        const sb = getSupabaseAdmin();
        for (const nb of scenes) {
          if (sb) {
            try {
              await sb.from('backgrounds').upsert(nb, { onConflict: 'id' });
            } catch {}
          }
          try {
            await q(
              `INSERT INTO backgrounds (
                 id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
                 poster_url, size_bytes, duration_seconds, renditions, storage_paths,
                 attribution, sort_order, is_active, is_draft, is_premium,
                 source_url, creator, license_name, license_url, date_checked, attribution_required,
                 created_at
               )
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, now())
               ON CONFLICT (id) DO UPDATE SET
                 is_active = true,
                 is_draft = false,
                 video_url = EXCLUDED.video_url,
                 video_url_720p = EXCLUDED.video_url_720p,
                 video_url_480p = EXCLUDED.video_url_480p,
                 poster_url = EXCLUDED.poster_url,
                 source_url = EXCLUDED.source_url,
                 creator = EXCLUDED.creator,
                 license_name = EXCLUDED.license_name,
                 license_url = EXCLUDED.license_url,
                 date_checked = EXCLUDED.date_checked`,
              [
                nb.id, nb.name_en, nb.name_ar, nb.category, nb.video_url, nb.video_url_720p, nb.video_url_480p,
                nb.poster_url, nb.size_bytes, nb.duration_seconds, JSON.stringify(nb.renditions || []), JSON.stringify(nb.storage_paths || []),
                nb.attribution, nb.sort_order, true, false, nb.is_premium,
                nb.source_url, nb.creator, nb.license_name, nb.license_url, nb.date_checked, nb.attribution_required,
              ]
            );
          } catch {}
        }

        const version = await bumpBackgroundsVersion();
        return sendJson(res, 200, { ok: true, count: scenes.length, version });
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
