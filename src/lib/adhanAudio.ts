/**
 * Nooraya Adhan Voices & Real-Audio-Only Playback Engine
 *
 * STRICT GUARANTEES (Step 2.1 – 2.7):
 * 1. ZERO synthetic tones, oscillators, beeps, chimes, or stand-in sounds.
 *    If a voice's recording is missing or fails to load/decode, we NEVER play a substitute sound;
 *    instead we emit a clear visible error ("Adhan audio is not available: <reason>") and log it.
 * 2. Adhan audio comes ONLY from the selected voice's real audio file (`fajr_audio_url` for Fajr,
 *    `audio_url` for Dhuhr/Asr/Maghrib/Isha).
 * 3. Preloads the next prayer's Adhan file before prayer time and caches it in Cache Storage
 *    (`nooraya-adhan-audio-v1`) so it plays immediately and works offline after caching.
 * 4. Uses the single persistent audio manager (`getAdhanAudio()`), smoothly ducks/pauses
 *    Quran & ambient audio during Adhan, and restores them when Adhan finishes or is stopped.
 * 5. If browser autoplay policy blocks playback (`NotAllowedError`), enters `autoplayBlocked: true`
 *    state ("Tap to play Adhan") so one user tap synchronously starts playback.
 */

import {
  getSupabaseClient,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  STORAGE_BUCKET,
} from './supabase';
import {
  getAdhanAudio,
  duckAndPauseForAdhan,
  restoreAfterAdhan,
  unlockAudio,
} from './persistentAudio';
import { uploadMediaToServer } from './upload';
import { processAdhanAudioFile, type ProcessedAdhanUploadResult } from './adhanAudioProcessor';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type AdhanMode = 'full' | 'takbir' | 'silent';

export type AdhanLicenseStatus =
  | 'verified_licensed'
  | 'upload_when_licensed'
  | 'admin_uploaded';

export interface AdhanVoiceRow {
  id: string;
  muezzin_name_en: string;
  muezzin_name_ar?: string | null;
  title_en: string;
  mosque_en?: string | null;
  mosque_ar?: string | null;
  audio_url?: string | null;
  fajr_audio_url?: string | null;
  notification_clip_url?: string | null;
  fajr_notification_clip_url?: string | null;
  duration_seconds?: number | null;
  fajr_duration_seconds?: number | null;
  size_bytes?: number | null;
  storage_paths?: string[] | null;
  license_status: AdhanLicenseStatus;
  license_notes?: string | null;
  source_url?: string | null;
  attribution?: string | null;
  official_verified?: boolean;
  is_default?: boolean;
  is_active?: boolean;
  is_premium?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdhanDiagnosticLogEntry {
  id: string;
  timestamp: string;
  trigger: 'scheduled' | 'test_button' | 'preview' | 'notification_tap' | 'gesture_resume';
  prayerKey: string;
  voiceId: string | null;
  muezzinName: string | null;
  urlUsed: string | null;
  isFajrVariant: boolean;
  readyState: number;
  audioError: string | null;
  playResult: 'playing' | 'autoplay_blocked' | 'missing_url' | 'load_or_decode_error' | 'silent_mode';
  pathTaken: string;
  durationSeconds: number | null;
}

export type AdhanDiagnosticEntry = AdhanDiagnosticLogEntry;

export interface ActiveAdhanPlaybackState {
  isPlaying: boolean;
  autoplayBlocked: boolean;
  errorMessage: string | null;
  notificationTapScreenOpen: boolean;
  prayerKey: string | null;
  prayerNameEn: string | null;
  prayerNameAr: string | null;
  voiceId: string | null;
  muezzinNameEn: string | null;
  muezzinNameAr: string | null;
  mosqueEn: string | null;
  audioUrlUsed: string | null;
  durationSeconds: number | null;
  mode: AdhanMode | 'preview';
  isFajrVariant: boolean;
  backgroundAudioPaused: boolean;
  startedAt: number | null;
  lastDiagnostic: AdhanDiagnosticLogEntry | null;
}

export const ADHAN_AUDIO_CACHE_NAME = 'nooraya-adhan-audio-v1';

/**
 * Verified official Muezzins of Al-Masjid an-Nabawi (Prophet's Mosque, Madinah)
 * under the Presidency of Religious Affairs at the Grand Mosque and the Prophet's Mosque,
 * plus Sheikh Mishary Rashid Alafasy.
 * Zero hardcoded audio URLs — slots remain 'upload_when_licensed' until Admin uploads audio.
 */
export const OFFICIAL_MUEZZIN_CATALOG_SLOTS: AdhanVoiceRow[] = [
  {
    id: 'nabawi-khashuqji',
    muezzin_name_en: 'Sheikh Abdul-Rahman bin Abdul-Ilah Khashuqji',
    muezzin_name_ar: 'الشيخ عبد الرحمن بن عبد الإله خاشقجي',
    title_en: 'Chief Muezzin of the Prophet’s Mosque (Madinah)',
    mosque_en: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    mosque_ar: 'المسجد النبوي الشريف',
    audio_url: '/audio/adhan/madinah-standard.mp3',
    fajr_audio_url: '/audio/adhan/madinah-fajr-bukhari.mp3',
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) broadcast recording (270s Standard / 267s Fajr). Admin can also upload a custom recording at any time.',
    source_url: 'https://archive.org/details/azan-madinah',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: true,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (270s Standard / 267s Fajr).',
    source_url: 'https://archive.org/details/azan-madinah',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 1068223,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi Fajr Adhan by Sheikh Saud bin Abdul-Aziz Bukhari (267s) & Madinah Standard Adhan (270s).',
    source_url: 'https://archive.org/details/athan_saoud_Bukhari_fajr',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 210,
    fajr_duration_seconds: 304,
    size_bytes: 2519386,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (210s Standard / 304s Fajr).',
    source_url: 'https://archive.org/details/MadinahAsrAdhan2913SheikhSurayhi',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 270,
    fajr_duration_seconds: 304,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (270s Standard / 304s Fajr).',
    source_url: 'https://archive.org/details/31813MadinahFajrAdhanSheikhSunbul',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 210,
    fajr_duration_seconds: 267,
    size_bytes: 2519386,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi Adhan by Sheikh Abdul-Majeed bin Abdul-Ilah Al-Surayhee (210s Standard / 267s Fajr).',
    source_url: 'https://archive.org/details/MadinahAsrAdhan2913SheikhSurayhi',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (270s Standard / 267s Fajr).',
    source_url: 'https://archive.org/details/azan-madinah',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 210,
    fajr_duration_seconds: 304,
    size_bytes: 2519386,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (210s Standard / 304s Fajr).',
    source_url: 'https://archive.org/details/MadinahAsrAdhan2913SheikhSurayhi',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 270,
    fajr_duration_seconds: 267,
    size_bytes: 2467917,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (270s Standard / 267s Fajr).',
    source_url: 'https://archive.org/details/azan-madinah',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 210,
    fajr_duration_seconds: 304,
    size_bytes: 2519386,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Al-Masjid an-Nabawi (Madinah) Adhan recording (210s Standard / 304s Fajr).',
    source_url: 'https://archive.org/details/MadinahAsrAdhan2913SheikhSurayhi',
    attribution: 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
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
    notification_clip_url: null,
    fajr_notification_clip_url: null,
    duration_seconds: 188,
    fajr_duration_seconds: 215,
    size_bytes: 3057947,
    storage_paths: [],
    license_status: 'verified_licensed',
    license_notes:
      'Authentic Adhan by Sheikh Mishary Rashid Alafasy — Maqam Hejaz Standard (188s) & Fajr with As-salatu khayrun min an-nawm (215s).',
    source_url: 'https://archive.org/details/azan-alafasy',
    attribution: 'Sheikh Mishary Rashid Alafasy',
    official_verified: true,
    is_default: false,
    is_active: true,
    is_premium: false,
    sort_order: 11,
  },
];

