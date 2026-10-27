import type { IncomingMessage, ServerResponse } from 'node:http';
import { q, sendJson, getSupabaseAdmin } from './_lib';

export interface AdhanVoiceRow {
  id: string;
  name_en: string;
  name_ar: string | null;
  muezzin: string;
  mosque: string | null;
  audio_url: string | null;
  fajr_audio_url: string | null;
  duration: number;
  license: string | null;
  source: string | null;
  attribution: string | null;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

export async function ensureAdhanVoicesTable(): Promise<void> {
  await q(`
    CREATE TABLE IF NOT EXISTS adhan_voices (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ar TEXT,
      muezzin TEXT NOT NULL,
      mosque TEXT,
      audio_url TEXT,
      fajr_audio_url TEXT,
      duration INTEGER DEFAULT 0,
      license TEXT,
      source TEXT,
      attribution TEXT,
      is_active BOOLEAN DEFAULT true,
      is_premium BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {});
}

const handler = async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    // 1. Primary: Query Supabase public.adhan_voices
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('adhan_voices')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          return sendJson(res, 200, { voices: data });
        }
      } catch (sbErr) {
        console.warn('[adhan-voices] Supabase query notice:', sbErr);
      }
    }

    // 2. Fallback: Query local / read-only database
    await ensureAdhanVoicesTable();
    const result = await q(`
      SELECT id, name_en, name_ar, muezzin, mosque, audio_url, fajr_audio_url,
             duration, license, source, attribution, is_active, is_premium, created_at
      FROM adhan_voices
      WHERE is_active = true
      ORDER BY created_at ASC
    `);

    return sendJson(res, 200, {
      voices: result.rows || [],
    });
  } catch (err: any) {
    console.error('Failed to load adhan voices:', err);
    return sendJson(res, 200, { voices: [] });
  }
};

export default handler;
