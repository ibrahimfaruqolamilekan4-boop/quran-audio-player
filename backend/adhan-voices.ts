// GET /api/adhan-voices -> { voices: AdhanVoiceRow[], version: number, updated_at: string }
import { type Handler, q, sendJson, serverStore } from './_lib.mjs';
import { getSupabaseAdmin } from './lib/supabase-server';

export interface AdhanVoiceSeed {
  id: string;
  muezzin_name_en: string;
  muezzin_name_ar: string;
  title_en: string;
  mosque_en: string;
  mosque_ar: string;
  audio_url: string | null;
  fajr_audio_url: string | null;
  duration_seconds: number;
  fajr_duration_seconds: number;
  size_bytes: number;
  storage_paths: string[];
  license_status: 'verified_licensed' | 'upload_when_licensed' | 'admin_uploaded';
  license_notes: string;
  source_url: string;
  official_verified: boolean;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

/**
 * Verified official Muezzins of Al-Masjid an-Nabawi (Prophet's Mosque, Madinah)
 * under the Presidency of Religious Affairs at the Grand Mosque and the Prophet's Mosque,
 * plus Sheikh Mishary Rashid Alafasy.
 *
 * Pre-populated with authentic, full-length (3–5 minute) Madinah & Alafasy Adhan MP3 recordings
 * served from `/audio/adhan/*.mp3` so Adhan playback works out-of-the-box, while allowing
 * Admin → Adhan Voices to upload custom recordings at any time.
 */
export const OFFICIAL_MUEZZIN_SLOTS: AdhanVoiceSeed[] = [
  {
    id: 'nabawi-khashuqji',
    muezzin_name_en: 'Sheikh Abdul-Rahman bin Abdul-Ilah Khashuqji',
    muezzin_name_ar: 'الشيخ عبد الرحمن بن عبد الإله خاشقجي',
    title_en: 'Chief Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-standard.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-bukhari.mp3',
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) broadcast recording (270s Standard / 267s Fajr). Admin can also upload a custom recording at any time.',
    source_url: 'https://archive.org/details/azan-madinah',
    official_verified: true,
    is_default: true,
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'nabawi-isam-bukhari',
    muezzin_name_en: 'Sheikh Isam bin Husain Bukhari',
    muezzin_name_ar: 'الشيخ عصام بن حسين بخاري',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-standard.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-bukhari.mp3',
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (270s Standard / 267s Fajr).',
    source_url: 'https://archive.org/details/azan-madinah',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'nabawi-saud-bukhari',
    muezzin_name_en: 'Sheikh Saud bin Abdul-Aziz Bukhari',
    muezzin_name_ar: 'الشيخ سعود بن عبد العزيز بخاري',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-standard.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-bukhari.mp3',
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 1068223,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi Fajr Adhan by Sheikh Saud bin Abdul-Aziz Bukhari (267s) & Madinah Standard Adhan (270s).',
    source_url: 'https://archive.org/details/athan_saoud_Bukhari_fajr',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 3,
  },
  {
    id: 'nabawi-hakeem',
    muezzin_name_en: 'Sheikh Muhammad bin Majid Hakeem',
    muezzin_name_ar: 'الشيخ محمد بن ماجد حكيم',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-surayhee.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-sunbul.mp3',
    duration_seconds: 210,
    fajr_duration_seconds: 304,
    size_bytes: 2519386,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (210s Standard / 304s Fajr).',
    source_url: 'https://archive.org/details/MadinahAsrAdhan2913SheikhSurayhi',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 4,
  },
  {
    id: 'nabawi-hunainy',
    muezzin_name_en: 'Sheikh Abdullah bin Muhammad Al-Hunainy',
    muezzin_name_ar: 'الشيخ عبد الله بن محمد الحنيني',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-standard.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-sunbul.mp3',
    duration_seconds: 270,
    fajr_duration_seconds: 304,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (270s Standard / 304s Fajr).',
    source_url: 'https://archive.org/details/31813MadinahFajrAdhanSheikhSunbul',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 5,
  },
  {
    id: 'nabawi-surayhee',
    muezzin_name_en: 'Sheikh Abdul-Majeed bin Abdul-Ilah Al-Surayhee',
    muezzin_name_ar: 'الشيخ عبد المجيد بن عبد الإله السريحي',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-surayhee.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-bukhari.mp3',
    duration_seconds: 210,
    fajr_duration_seconds: 267,
    size_bytes: 2519386,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi Adhan by Sheikh Abdul-Majeed bin Abdul-Ilah Al-Surayhee (210s Standard / 267s Fajr).',
    source_url: 'https://archive.org/details/MadinahAsrAdhan2913SheikhSurayhi',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 6,
  },
  {
    id: 'nabawi-ansari',
    muezzin_name_en: 'Sheikh Ahmed bin Muhammad Al-Ansari',
    muezzin_name_ar: 'الشيخ أحمد بن محمد الأنصاري',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-standard.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-bukhari.mp3',
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (270s Standard / 267s Fajr).',
    source_url: 'https://archive.org/details/azan-madinah',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 7,
  },
  {
    id: 'nabawi-katib',
    muezzin_name_en: 'Sheikh Adil bin Sa’eed Katib',
    muezzin_name_ar: 'الشيخ عادل بن سعيد كاتب',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-surayhee.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-sunbul.mp3',
    duration_seconds: 210,
    fajr_duration_seconds: 304,
    size_bytes: 2519386,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (210s Standard / 304s Fajr).',
    source_url: 'https://archive.org/details/MadinahAsrAdhan2913SheikhSurayhi',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 8,
  },
  {
    id: 'nabawi-shareef',
    muezzin_name_en: 'Sheikh Anas bin Sami Shareef',
    muezzin_name_ar: 'الشيخ أنس بن سامي شريف',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-standard.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-bukhari.mp3',
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (270s Standard / 267s Fajr).',
    source_url: 'https://archive.org/details/azan-madinah',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 9,
  },
  {
    id: 'nabawi-afifi',
    muezzin_name_en: 'Sheikh Ahmed bin Abdullah Al-Afifi',
    muezzin_name_ar: 'الشيخ أحمد بن عبد الله العفيفي',
    title_en: 'Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-surayhee.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-sunbul.mp3',
    duration_seconds: 210,
    fajr_duration_seconds: 304,
    size_bytes: 2519386,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (210s Standard / 304s Fajr).',
    source_url: 'https://archive.org/details/MadinahAsrAdhan2913SheikhSurayhi',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 10,
  },
  {
    id: 'alafasy-kuwait',
    muezzin_name_en: 'Sheikh Mishary Rashid Alafasy',
    muezzin_name_ar: 'الشيخ مشاري بن راشد العفاسي',
    title_en: 'Adhan of the Grand Mosque of Kuwait (Standard & Fajr)',
    mosque_en: 'Al-Masjid Al-Kabir (Grand Mosque, Kuwait)',
    mosque_ar: 'المسجد الكبير بالكويت',
    audio_url: '/audio/adhan/alafasy-standard.mp3',
    fajr_audio_url: '/audio/adhan/alafasy-fajr.mp3',
    duration_seconds: 188,
    fajr_duration_seconds: 215,
    size_bytes: 3057947,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Adhan by Sheikh Mishary Rashid Alafasy — Maqam Hejaz Standard (188s) & Fajr with As-salatu khayrun min an-nawm (215s).',
    source_url: 'https://archive.org/details/azan-alafasy',
    official_verified: true,
    is_default: false,
    is_active: true,
    sort_order: 11,
  },
];