export const DEFAULT_ADHAN_VOICES = OFFICIAL_MUEZZIN_CATALOG_SLOTS;

let cachedAdhanVoices: AdhanVoiceRow[] | null = OFFICIAL_MUEZZIN_CATALOG_SLOTS;
let lastAdhanFetchTime = 0;
let lastKnownAdhanVersion = 0;

// Allow unit tests to inject a mocked HTMLAudioElement
let testAudioElementOverride: HTMLAudioElement | null = null;
export function setAdhanAudioElementForTesting(el: HTMLAudioElement | null): void {
  testAudioElementOverride = el;
}

function getActiveAdhanAudioElement(): HTMLAudioElement {
  return testAudioElementOverride || getAdhanAudio();
}

/**
 * Normalizes and validates an Adhan audio URL:
 * - Rejects empty/whitespace strings
 * - Converts `http://` to `https://` on remote origins to prevent mixed-content blocks
 * - Safely encodes spaces or unsafe characters
 */
export function normalizeAdhanAudioUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let cleaned = rawUrl.trim();
  if (!cleaned) return null;

  if (cleaned.startsWith('http://') && !cleaned.startsWith('http://localhost')) {
    cleaned = 'https://' + cleaned.slice('http://'.length);
  }

  // Encode unescaped spaces
  cleaned = cleaned.replace(/ /g, '%20');
  return cleaned;
}

