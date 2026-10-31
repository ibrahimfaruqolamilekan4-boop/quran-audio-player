import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireAdmin, readJson, sendJson, getSupabaseAdmin, q } from '../_lib.mjs';
import { ensureAdhanVoicesTable } from '../adhan-voices';

const handler = async (req: IncomingMessage, res: ServerResponse) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  await ensureAdhanVoicesTable();

  try {
    // GET /api/admin/adhan-voices -> list all voices
    if (req.method === 'GET') {
      const sb = getSupabaseAdmin();
      if (sb) {
        try {
          const { data, error } = await sb
            .from('adhan_voices')
            .select('*')
            .order('created_at', { ascending: true });
          if (!error && Array.isArray(data)) {
            return sendJson(res, 200, { voices: data });
          }
        } catch (sbErr) {
          console.warn('[admin/adhan-voices] Supabase query notice:', sbErr);
        }
      }

      const result = await q(`
        SELECT id, name_en, name_ar, muezzin, mosque, audio_url, fajr_audio_url,
               duration, license, source, attribution, is_active, is_premium, created_at
        FROM adhan_voices
        ORDER BY created_at ASC
      `);
      return sendJson(res, 200, { voices: result.rows || [] });
    }

    // POST /api/admin/adhan-voices
    if (req.method === 'POST') {
      const body = await readJson(req);
      const action = String(body.action || 'add');

      // 1. Signed Storage Upload URL for audio files
      if (action === 'signed-upload-url') {
        const sb = getSupabaseAdmin();
        if (!sb) {
          return sendJson(res, 500, { error: 'Supabase admin client not initialized' });
        }
        const filename = String(body.filename || 'adhan.mp3').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `adhan/${Date.now()}_${filename}`;

        const { data, error } = await sb.storage
          .from('ambient-backgrounds')
          .createSignedUploadUrl(path);

        if (error || !data) {
          return sendJson(res, 500, { error: error?.message || 'Could not generate signed upload URL' });
        }

        const { data: publicUrlData } = sb.storage.from('ambient-backgrounds').getPublicUrl(path);

        return sendJson(res, 200, {
          signedUrl: data.signedUrl,
          token: data.token,
          path: data.path,
          publicUrl: publicUrlData.publicUrl,
        });
      }

      // 2. Add Voice
      if (action === 'add') {
        const id = String(body.id || `voice_${Date.now()}`).trim();
        const name_en = String(body.name_en || '').trim();
        const name_ar = body.name_ar ? String(body.name_ar).trim() : null;
        const muezzin = String(body.muezzin || '').trim();
        const mosque = body.mosque ? String(body.mosque).trim() : null;
        const audio_url = body.audio_url ? String(body.audio_url).trim() : null;
        const fajr_audio_url = body.fajr_audio_url ? String(body.fajr_audio_url).trim() : null;
        const duration = Number(body.duration || 0);
        const license = body.license ? String(body.license).trim() : 'Upload when licensed';
        const source = body.source ? String(body.source).trim() : null;
        const attribution = body.attribution ? String(body.attribution).trim() : null;
        const is_active = body.is_active !== undefined ? Boolean(body.is_active) : true;
        const is_premium = Boolean(body.is_premium);

        if (!name_en || !muezzin) {
          return sendJson(res, 400, { error: 'name_en and muezzin are required fields.' });
        }

        const record = {
          id,
          name_en,
          name_ar,
          muezzin,
          mosque,
          audio_url,
          fajr_audio_url,
          duration,
          license,
          source,
          attribution,
          is_active,
          is_premium,
        };

        const sb = getSupabaseAdmin();
        if (sb) {
          try {
            await sb.from('adhan_voices').upsert(record);
          } catch (sbErr) {
            console.warn('[admin/adhan-voices] Supabase upsert note:', sbErr);
          }
        }

        await q(
          `INSERT INTO adhan_voices (
             id, name_en, name_ar, muezzin, mosque, audio_url, fajr_audio_url,
             duration, license, source, attribution, is_active, is_premium, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
           ON CONFLICT (id) DO UPDATE SET
             name_en = EXCLUDED.name_en,
             name_ar = EXCLUDED.name_ar,
             muezzin = EXCLUDED.muezzin,
             mosque = EXCLUDED.mosque,
             audio_url = EXCLUDED.audio_url,
             fajr_audio_url = EXCLUDED.fajr_audio_url,
             duration = EXCLUDED.duration,
             license = EXCLUDED.license,
             source = EXCLUDED.source,
             attribution = EXCLUDED.attribution,
             is_active = EXCLUDED.is_active,
             is_premium = EXCLUDED.is_premium`,
          [
            id, name_en, name_ar, muezzin, mosque, audio_url, fajr_audio_url,
            duration, license, source, attribution, is_active, is_premium,
          ]
        ).catch(() => {});

        return sendJson(res, 201, { voice: record });
      }

      // 3. Update Voice
      if (action === 'update') {
        const id = String(body.id || '').trim();
        if (!id) return sendJson(res, 400, { error: 'Voice id is required' });

        const sb = getSupabaseAdmin();
        const updateData: any = {};
        if (body.name_en !== undefined) updateData.name_en = String(body.name_en).trim();
        if (body.name_ar !== undefined) updateData.name_ar = body.name_ar ? String(body.name_ar).trim() : null;
        if (body.muezzin !== undefined) updateData.muezzin = String(body.muezzin).trim();
        if (body.mosque !== undefined) updateData.mosque = body.mosque ? String(body.mosque).trim() : null;
        if (body.audio_url !== undefined) updateData.audio_url = body.audio_url ? String(body.audio_url).trim() : null;
        if (body.fajr_audio_url !== undefined) updateData.fajr_audio_url = body.fajr_audio_url ? String(body.fajr_audio_url).trim() : null;
        if (body.duration !== undefined) updateData.duration = Number(body.duration || 0);
        if (body.license !== undefined) updateData.license = String(body.license).trim();
        if (body.attribution !== undefined) updateData.attribution = body.attribution ? String(body.attribution).trim() : null;
        if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);
        if (body.is_premium !== undefined) updateData.is_premium = Boolean(body.is_premium);

        if (sb) {
          await sb.from('adhan_voices').update(updateData).eq('id', id);
        }

        return sendJson(res, 200, { updated: true });
      }

      // 4. Toggle Active / Premium
      if (action === 'toggle-active' || action === 'toggle-premium') {
        const id = String(body.id || '').trim();
        const value = Boolean(body.value);
        const column = action === 'toggle-active' ? 'is_active' : 'is_premium';

        const sb = getSupabaseAdmin();
        if (sb) {
          await sb.from('adhan_voices').update({ [column]: value }).eq('id', id);
        }
        await q(`UPDATE adhan_voices SET ${column} = $1 WHERE id = $2`, [value, id]).catch(() => {});

        return sendJson(res, 200, { success: true });
      }

      // 5. Delete Voice
      if (action === 'delete') {
        const id = String(body.id || '').trim();
        if (!id) return sendJson(res, 400, { error: 'id required' });

        const sb = getSupabaseAdmin();
        if (sb) {
          await sb.from('adhan_voices').delete().eq('id', id);
        }
        await q('DELETE FROM adhan_voices WHERE id = $1', [id]).catch(() => {});

        return sendJson(res, 200, { deleted: true });
      }

      return sendJson(res, 400, { error: `Unsupported action: ${action}` });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Admin adhan-voices error:', err);
    return sendJson(res, 500, { error: err?.message || 'Server error' });
  }
};

export default handler;