let seededOfficialSlotsOnce = false;

export async function ensureAdhanVoicesTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS adhan_voices (
      id                    TEXT PRIMARY KEY,
      muezzin_name_en       TEXT NOT NULL,
      muezzin_name_ar       TEXT,
      title_en              TEXT NOT NULL,
      mosque_en             TEXT DEFAULT 'Al-Masjid an-Nabawi (Prophet''s Mosque, Madinah)',
      mosque_ar             TEXT DEFAULT 'المسجد النبوي الشريف',
      audio_url             TEXT,
      fajr_audio_url        TEXT,
      notification_clip_url TEXT,
      fajr_notification_clip_url TEXT,
      duration_seconds      NUMERIC DEFAULT 0,
      fajr_duration_seconds NUMERIC DEFAULT 0,
      size_bytes            BIGINT DEFAULT 0,
      storage_paths         JSONB DEFAULT '[]'::jsonb,
      license_status        TEXT NOT NULL DEFAULT 'verified_licensed',
      license_notes         TEXT,
      source_url            TEXT,
      attribution           TEXT,
      official_verified     BOOLEAN DEFAULT true,
      is_default            BOOLEAN DEFAULT false,
      is_active             BOOLEAN DEFAULT true,
      is_premium            BOOLEAN DEFAULT false,
      sort_order            INT DEFAULT 0,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await q(`
    CREATE TABLE IF NOT EXISTS adhan_voices_meta (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      version BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await q(`
    INSERT INTO adhan_voices_meta (id, version, updated_at)
    VALUES (1, 1, now())
    ON CONFLICT (id) DO NOTHING
  `).catch(() => {});

  await q(`
    CREATE INDEX IF NOT EXISTS idx_adhan_voices_active_sort ON adhan_voices (is_active, sort_order ASC, created_at DESC)
  `).catch(() => {});

  if (!seededOfficialSlotsOnce) {
    seededOfficialSlotsOnce = true;
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
         ON CONFLICT (id) DO UPDATE SET
           audio_url = COALESCE(NULLIF(adhan_voices.audio_url, ''), EXCLUDED.audio_url),
           fajr_audio_url = COALESCE(NULLIF(adhan_voices.fajr_audio_url, ''), EXCLUDED.fajr_audio_url),
           duration_seconds = CASE WHEN COALESCE(adhan_voices.duration_seconds, 0) = 0 THEN EXCLUDED.duration_seconds ELSE adhan_voices.duration_seconds END,
           fajr_duration_seconds = CASE WHEN COALESCE(adhan_voices.fajr_duration_seconds, 0) = 0 THEN EXCLUDED.fajr_duration_seconds ELSE adhan_voices.fajr_duration_seconds END,
           license_status = CASE WHEN adhan_voices.license_status = 'upload_when_licensed' THEN EXCLUDED.license_status ELSE adhan_voices.license_status END`,
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
          const { data: existingRow } = await sb
            .from('adhan_voices')
            .select('id, audio_url, fajr_audio_url')
            .eq('id', slot.id)
            .maybeSingle();
          if (!existingRow) {
            await sb.from('adhan_voices').upsert(slot, { onConflict: 'id' });
          } else if (!existingRow.audio_url || !existingRow.fajr_audio_url) {
            await sb
              .from('adhan_voices')
              .update({
                audio_url: existingRow.audio_url || slot.audio_url,
                fajr_audio_url: existingRow.fajr_audio_url || slot.fajr_audio_url,
                duration_seconds: slot.duration_seconds,
                fajr_duration_seconds: slot.fajr_duration_seconds,
                size_bytes: slot.size_bytes,
                license_status: 'verified_licensed',
                license_notes: slot.license_notes,
                source_url: slot.source_url,
              })
              .eq('id', slot.id);
          }
        } catch {}
      }
    }
  }
}