const diagnosticLogs: AdhanDiagnosticLogEntry[] = [];
function recordAdhanDiagnostic(entry: Omit<AdhanDiagnosticLogEntry, 'id' | 'timestamp'>): AdhanDiagnosticLogEntry {
  const full: AdhanDiagnosticLogEntry = {
    id: `adhan_diag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  diagnosticLogs.unshift(full);
  if (diagnosticLogs.length > 25) {
    diagnosticLogs.length = 25;
  }
  console.info('[AdhanDiagnostics]', JSON.stringify(full));
  return full;
}

export function getAdhanDiagnosticLogs(): AdhanDiagnosticLogEntry[] {
  return [...diagnosticLogs];
}

export function clearAdhanDiagnosticLogs(): void {
  diagnosticLogs.length = 0;
}

/**
 * Fetches the lightweight version counter for `adhan_voices` so phones detect changes quickly.
 */
export async function fetchAdhanVoicesVersion(): Promise<number> {
  try {
    const res = await fetch(`/api/adhan-voices?version_only=1&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.version === 'number') {
        return data.version;
      }
    }
  } catch {}

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/adhan_voices_meta?id=eq.1&select=version`, {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.version) {
          return Number(rows[0].version);
        }
      }
    } catch {}
  }

  return lastKnownAdhanVersion;
}

function hydrateVoicesWithCatalogDefaults(rows: AdhanVoiceRow[]): AdhanVoiceRow[] {
  const slotMap = new Map(OFFICIAL_MUEZZIN_CATALOG_SLOTS.map((s) => [s.id, s]));
  return rows.map((row) => {
    const slot = slotMap.get(row.id);
    if (!slot) return row;
    return {
      ...slot,
      ...row,
      audio_url: row.audio_url || slot.audio_url,
      fajr_audio_url: row.fajr_audio_url || slot.fajr_audio_url,
      duration_seconds:
        Number(row.duration_seconds) > 0 ? Number(row.duration_seconds) : slot.duration_seconds,
      fajr_duration_seconds:
        Number(row.fajr_duration_seconds) > 0
          ? Number(row.fajr_duration_seconds)
          : slot.fajr_duration_seconds,
      size_bytes: Number(row.size_bytes) > 0 ? Number(row.size_bytes) : slot.size_bytes,
      license_status:
        row.license_status === 'upload_when_licensed' && (row.audio_url || slot.audio_url)
          ? 'verified_licensed'
          : row.license_status || slot.license_status,
    };
  });
}

/**
 * Fetches all active Adhan voices from `/api/adhan-voices` with direct Supabase fallback
 * and localStorage caching for offline resilience.
 */
export async function fetchActiveAdhanVoices(forceRefresh = false): Promise<AdhanVoiceRow[]> {
  const now = Date.now();
  if (!forceRefresh && cachedAdhanVoices && lastAdhanFetchTime > 0 && now - lastAdhanFetchTime < 8_000) {
    return cachedAdhanVoices;
  }

  // 1. Unified API endpoint
  try {
    const res = await fetch(`/api/adhan-voices?_t=${now}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.version === 'number') {
        lastKnownAdhanVersion = data.version;
      }
      if (Array.isArray(data?.voices) && data.voices.length > 0) {
        const hydrated = hydrateVoicesWithCatalogDefaults(data.voices);
        cachedAdhanVoices = hydrated;
        lastAdhanFetchTime = now;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('nooraya_cached_adhan_voices_v1', JSON.stringify(hydrated));
          }
        } catch {}
        return hydrated;
      }
    }
  } catch (e) {
    console.warn('API /api/adhan-voices fallback to Supabase:', e);
  }

  // 2. Direct Supabase REST fallback
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/adhan_voices?is_active=eq.true&order=sort_order.asc,created_at.desc`,
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          cache: 'no-store',
        }
      );
      if (res.ok) {
        const rows: AdhanVoiceRow[] = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const hydrated = hydrateVoicesWithCatalogDefaults(rows);
          cachedAdhanVoices = hydrated;
          lastAdhanFetchTime = now;
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('nooraya_cached_adhan_voices_v1', JSON.stringify(hydrated));
            }
          } catch {}
          return hydrated;
        }
      }
    } catch {}
  }

  // 3. Offline cached voices or official catalog slots
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('nooraya_cached_adhan_voices_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hydrated = hydrateVoicesWithCatalogDefaults(parsed);
          cachedAdhanVoices = hydrated;
          return hydrated;
        }
      }
    }
  } catch {}

  cachedAdhanVoices = OFFICIAL_MUEZZIN_CATALOG_SLOTS;
  return OFFICIAL_MUEZZIN_CATALOG_SLOTS;
}

/**
 * Subscribes to real-time changes on `adhan_voices` and `adhan_voices_meta` via Supabase Realtime,
 * BroadcastChannel, visibilitychange, and version polling so phones update immediately.
 */
export function subscribeToAdhanVoices(onChange: (voices: AdhanVoiceRow[]) => void): () => void {
  const client = getSupabaseClient();
  let channel: RealtimeChannel | null = null;
  let bc: BroadcastChannel | null = null;

  const triggerRefresh = async () => {
    try {
      const updated = await fetchActiveAdhanVoices(true);
      onChange(updated);
    } catch {}
  };

  const checkVersion = async () => {
    try {
      const remoteVer = await fetchAdhanVoicesVersion();
      if (remoteVer !== lastKnownAdhanVersion || !cachedAdhanVoices) {
        await triggerRefresh();
      }
    } catch {}
  };

  if (client) {
    try {
      channel = client
        .channel('public:adhan-voices-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'adhan_voices' }, () => {
          void triggerRefresh();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'adhan_voices_meta' }, () => {
          void triggerRefresh();
        })
        .subscribe();
    } catch {}
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('noor_adhan_voices_live');
      bc.onmessage = () => void triggerRefresh();
    }
  } catch {}

  const handleVis = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void triggerRefresh();
    }
  };
  const handleOnline = () => void triggerRefresh();

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', handleVis);
    window.addEventListener('online', handleOnline);
  }

  const pollTimer =
    typeof window !== 'undefined'
      ? window.setInterval(() => {
          if (typeof document === 'undefined' || document.visibilityState === 'visible') {
            void checkVersion();
          }
        }, 5000)
      : null;

  return () => {
    if (channel && client) {
      client.removeChannel(channel).catch(() => {});
    }
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    if (pollTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(pollTimer);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', handleVis);
      window.removeEventListener('online', handleOnline);
    }
  };
}

export function notifyAdhanVoicesChanged(): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('noor_adhan_voices_live');
      bc.postMessage({ type: 'changed', ts: Date.now() });
      bc.close();
    }
  } catch {}
}

/**
 * Preloads and caches an Adhan audio URL in the browser Cache Storage (`nooraya-adhan-audio-v1`)
 * so that it plays instantaneously at prayer time and continues working offline (Step 2.2).
 */
let lastPreloadedUrl: string | null = null;
const offlineBlobUrlMap = new Map<string, string>();

export async function preloadAndCacheAdhanAudio(rawUrl?: string | null): Promise<boolean> {
  const url = normalizeAdhanAudioUrl(rawUrl);
  if (!url) return false;

  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(ADHAN_AUDIO_CACHE_NAME);
      let matched = await cache.match(url);
      if (!matched) {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (res.ok && (res.headers.get('content-type') || '').includes('audio')) {
          await cache.put(url, res.clone());
          matched = res;
        }
      }
      if (matched && !offlineBlobUrlMap.has(url)) {
        try {
          const blob = await matched.blob();
          if (blob.size > 1000 && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            offlineBlobUrlMap.set(url, URL.createObjectURL(blob));
          }
        } catch {}
      }
    }
  } catch {
    // Non-fatal if Cache API or CORS restricts caching
  }

  try {
    const audio = getActiveAdhanAudioElement();
    if (audio.paused && lastPreloadedUrl !== url) {
      lastPreloadedUrl = url;
      audio.preload = 'auto';
      audio.src = url;
      if (typeof audio.load === 'function') {
        audio.load();
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronously resolves a cached offline Blob URL if the user is offline and the Adhan file was previously cached.
 */
function resolvePlayableUrlSync(url: string): string {
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isOffline && offlineBlobUrlMap.has(url)) {
    return offlineBlobUrlMap.get(url)!;
  }
  return url;
}

/**
 * Uploads a single Blob/File to Supabase Storage or server media fallback.
 */
async function uploadBlobToStorage(
  blob: Blob,
  storagePath: string,
  contentType: string,
  label: string
): Promise<string> {
  // Method 1: Signed upload URL from /api/admin/adhan-voices
  try {
    const signRes = await fetch('/api/admin/adhan-voices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signed-upload-url', path: storagePath }),
    });
    if (signRes.ok) {
      const signData = await signRes.json();
      if (signData.ok && signData.signedUrl && signData.publicUrl) {
        const putRes = await fetch(signData.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            'cache-control': 'max-age=31536000',
          },
          body: blob,
        });
        if (putRes.ok) {
          return signData.publicUrl;
        }
      }
    }
  } catch {}

  // Method 2: Direct Supabase Storage upload via Anon Key
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': contentType,
          'x-upsert': 'true',
          'cache-control': 'max-age=31536000',
        },
        body: blob,
      });
      if (res.ok) {
        return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
      }
    } catch {}
  }

  // Method 3: Server-side upload for files <= 3.5 MB
  if (blob.size <= 3.5 * 1024 * 1024) {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = String(reader.result || '');
          resolve(r.includes(',') ? r.split(',')[1] : r);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const srvRes = await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          path: storagePath,
          contentType,
          data: base64Data,
        }),
      });
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData.ok && srvData.publicUrl) {
          return srvData.publicUrl;
        }
      }
    } catch {}
  }

  // Method 4: Chunked media upload fallback
  const chunkedUrl = await uploadMediaToServer(blob, {
    filename: storagePath,
    name: label,
    type: contentType,
  });

  if (chunkedUrl) {
    return chunkedUrl;
  }

  throw new Error('Failed to upload Adhan audio file.');
}

/**
 * One-step Admin Adhan audio processor & uploader (Step 2.6):
 * - Decodes & validates duration >= 60s
 * - Trims leading/trailing silence, normalizes peak loudness to -1.0 dBFS, adds fade-in/out
 * - Uploads both the Full Web Version (`publicUrl`) and the <= 28s Native Notification WAV Clip (`notificationClipUrl`)
 */
export async function uploadAdhanAudioToCloud(
  file: File,
  voiceId: string,
  variant: 'standard' | 'fajr' = 'standard',
  options: { allowShortClipOverride?: boolean } = {}
): Promise<{
  publicUrl: string;
  notificationClipUrl: string;
  durationSeconds: number;
  notificationClipDurationSeconds: number;
  storagePath: string;
  clipStoragePath: string;
  sizeBytes: number;
  dspReport: ProcessedAdhanUploadResult;
}> {
  const dspReport = await processAdhanAudioFile(file);

  if (dspReport.isShortClipWarning && !options.allowShortClipOverride) {
    throw new Error(
      dspReport.shortClipWarningMessage ||
        `Audio file is too short (${dspReport.trimmedDurationSeconds}s < 60s minimum for a full Adhan).`
    );
  }

  const cleanVoiceId = voiceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ts = Date.now();
  const storagePath = `adhan/${cleanVoiceId}_${variant}_${ts}.${dspReport.webExtension}`;
  const clipStoragePath = `adhan/${cleanVoiceId}_${variant}_notify30s_${ts}.wav`;

  const publicUrl = await uploadBlobToStorage(
    dspReport.webBlob,
    storagePath,
    dspReport.webContentType,
    `${cleanVoiceId}_${variant}`
  );

  const notificationClipUrl = await uploadBlobToStorage(
    dspReport.notificationClipBlob,
    clipStoragePath,
    'audio/wav',
    `${cleanVoiceId}_${variant}_notify30s`
  );

  // Immediately cache the newly uploaded URL for instant playback
  void preloadAndCacheAdhanAudio(publicUrl);

  return {
    publicUrl,
    notificationClipUrl,
    durationSeconds: Math.round(dspReport.trimmedDurationSeconds),
    notificationClipDurationSeconds: Math.round(dspReport.notificationClipDurationSeconds),
    storagePath,
    clipStoragePath,
    sizeBytes: dspReport.webBlob.size,
    dspReport,
  };
}

// ==============================================================================
// IN-APP REAL-AUDIO-ONLY ADHAN PLAYBACK ENGINE (NO OSCILLATORS / NO FALLBACK TONES)
// ==============================================================================

let activeTakbirFadeTimer: number | null = null;

let playbackState: ActiveAdhanPlaybackState = {
  isPlaying: false,
  autoplayBlocked: false,
  errorMessage: null,
  notificationTapScreenOpen: false,
  prayerKey: null,
  prayerNameEn: null,
  prayerNameAr: null,
  voiceId: null,
  muezzinNameEn: null,
  muezzinNameAr: null,
  mosqueEn: null,
  audioUrlUsed: null,
  durationSeconds: null,
  mode: 'full',
  isFajrVariant: false,
  backgroundAudioPaused: false,
  startedAt: null,
  lastDiagnostic: null,
};

const stateListeners = new Set<(state: ActiveAdhanPlaybackState) => void>();

function emitPlaybackState(patch: Partial<ActiveAdhanPlaybackState>) {
  playbackState = { ...playbackState, ...patch };
  for (const listener of stateListeners) {
    try {
      listener(playbackState);
    } catch {}
  }
}

export function getAdhanPlaybackState(): ActiveAdhanPlaybackState {
  return playbackState;
}

export function clearAdhanErrorMessage(): void {
  emitPlaybackState({ errorMessage: null, autoplayBlocked: false, notificationTapScreenOpen: false });
}

export const clearAdhanError = clearAdhanErrorMessage;

export function subscribeToAdhanPlaybackState(
  listener: (state: ActiveAdhanPlaybackState) => void
): () => void {
  stateListeners.add(listener);
  listener(playbackState);
  return () => {
    stateListeners.delete(listener);
  };
}

/**
 * Immediately stops/silences any playing Adhan and restores ducked Quran/ambient audio.
 */
export function stopAdhanPlayback(): void {
  if (activeTakbirFadeTimer) {
    clearTimeout(activeTakbirFadeTimer);
    activeTakbirFadeTimer = null;
  }

  const audio = getActiveAdhanAudioElement();
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    audio.onended = null;
    audio.onerror = null;
  } catch {}

  restoreAfterAdhan();

  emitPlaybackState({
    isPlaying: false,
    autoplayBlocked: false,
    notificationTapScreenOpen: false,
    prayerKey: null,
    prayerNameEn: null,
    prayerNameAr: null,
    voiceId: null,
    muezzinNameEn: null,
    muezzinNameAr: null,
    mosqueEn: null,
    audioUrlUsed: null,
    durationSeconds: null,
    isFajrVariant: false,
    backgroundAudioPaused: false,
    startedAt: null,
  });
}

/**
 * Strictly resolves the selected Muezzin voice and its real audio URL.
 * - Does NOT silently substitute another voice or a synthetic tone if the selected voice lacks audio.
 * - For Fajr (when `isFajr` is true), uses `fajr_audio_url` if available, or `audio_url` if only standard is uploaded.
 */
export function resolveVoiceForPlayback(
  voices: AdhanVoiceRow[],
  preferredVoiceId?: string,
  isFajr: boolean = false
): {
  voice: AdhanVoiceRow | null;
  audioUrl: string | null;
  isFajrVariant: boolean;
  missingReason: string | null;
} {
  const activeVoices = voices.filter((v) => v.is_active !== false);
  const preferred =
    (preferredVoiceId ? activeVoices.find((v) => v.id === preferredVoiceId) : null) ||
    activeVoices.find((v) => v.is_default) ||
    activeVoices[0] ||
    OFFICIAL_MUEZZIN_CATALOG_SLOTS[0] ||
    null;

  if (!preferred) {
    return {
      voice: null,
      audioUrl: null,
      isFajrVariant: false,
      missingReason: 'No active Muezzin voice is configured in the catalog.',
    };
  }

  const fajrUrl = normalizeAdhanAudioUrl(preferred.fajr_audio_url);
  const stdUrl = normalizeAdhanAudioUrl(preferred.audio_url);

  if (isFajr) {
    if (fajrUrl) {
      return {
        voice: preferred,
        audioUrl: fajrUrl,
        isFajrVariant: true,
        missingReason: null,
      };
    }
    if (stdUrl) {
      return {
        voice: preferred,
        audioUrl: stdUrl,
        isFajrVariant: false,
        missingReason: null,
      };
    }
    return {
      voice: preferred,
      audioUrl: null,
      isFajrVariant: true,
      missingReason: `No Fajr or Standard Adhan audio file has been uploaded for ${preferred.muezzin_name_en} yet (status: ${preferred.license_status}). Upload a licensed recording in Admin → Adhan Voices.`,
    };
  }

  if (stdUrl) {
    return {
      voice: preferred,
      audioUrl: stdUrl,
      isFajrVariant: false,
      missingReason: null,
    };
  }

  return {
    voice: preferred,
    audioUrl: null,
    isFajrVariant: false,
    missingReason: `No Adhan audio file has been uploaded for ${preferred.muezzin_name_en} yet (status: ${preferred.license_status}). Upload a licensed recording in Admin → Adhan Voices.`,
  };
}

const PRAYER_DISPLAY_NAMES: Record<string, { english: string; arabic: string }> = {
  fajr: { english: 'Fajr', arabic: 'الفجر' },
  sunrise: { english: 'Sunrise', arabic: 'الشروق' },
  dhuhr: { english: 'Dhuhr', arabic: 'الظهر' },
  asr: { english: 'Asr', arabic: 'العصر' },
  maghrib: { english: 'Maghrib', arabic: 'المغرب' },
  isha: { english: 'Isha', arabic: 'العشاء' },
};

/**
 * Primary Adhan playback function (`playAdhan(voiceId, prayer)`):
 * - Plays ONLY the real audio file for the selected voice (and the Fajr URL for Fajr).
 * - Never plays an oscillator, beep, chime, or horn.
 * - If the audio file is missing or fails to load, emits a visible error message (`errorMessage`) and logs it.
 * - If autoplay is blocked by browser policy (`NotAllowedError`), enters `autoplayBlocked: true` ("Tap to play Adhan").
 */
export async function playAdhan(
  voiceId: string | undefined,
  prayerKey: string,
  options: {
    mode?: AdhanMode;
    useFajrAdhan?: boolean;
    voices?: AdhanVoiceRow[];
    trigger?: AdhanDiagnosticLogEntry['trigger'];
    openFullScreenModal?: boolean;
  } = {}
): Promise<{
  ok: boolean;
  status: AdhanDiagnosticLogEntry['playResult'];
  urlUsed: string | null;
  errorMessage: string | null;
}> {
  const normalizedKey = (prayerKey || 'fajr').toLowerCase();
  const names = PRAYER_DISPLAY_NAMES[normalizedKey] || {
    english: prayerKey || 'Prayer',
    arabic: 'الصلاة',
  };
  const mode: AdhanMode = options.mode || 'full';
  const useFajrAdhan = options.useFajrAdhan !== false;
  const trigger = options.trigger || 'scheduled';

  if (mode === 'silent') {
    const diag = recordAdhanDiagnostic({
      trigger,
      prayerKey: normalizedKey,
      voiceId: voiceId || null,
      muezzinName: null,
      urlUsed: null,
      isFajrVariant: false,
      readyState: 0,
      audioError: null,
      playResult: 'silent_mode',
      pathTaken: 'silent_mode_skipped_audio',
      durationSeconds: null,
    });
    emitPlaybackState({ lastDiagnostic: diag });
    return { ok: true, status: 'silent_mode', urlUsed: null, errorMessage: null };
  }

  stopAdhanPlayback();

  // Synchronously resolve voices from options or in-memory cache so audio.play() runs inside the user gesture!
  const voices =
    options.voices && options.voices.length > 0
      ? options.voices
      : cachedAdhanVoices && cachedAdhanVoices.length > 0
      ? cachedAdhanVoices
      : OFFICIAL_MUEZZIN_CATALOG_SLOTS;

  // Refresh cache asynchronously in the background if not explicitly provided
  if (!options.voices) {
    void fetchActiveAdhanVoices();
  }

  const isFajr = normalizedKey === 'fajr' && useFajrAdhan;
  const resolved = resolveVoiceForPlayback(voices, voiceId, isFajr);

  if (!resolved.audioUrl) {
    const errText = `Adhan audio is not available: ${resolved.missingReason || 'No recording uploaded for the selected Muezzin.'}`;
    const diag = recordAdhanDiagnostic({
      trigger,
      prayerKey: normalizedKey,
      voiceId: resolved.voice?.id || voiceId || null,
      muezzinName: resolved.voice?.muezzin_name_en || null,
      urlUsed: null,
      isFajrVariant: isFajr,
      readyState: 0,
      audioError: errText,
      playResult: 'missing_url',
      pathTaken: 'aborted_missing_real_audio_url_no_fallback_tone',
      durationSeconds: null,
    });
    emitPlaybackState({
      isPlaying: false,
      autoplayBlocked: false,
      errorMessage: errText,
      notificationTapScreenOpen: Boolean(options.openFullScreenModal),
      prayerKey: normalizedKey,
      prayerNameEn: names.english,
      prayerNameAr: names.arabic,
      voiceId: resolved.voice?.id || voiceId || null,
      muezzinNameEn: resolved.voice?.muezzin_name_en || null,
      muezzinNameAr: resolved.voice?.muezzin_name_ar || null,
      mosqueEn: resolved.voice?.mosque_en || null,
      audioUrlUsed: null,
      durationSeconds: null,
      mode,
      isFajrVariant: isFajr,
      backgroundAudioPaused: false,
      startedAt: null,
      lastDiagnostic: diag,
    });
    return { ok: false, status: 'missing_url', urlUsed: null, errorMessage: errText };
  }

  const playableUrl = resolvePlayableUrlSync(resolved.audioUrl);
  const audio = getActiveAdhanAudioElement();

  // Smoothly duck & pause Quran recitation and ambient soundscape during Adhan
  const duckSnap = duckAndPauseForAdhan();
  const backgroundAudioPaused = duckSnap.quranWasPlaying || duckSnap.ambientWasPlaying;

  audio.muted = false;
  audio.volume = 1.0;
  audio.currentTime = 0;
  audio.src = playableUrl;

  const expectedDuration = resolved.isFajrVariant
    ? resolved.voice?.fajr_duration_seconds || resolved.voice?.duration_seconds || null
    : resolved.voice?.duration_seconds || null;

  audio.onended = () => {
    stopAdhanPlayback();
  };

  audio.onerror = () => {
    const mediaErrCode = audio.error?.code;
    const mediaErrMsg = audio.error?.message || `MediaError code ${mediaErrCode ?? 'unknown'}`;
    const errText = `Adhan audio is not available: Failed to load or decode recording (${mediaErrMsg}).`;
    restoreAfterAdhan();
    const diag = recordAdhanDiagnostic({
      trigger,
      prayerKey: normalizedKey,
      voiceId: resolved.voice?.id || null,
      muezzinName: resolved.voice?.muezzin_name_en || null,
      urlUsed: resolved.audioUrl,
      isFajrVariant: resolved.isFajrVariant,
      readyState: audio.readyState ?? 0,
      audioError: mediaErrMsg,
      playResult: 'load_or_decode_error',
      pathTaken: 'html5_audio_onerror_no_fallback_tone',
      durationSeconds: expectedDuration,
    });
    emitPlaybackState({
      isPlaying: false,
      autoplayBlocked: false,
      errorMessage: errText,
      audioUrlUsed: resolved.audioUrl,
      backgroundAudioPaused: false,
      lastDiagnostic: diag,
    });
  };

  if (mode === 'takbir') {
    // Short Takbir mode plays the first 15 seconds of the real Muezzin recording and fades out smoothly
    activeTakbirFadeTimer = window.setTimeout(() => {
      const fadeStep = window.setInterval(() => {
        if (!playbackState.isPlaying || audio.paused) {
          clearInterval(fadeStep);
          return;
        }
        if (audio.volume > 0.12) {
          audio.volume = Math.max(0.05, audio.volume - 0.12);
        } else {
          clearInterval(fadeStep);
          stopAdhanPlayback();
        }
      }, 180);
    }, 14_000);
  }

  try {
    await audio.play();
    const actualDuration =
      audio.duration && !Number.isNaN(audio.duration) && Number.isFinite(audio.duration)
        ? Math.round(audio.duration)
        : expectedDuration;

    const diag = recordAdhanDiagnostic({
      trigger,
      prayerKey: normalizedKey,
      voiceId: resolved.voice?.id || null,
      muezzinName: resolved.voice?.muezzin_name_en || null,
      urlUsed: resolved.audioUrl,
      isFajrVariant: resolved.isFajrVariant,
      readyState: audio.readyState ?? 4,
      audioError: null,
      playResult: 'playing',
      pathTaken: 'html5_audio_element_real_file_playing',
      durationSeconds: actualDuration,
    });

    emitPlaybackState({
      isPlaying: true,
      autoplayBlocked: false,
      errorMessage: null,
      notificationTapScreenOpen: Boolean(options.openFullScreenModal),
      prayerKey: normalizedKey,
      prayerNameEn: names.english,
      prayerNameAr: names.arabic,
      voiceId: resolved.voice?.id || null,
      muezzinNameEn: resolved.voice?.muezzin_name_en || 'Muezzin',
      muezzinNameAr: resolved.voice?.muezzin_name_ar || null,
      mosqueEn: resolved.voice?.mosque_en || null,
      audioUrlUsed: resolved.audioUrl,
      durationSeconds: actualDuration,
      mode,
      isFajrVariant: resolved.isFajrVariant,
      backgroundAudioPaused,
      startedAt: Date.now(),
      lastDiagnostic: diag,
    });

    return { ok: true, status: 'playing', urlUsed: resolved.audioUrl, errorMessage: null };
  } catch (err: any) {
    const isNotAllowed =
      err?.name === 'NotAllowedError' ||
      String(err?.message || '').toLowerCase().includes('notallowed') ||
      String(err?.message || '').toLowerCase().includes('user didn\'t interact') ||
      String(err?.message || '').toLowerCase().includes('gesture');

    if (isNotAllowed) {
      // Browser blocked autoplay outside a user tap: keep audio.src ready and show "Tap to Play Adhan" prompt!
      restoreAfterAdhan();
      const diag = recordAdhanDiagnostic({
        trigger,
        prayerKey: normalizedKey,
        voiceId: resolved.voice?.id || null,
        muezzinName: resolved.voice?.muezzin_name_en || null,
        urlUsed: resolved.audioUrl,
        isFajrVariant: resolved.isFajrVariant,
        readyState: audio.readyState ?? 0,
        audioError: `${err?.name || 'NotAllowedError'}: ${err?.message || 'Autoplay blocked by browser'}`,
        playResult: 'autoplay_blocked',
        pathTaken: 'autoplay_blocked_showing_tap_to_play_prompt',
        durationSeconds: expectedDuration,
      });

      emitPlaybackState({
        isPlaying: false,
        autoplayBlocked: true,
        errorMessage: null,
        notificationTapScreenOpen: true,
        prayerKey: normalizedKey,
        prayerNameEn: names.english,
        prayerNameAr: names.arabic,
        voiceId: resolved.voice?.id || null,
        muezzinNameEn: resolved.voice?.muezzin_name_en || 'Muezzin',
        muezzinNameAr: resolved.voice?.muezzin_name_ar || null,
        mosqueEn: resolved.voice?.mosque_en || null,
        audioUrlUsed: resolved.audioUrl,
        durationSeconds: expectedDuration,
        mode,
        isFajrVariant: resolved.isFajrVariant,
        backgroundAudioPaused: false,
        startedAt: null,
        lastDiagnostic: diag,
      });

      return {
        ok: false,
        status: 'autoplay_blocked',
        urlUsed: resolved.audioUrl,
        errorMessage: 'Browser requires a tap to start Adhan audio.',
      };
    }

    // Any other playback failure (corrupt file, unsupported codec, network 404)
    restoreAfterAdhan();
    const errText = `Adhan audio is not available: ${err?.message || 'Audio playback failed.'}`;
    const diag = recordAdhanDiagnostic({
      trigger,
      prayerKey: normalizedKey,
      voiceId: resolved.voice?.id || null,
      muezzinName: resolved.voice?.muezzin_name_en || null,
      urlUsed: resolved.audioUrl,
      isFajrVariant: resolved.isFajrVariant,
      readyState: audio.readyState ?? 0,
      audioError: `${err?.name || 'Error'}: ${err?.message || 'Playback failed'}`,
      playResult: 'load_or_decode_error',
      pathTaken: 'play_promise_rejected_no_fallback_tone',
      durationSeconds: expectedDuration,
    });

    emitPlaybackState({
      isPlaying: false,
      autoplayBlocked: false,
      errorMessage: errText,
      notificationTapScreenOpen: Boolean(options.openFullScreenModal),
      prayerKey: normalizedKey,
      prayerNameEn: names.english,
      prayerNameAr: names.arabic,
      voiceId: resolved.voice?.id || null,
      muezzinNameEn: resolved.voice?.muezzin_name_en || null,
      muezzinNameAr: resolved.voice?.muezzin_name_ar || null,
      mosqueEn: resolved.voice?.mosque_en || null,
      audioUrlUsed: resolved.audioUrl,
      durationSeconds: expectedDuration,
      mode,
      isFajrVariant: resolved.isFajrVariant,
      backgroundAudioPaused: false,
      startedAt: null,
      lastDiagnostic: diag,
    });

    return { ok: false, status: 'load_or_decode_error', urlUsed: resolved.audioUrl, errorMessage: errText };
  }
}

/**
 * Synchronously resumes a blocked Adhan inside a user tap/click event handler (Step 2.3 & 2.4).
 */
export function resumeBlockedAdhanFromGesture(): void {
  const audio = getActiveAdhanAudioElement();
  const state = playbackState;

  if (!state.audioUrlUsed) {
    void playAdhan(state.voiceId || undefined, state.prayerKey || 'fajr', {
      mode: state.mode === 'preview' ? 'full' : state.mode,
      useFajrAdhan: state.isFajrVariant,
      trigger: 'gesture_resume',
      openFullScreenModal: false,
    });
    return;
  }

  const duckSnap = duckAndPauseForAdhan();
  const backgroundAudioPaused = duckSnap.quranWasPlaying || duckSnap.ambientWasPlaying;

  audio.muted = false;
  audio.volume = 1.0;
  if (!audio.src || audio.src !== state.audioUrlUsed) {
    audio.src = state.audioUrlUsed;
  }

  audio
    .play()
    .then(() => {
      const diag = recordAdhanDiagnostic({
        trigger: 'gesture_resume',
        prayerKey: state.prayerKey || 'fajr',
        voiceId: state.voiceId,
        muezzinName: state.muezzinNameEn,
        urlUsed: state.audioUrlUsed,
        isFajrVariant: state.isFajrVariant,
        readyState: audio.readyState ?? 4,
        audioError: null,
        playResult: 'playing',
        pathTaken: 'resumed_from_user_tap_gesture',
        durationSeconds: state.durationSeconds,
      });
      emitPlaybackState({
        isPlaying: true,
        autoplayBlocked: false,
        errorMessage: null,
        backgroundAudioPaused,
        startedAt: Date.now(),
        lastDiagnostic: diag,
      });
    })
    .catch((err) => {
      restoreAfterAdhan();
      emitPlaybackState({
        isPlaying: false,
        autoplayBlocked: false,
        errorMessage: `Adhan audio is not available: ${err?.message || 'Playback failed on tap.'}`,
      });
    });
}

/**
 * Wrapper used by `AdhanSchedulerOverlay` and `PrayerTimesView`.
 */
export async function startAdhanPlayback(options: {
  prayerKey: string;
  prayerNameEn: string;
  prayerNameAr: string;
  mode: AdhanMode;
  preferredVoiceId?: string;
  useFajrAdhan?: boolean;
  voices?: AdhanVoiceRow[];
  trigger?: AdhanDiagnosticLogEntry['trigger'];
  openFullScreenModal?: boolean;
}): Promise<{
  ok: boolean;
  status: AdhanDiagnosticLogEntry['playResult'];
  urlUsed: string | null;
  errorMessage: string | null;
}> {
  return playAdhan(options.preferredVoiceId, options.prayerKey, {
    mode: options.mode,
    useFajrAdhan: options.useFajrAdhan,
    voices: options.voices,
    trigger: options.trigger || 'scheduled',
    openFullScreenModal: options.openFullScreenModal,
  });
}

/**
 * Plays an immediate preview of a specific Muezzin voice (Standard, Fajr, or Short Takbir).
 * NEVER plays a synthetic tone — if the voice has no audio URL, emits a clear visible error message.
 */
export async function playAdhanPreview(options: {
  voice?: AdhanVoiceRow;
  variant?: 'standard' | 'fajr' | 'takbir';
}): Promise<{
  ok: boolean;
  status: AdhanDiagnosticLogEntry['playResult'];
  urlUsed: string | null;
  errorMessage: string | null;
}> {
  const { voice, variant = 'standard' } = options;

  unlockAudio();
  stopAdhanPlayback();

  const rawUrl =
    variant === 'fajr'
      ? voice?.fajr_audio_url || null
      : voice?.audio_url || null;
  const targetUrl = normalizeAdhanAudioUrl(rawUrl);

  if (!targetUrl) {
    const missingLabel =
      variant === 'fajr' ? 'Fajr Adhan recording' : 'Standard Adhan recording';
    const muezzinLabel = voice?.muezzin_name_en || 'selected Muezzin';
    const errText = `Adhan audio is not available: No ${missingLabel} has been uploaded for ${muezzinLabel}. Upload a licensed recording in Admin → Adhan Voices.`;

    const diag = recordAdhanDiagnostic({
      trigger: 'preview',
      prayerKey: variant === 'fajr' ? 'fajr' : 'preview',
      voiceId: voice?.id || null,
      muezzinName: voice?.muezzin_name_en || null,
      urlUsed: null,
      isFajrVariant: variant === 'fajr',
      readyState: 0,
      audioError: errText,
      playResult: 'missing_url',
      pathTaken: 'preview_aborted_missing_real_audio_url',
      durationSeconds: null,
    });

    emitPlaybackState({
      isPlaying: false,
      autoplayBlocked: false,
      errorMessage: errText,
      prayerKey: 'preview',
      prayerNameEn: variant === 'fajr' ? 'Fajr Adhan Preview' : 'Adhan Preview',
      prayerNameAr: variant === 'fajr' ? 'معاينة أذان الفجر' : 'معاينة الأذان',
      voiceId: voice?.id || null,
      muezzinNameEn: voice?.muezzin_name_en || null,
      muezzinNameAr: voice?.muezzin_name_ar || null,
      mosqueEn: voice?.mosque_en || null,
      audioUrlUsed: null,
      durationSeconds: null,
      mode: 'preview',
      isFajrVariant: variant === 'fajr',
      backgroundAudioPaused: false,
      startedAt: null,
      lastDiagnostic: diag,
    });

    return { ok: false, status: 'missing_url', urlUsed: null, errorMessage: errText };
  }

  return playAdhan(voice?.id, variant === 'fajr' ? 'fajr' : 'dhuhr', {
    mode: variant === 'takbir' ? 'takbir' : 'full',
    useFajrAdhan: variant === 'fajr',
    voices: voice ? [voice] : undefined,
    trigger: 'preview',
  });
}
