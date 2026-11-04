// GET /api/adhan-voices -> { voices: AdhanVoiceRow[], version: number, updated_at: string }
import { type Handler, q, sendJson } from './_lib.mjs';
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
 * under the Presidency of Religious Affairs at the Grand Mosque and the Prophet's Mosque
 * (Ri'asat al-Shu'un al-Diniyyah bil-Masjid al-Haram wal-Masjid an-Nabawi),
 * plus Sheikh Mishary Rashid Alafasy.
 *
 * Strictly zero hardcoded audio URLs: each entry starts as an admin-uploadable slot
 * ('upload_when_licensed') until the administrator uploads a licensed recording.
 */
export const OFFICIAL_MUEZZIN_SLOTS: AdhanVoiceSeed[] = [
  {
    id: 'nabawi-khashuqji',
    muezzin_name_en: 'Sheikh Abdul-Rahman bin Abdul-Ilah Khashuqji',
    muezzin_name_ar: 'الشيخ عبد الرحمن بن عبد الإله خاشقجي',
    title_en: 'Chief Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Official Haramain broadcast recording under the Presidency of the Two Holy Mosques. Upload when licensed for commercial distribution.',
    source_url: 'https://prh.gov.sa',
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
    audio_url: null,
    fajr_audio_url: null,
    duration_seconds: 0,
    fajr_duration_seconds: 0,
    size_bytes: 0,
    storage_paths: [],
    license_status: 'upload_when_licensed',
    license_notes:
      'Alafasy Studio / Grand Mosque recording. Personal listening is permitted; commercial in-app bundling requires studio clearance — upload when licensed.',
    source_url: 'https://alafasy.me',
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
      duration_seconds      NUMERIC DEFAULT 0,
      fajr_duration_seconds NUMERIC DEFAULT 0,
      size_bytes            BIGINT DEFAULT 0,
      storage_paths         JSONB DEFAULT '[]'::jsonb,
      license_status        TEXT NOT NULL DEFAULT 'upload_when_licensed',
      license_notes         TEXT,
      source_url            TEXT,
      official_verified     BOOLEAN DEFAULT true,
      is_default            BOOLEAN DEFAULT false,
      is_active             BOOLEAN DEFAULT true,
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
            byId.set(row.id, row);
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
      SELECT id, muezzin_name_en, muezzin_name_ar, title_en, mosque_en, mosque_ar,
             audio_url, fajr_audio_url, duration_seconds, fajr_duration_seconds,
             size_bytes, storage_paths, license_status, license_notes, source_url,
             official_verified, is_default, is_active, sort_order, created_at, updated_at
      FROM adhan_voices
      ORDER BY sort_order ASC, created_at DESC
    `);
    for (const row of result.rows || []) {
      if (!includeInactive && row.is_active === false) {
        hiddenIds.add(row.id);
        byId.delete(row.id);
      } else if (!hiddenIds.has(row.id)) {
        const existing = byId.get(row.id);
        // Prefer row that has uploaded audio_url or newer updated_at
        if (!existing || row.audio_url || row.fajr_audio_url || !existing.audio_url) {
          byId.set(row.id, { ...existing, ...row });
        }
      }
    }
  } catch (e) {
    console.warn('Local/Postgres adhan_voices query notice:', e);
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