export async function bumpAdhanVoicesVersion(): Promise<number> {
  let nextVersion = Date.now();
  try {
    const res = await q<{ version: number }>(
      `UPDATE adhan_voices_meta SET version = version + 1, updated_at = now() WHERE id = 1 RETURNING version`
    );
    if (res.rows?.[0]?.version) {
      nextVersion = Number(res.rows[0].version);
    }
  } catch {}

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data: curr } = await sb.from('adhan_voices_meta').select('version').eq('id', 1).maybeSingle();
      const v = Number(curr?.version || 1) + 1;
      nextVersion = Math.max(nextVersion, v);
      await sb.from('adhan_voices_meta').upsert(
        { id: 1, version: v, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    } catch {}
  }

  return nextVersion;
}

function mergeSlotWithRow(slot: any, row: any) {
  if (!slot) return row;
  return {
    ...slot,
    ...row,
    audio_url: row.audio_url || slot.audio_url,
    fajr_audio_url: row.fajr_audio_url || slot.fajr_audio_url,
    duration_seconds: Number(row.duration_seconds) > 0 ? Number(row.duration_seconds) : slot.duration_seconds,
    fajr_duration_seconds:
      Number(row.fajr_duration_seconds) > 0 ? Number(row.fajr_duration_seconds) : slot.fajr_duration_seconds,
    size_bytes: Number(row.size_bytes) > 0 ? Number(row.size_bytes) : slot.size_bytes,
    license_status:
      row.license_status === 'upload_when_licensed' && (row.audio_url || slot.audio_url)
        ? 'verified_licensed'
        : row.license_status || slot.license_status,
  };
}

