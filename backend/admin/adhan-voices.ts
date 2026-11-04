// Admin API for Adhan voices management (Supabase + Postgres/ServerStore + Realtime version counter)
// Supports: list all (including inactive), add, update, delete, reorder, set-default, signed-upload-url, upload, seed-official-slots
import { type Handler, q, requireAdmin, sendJson } from '../_lib.mjs';
import { readJsonLarge } from '../media-lib.mjs';
import {
  ensureAdhanVoicesTable,
  bumpAdhanVoicesVersion,
  getActiveAdhanVoicesAndVersion,
  OFFICIAL_MUEZZIN_SLOTS,
} from '../adhan-voices';
import { getSupabaseAdmin } from '../lib/supabase-server';

const handler: Handler = async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await ensureAdhanVoicesTable().catch(() => {});

    // GET /api/admin/adhan-voices -> list all voices including inactive
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const { voices, version, updated_at } = await getActiveAdhanVoicesAndVersion(true);
      return sendJson(res, 200, { voices, version, updated_at });
    }

    // POST /api/admin/adhan-voices
    if (req.method === 'POST') {
      const body = await readJsonLarge(req);
      const action = body.action || 'add';

      if (action === 'add' || action === 'update') {
        const id = String(body.id || `adhan_${Date.now()}`).trim();
        const muezzin_name_en = body.muezzin_name_en !== undefined ? String(body.muezzin_name_en).trim() : undefined;
        const muezzin_name_ar = body.muezzin_name_ar !== undefined ? (body.muezzin_name_ar ? String(body.muezzin_name_ar).trim() : null) : undefined;
        const title_en = body.title_en !== undefined ? String(body.title_en).trim() : undefined;
        const mosque_en = body.mosque_en !== undefined ? String(body.mosque_en).trim() : undefined;
        const mosque_ar = body.mosque_ar !== undefined ? (body.mosque_ar ? String(body.mosque_ar).trim() : null) : undefined;
        const audio_url = body.audio_url !== undefined ? (body.audio_url ? String(body.audio_url).trim() : null) : undefined;
        const fajr_audio_url = body.fajr_audio_url !== undefined ? (body.fajr_audio_url ? String(body.fajr_audio_url).trim() : null) : undefined;
        const duration_seconds = body.duration_seconds !== undefined ? Number(body.duration_seconds || 0) : undefined;
        const fajr_duration_seconds = body.fajr_duration_seconds !== undefined ? Number(body.fajr_duration_seconds || 0) : undefined;
        const size_bytes = body.size_bytes !== undefined ? Number(body.size_bytes || 0) : undefined;
        const storage_paths = body.storage_paths !== undefined ? (Array.isArray(body.storage_paths) ? body.storage_paths : []) : undefined;
        const license_status = body.license_status !== undefined ? String(body.license_status) : undefined;
        const license_notes = body.license_notes !== undefined ? (body.license_notes ? String(body.license_notes).trim() : null) : undefined;
        const source_url = body.source_url !== undefined ? (body.source_url ? String(body.source_url).trim() : null) : undefined;
        const official_verified = body.official_verified !== undefined ? Boolean(body.official_verified) : undefined;
        const is_default = body.is_default !== undefined ? Boolean(body.is_default) : undefined;
        const is_active = body.is_active !== undefined ? Boolean(body.is_active) : undefined;
        const sort_order = body.sort_order !== undefined ? Number(body.sort_order) : undefined;

        if (action === 'add' && !muezzin_name_en) {
          return sendJson(res, 400, { error: 'Muezzin name (English) is required.' });
        }

        const sb = getSupabaseAdmin();

        // Check existing row or seed slot for upsert
        const seedMatch = OFFICIAL_MUEZZIN_SLOTS.find((s) => s.id === id);
        let existingRow: any = seedMatch ? { ...seedMatch } : null;

        try {
          const existingRes = await q(`SELECT * FROM adhan_voices WHERE id = $1`, [id]);
          if (existingRes.rows?.[0]) {
            existingRow = { ...existingRow, ...existingRes.rows[0] };
          }
        } catch {}

        if (sb && !existingRow) {
          try {
            const { data } = await sb.from('adhan_voices').select('*').eq('id', id).maybeSingle();
            if (data) existingRow = data;
          } catch {}
        }

        const finalAudioUrl = audio_url !== undefined ? audio_url : (existingRow?.audio_url ?? null);
        const finalFajrAudioUrl = fajr_audio_url !== undefined ? fajr_audio_url : (existingRow?.fajr_audio_url ?? null);

        // Automatically upgrade license_status to 'admin_uploaded' when an audio URL is attached unless specified
        const finalLicenseStatus =
          license_status !== undefined
            ? license_status
            : finalAudioUrl || finalFajrAudioUrl
            ? 'admin_uploaded'
            : existingRow?.license_status || 'upload_when_licensed';

        const merged = {
          id,
          muezzin_name_en: muezzin_name_en ?? existingRow?.muezzin_name_en ?? 'Muezzin',
          muezzin_name_ar: muezzin_name_ar !== undefined ? muezzin_name_ar : (existingRow?.muezzin_name_ar ?? null),
          title_en: title_en ?? existingRow?.title_en ?? 'Adhan Recording',
          mosque_en: mosque_en ?? existingRow?.mosque_en ?? 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
          mosque_ar: mosque_ar !== undefined ? mosque_ar : (existingRow?.mosque_ar ?? 'المسجد النبوي الشريف'),
          audio_url: finalAudioUrl,
          fajr_audio_url: finalFajrAudioUrl,
          duration_seconds: duration_seconds ?? Number(existingRow?.duration_seconds || 0),
          fajr_duration_seconds: fajr_duration_seconds ?? Number(existingRow?.fajr_duration_seconds || 0),
          size_bytes: size_bytes ?? Number(existingRow?.size_bytes || 0),
          storage_paths: storage_paths ?? (Array.isArray(existingRow?.storage_paths) ? existingRow.storage_paths : []),
          license_status: finalLicenseStatus,
          license_notes: license_notes !== undefined ? license_notes : (existingRow?.license_notes ?? null),
          source_url: source_url !== undefined ? source_url : (existingRow?.source_url ?? null),
          official_verified: official_verified ?? Boolean(existingRow?.official_verified ?? false),
          is_default: is_default ?? Boolean(existingRow?.is_default ?? false),
          is_active: is_active ?? Boolean(existingRow?.is_active ?? true),
          sort_order: sort_order ?? Number(existingRow?.sort_order ?? 20),
          updated_at: new Date().toISOString(),
        };

        if (merged.is_default) {
          await q(`UPDATE adhan_voices SET is_default = false WHERE id != $1`, [id]).catch(() => {});
          if (sb) {
            try {
              await sb.from('adhan_voices').update({ is_default: false }).neq('id', id);
            } catch {}
          }
        }

        let savedToSupabase = false;
        let savedToDb = false;

        if (sb) {
          try {
            const { error } = await sb.from('adhan_voices').upsert(merged, { onConflict: 'id' });
            if (!error) savedToSupabase = true;
          } catch (e) {
            console.warn('Supabase adhan_voices upsert notice:', e);
          }
        }

        try {
          await q(
            `INSERT INTO adhan_voices (
               id, muezzin_name_en, muezzin_name_ar, title_en, mosque_en, mosque_ar,
               audio_url, fajr_audio_url, duration_seconds, fajr_duration_seconds,
               size_bytes, storage_paths, license_status, license_notes, source_url,
               official_verified, is_default, is_active, sort_order, created_at, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, now(), now())
             ON CONFLICT (id) DO UPDATE SET
               muezzin_name_en = EXCLUDED.muezzin_name_en,
               muezzin_name_ar = EXCLUDED.muezzin_name_ar,
               title_en = EXCLUDED.title_en,
               mosque_en = EXCLUDED.mosque_en,
               mosque_ar = EXCLUDED.mosque_ar,
               audio_url = EXCLUDED.audio_url,
               fajr_audio_url = EXCLUDED.fajr_audio_url,
               duration_seconds = EXCLUDED.duration_seconds,
               fajr_duration_seconds = EXCLUDED.fajr_duration_seconds,
               size_bytes = EXCLUDED.size_bytes,
               storage_paths = EXCLUDED.storage_paths,
               license_status = EXCLUDED.license_status,
               license_notes = EXCLUDED.license_notes,
               source_url = EXCLUDED.source_url,
               official_verified = EXCLUDED.official_verified,
               is_default = EXCLUDED.is_default,
               is_active = EXCLUDED.is_active,
               sort_order = EXCLUDED.sort_order,
               updated_at = now()`,
            [
              merged.id,
              merged.muezzin_name_en,
              merged.muezzin_name_ar,
              merged.title_en,
              merged.mosque_en,
              merged.mosque_ar,
              merged.audio_url,
              merged.fajr_audio_url,
              merged.duration_seconds,
              merged.fajr_duration_seconds,
              merged.size_bytes,
              JSON.stringify(merged.storage_paths),
              merged.license_status,
              merged.license_notes,
              merged.source_url,
              merged.official_verified,
              merged.is_default,
              merged.is_active,
              merged.sort_order,
            ]
          );
          savedToDb = true;
        } catch (e) {
          console.warn('Database adhan_voices upsert notice:', e);
        }

        if (!savedToSupabase && !savedToDb) {
          return sendJson(res, 500, { error: 'Failed to save Adhan voice to database.' });
        }

        const version = await bumpAdhanVoicesVersion();
        return sendJson(res, 200, { ok: true, version, voice: merged });
      }

      if (action === 'set-default') {
        const id = String(body.id || '').trim();
        if (!id) return sendJson(res, 400, { error: 'Voice ID is required' });

        await q(`UPDATE adhan_voices SET is_default = (id = $1), updated_at = now()`, [id]).catch(() => {});

        const sb = getSupabaseAdmin();
        if (sb) {
          try {
            await sb.from('adhan_voices').update({ is_default: false }).neq('id', id);
            await sb.from('adhan_voices').update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', id);
          } catch {}
        }

        const version = await bumpAdhanVoicesVersion();
        return sendJson(res, 200, { ok: true, version });
      }

      if (action === 'reorder') {
        const order: Array<{ id: string; sort_order: number }> = Array.isArray(body.order) ? body.order : [];
        const sb = getSupabaseAdmin();
        for (const item of order) {
          if (!item?.id) continue;
          const sortVal = Number(item.sort_order ?? 0);
          await q(`UPDATE adhan_voices SET sort_order = $2, updated_at = now() WHERE id = $1`, [item.id, sortVal]).catch(
            () => {}
          );
          if (sb) {
            try {
              await sb.from('adhan_voices').update({ sort_order: sortVal }).eq('id', item.id);
            } catch {}
          }
        }
        const version = await bumpAdhanVoicesVersion();
        return sendJson(res, 200, { ok: true, version });
      }

      if (action === 'delete') {
        const id = String(body.id || '').trim();
        if (!id) return sendJson(res, 400, { error: 'Voice ID is required' });

        let paths: string[] = [];
        const sb = getSupabaseAdmin();
        if (sb) {
          try {
            const { data: existing } = await sb.from('adhan_voices').select('storage_paths').eq('id', id).maybeSingle();
            if (Array.isArray(existing?.storage_paths)) {
              paths = existing.storage_paths;
            }
            const isOfficialSeed = OFFICIAL_MUEZZIN_SLOTS.some((s) => s.id === id);
            if (isOfficialSeed) {
              // For official catalog slots, clear audio_url back to upload_when_licensed slot
              await sb
                .from('adhan_voices')
                .update({
                  audio_url: null,
                  fajr_audio_url: null,
                  duration_seconds: 0,
                  fajr_duration_seconds: 0,
                  size_bytes: 0,
                  storage_paths: [],
                  license_status: 'upload_when_licensed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', id);
            } else {
              await sb.from('adhan_voices').delete().eq('id', id);
            }
            if (paths.length > 0) {
              await sb.storage.from('ambient-backgrounds').remove(paths.map((p: string) => p.replace(/^\/+/, '')));
            }
          } catch (e) {
            console.warn('Supabase delete adhan_voices notice:', e);
          }
        }

        const isOfficialSeed = OFFICIAL_MUEZZIN_SLOTS.some((s) => s.id === id);
        if (isOfficialSeed) {
          await q(
            `UPDATE adhan_voices
             SET audio_url = NULL,
                 fajr_audio_url = NULL,
                 duration_seconds = 0,
                 fajr_duration_seconds = 0,
                 size_bytes = 0,
                 storage_paths = '[]'::jsonb,
                 license_status = 'upload_when_licensed',
                 updated_at = now()
             WHERE id = $1`,
            [id]
          ).catch(() => {});
        } else {
          await q(`DELETE FROM adhan_voices WHERE id = $1`, [id]).catch(() => {});
        }

        const version = await bumpAdhanVoicesVersion();
        return sendJson(res, 200, { ok: true, version });
      }

      if (action === 'signed-upload-url') {
        const path = String(body.path || '').replace(/^\/+/, '');
        if (!path) return sendJson(res, 400, { error: 'Path is required' });

        const sb = getSupabaseAdmin();
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
        if (sb && supabaseUrl) {
          try {
            const { data, error } = await sb.storage.from('ambient-backgrounds').createSignedUploadUrl(path);
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
            console.warn('Adhan createSignedUploadUrl notice:', e?.message);
          }
        }

        return sendJson(res, 200, { ok: false });
      }

      if (action === 'upload') {
        const path = String(body.path || '').replace(/^\/+/, '');
        const contentType = String(body.contentType || 'audio/mpeg');
        const base64Data = String(body.data || '');
        if (!path || !base64Data) return sendJson(res, 400, { error: 'Path and data are required' });

        const buffer = Buffer.from(base64Data, 'base64');
        const sb = getSupabaseAdmin();
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
        if (sb && supabaseUrl) {
          try {
            const { error } = await sb.storage.from('ambient-backgrounds').upload(path, buffer, {
              contentType,
              upsert: true,
              cacheControl: '31536000',
            });
            if (!error) {
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/ambient-backgrounds/${path}`;
              return sendJson(res, 200, { ok: true, publicUrl });
            }
          } catch (e) {
            console.warn('Supabase adhan audio upload fallback:', e);
          }
        }

        const mediaId = `adhan_${Date.now()}_${path.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-36)}`;
        const dataUrl = `data:${contentType};base64,${base64Data}`;
        await q('INSERT INTO global_media (id, kind, mime_type, data_url) VALUES ($1, $2, $3, $4)', [
          mediaId,
          'audio',
          contentType,
          dataUrl,
        ]);
        return sendJson(res, 200, { ok: true, publicUrl: `/api/media/${mediaId}` });
      }

      if (action === 'seed-official-slots') {
        const sb = getSupabaseAdmin();
        for (const slot of OFFICIAL_MUEZZIN_SLOTS) {
          await q(
            `INSERT INTO adhan_voices (
               id, muezzin_name_en, muezzin_name_ar, title_en, mosque_en, mosque_ar,
               audio_url, fajr_audio_url, duration_seconds, fajr_duration_seconds,
               size_bytes, storage_paths, license_status, license_notes, source_url,
               official_verified, is_default, is_active, sort_order, created_at, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, now(), now())
             ON CONFLICT (id) DO NOTHING`,
            [
              slot.id,
              slot.muezzin_name_en,
              slot.muezzin_name_ar,
              slot.title_en,
              slot.mosque_en,
              slot.mosque_ar,
              slot.audio_url,
              slot.fajr_audio_url,
              slot.duration_seconds,
              slot.fajr_duration_seconds,
              slot.size_bytes,
              JSON.stringify(slot.storage_paths),
              slot.license_status,
              slot.license_notes,
              slot.source_url,
              slot.official_verified,
              slot.is_default,
              slot.is_active,
              slot.sort_order,
            ]
          ).catch(() => {});
          if (sb) {
            try {
              await sb.from('adhan_voices').upsert(slot, { onConflict: 'id', ignoreDuplicates: true });
            } catch {}
          }
        }
        const version = await bumpAdhanVoicesVersion();
        return sendJson(res, 200, { ok: true, count: OFFICIAL_MUEZZIN_SLOTS.length, version });
      }

      return sendJson(res, 400, { error: 'Unknown action' });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Admin adhan-voices error:', err);
    return sendJson(res, 500, { error: err?.message || 'Server error' });
  }
};

export default handler;