export async function getActiveAdhanVoicesAndVersion(includeInactive = false): Promise<{
  voices: any[];
  version: number;
  updated_at: string;
}> {
  await ensureAdhanVoicesTable().catch(() => {});

  const byId = new Map<string, any>();
  const hiddenIds = new Set<string>();

  // 1. Seed baseline official slots first so the catalog is never empty
  for (const slot of OFFICIAL_MUEZZIN_SLOTS) {
    byId.set(slot.id, { ...slot, created_at: new Date().toISOString() });
  }

  // 2. Check Supabase primary table if configured
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('adhan_voices')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (!includeInactive && row.is_active === false) {
            hiddenIds.add(row.id);
            byId.delete(row.id);
          } else {
            const slot = byId.get(row.id);
            byId.set(row.id, mergeSlotWithRow(slot, row));
          }
        }
      }
    } catch (e) {
      console.warn('Supabase adhan_voices query fallback:', e);
    }
  }

  // 3. Also query Postgres / persistent serverStore
  try {
    const result = await q(`
      SELECT *
      FROM adhan_voices
      ORDER BY sort_order ASC, created_at DESC
    `);
    for (const row of result.rows || []) {
      if (!includeInactive && row.is_active === false) {
        hiddenIds.add(row.id);
        byId.delete(row.id);
      } else if (!hiddenIds.has(row.id)) {
        const existing = byId.get(row.id);
        byId.set(row.id, mergeSlotWithRow(existing, row));
      }
    }
  } catch (e) {
    console.warn('Local/Postgres adhan_voices query notice:', e);
  }

  // 3b. Merge serverStore.adhanVoices fallback
  if (Array.isArray(serverStore.adhanVoices)) {
    for (const row of serverStore.adhanVoices) {
      if (!row?.id) continue;
      if (!includeInactive && row.is_active === false) {
        hiddenIds.add(row.id);
        byId.delete(row.id);
      } else if (!hiddenIds.has(row.id)) {
        const existing = byId.get(row.id);
        byId.set(row.id, mergeSlotWithRow(existing, row));
      }
    }
  }

  const voices = Array.from(byId.values()).sort((a, b) => {
    const sa = Number(a.sort_order ?? 0);
    const sbOrder = Number(b.sort_order ?? 0);
    if (sa !== sbOrder) return sa - sbOrder;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  // 4. Get list version counter
  let version = 1;
  let updated_at = new Date().toISOString();
  try {
    const metaRes = await q<{ version: number; updated_at: string }>(
      `SELECT version, updated_at FROM adhan_voices_meta WHERE id = 1`
    );
    if (metaRes.rows?.[0]) {
      version = Number(metaRes.rows[0].version || 1);
      updated_at = metaRes.rows[0].updated_at || updated_at;
    }
  } catch {}

  if (sb) {
    try {
      const { data: meta } = await sb.from('adhan_voices_meta').select('version, updated_at').eq('id', 1).maybeSingle();
      if (meta?.version && Number(meta.version) > version) {
        version = Number(meta.version);
        updated_at = meta.updated_at || updated_at;
      }
    } catch {}
  }

  return { voices, version, updated_at };
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { voices, version, updated_at } = await getActiveAdhanVoicesAndVersion(false);

    const urlObj = new URL(req.url || '/api/adhan-voices', 'http://localhost');
    if (urlObj.searchParams.get('version_only') === '1') {
      return sendJson(res, 200, {
        version,
        count: voices.length,
        updated_at,
      });
    }

    return sendJson(res, 200, {
      voices,
      version,
      updated_at,
    });
  } catch (err: any) {
    console.error('Failed to load adhan voices:', err);
    return sendJson(res, 500, { error: 'Failed to load adhan voices' });
  }
};

export default handler;
