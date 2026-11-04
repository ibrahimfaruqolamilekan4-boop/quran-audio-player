/**
 * Nooraya Adhan Voices & In-App Playback Engine (Phase 2)
 *
 * - Zero hardcoded audio URLs: all muezzin voices live in the `adhan_voices` table
 *   and Supabase Storage, managed by the Admin Portal and synced live via Supabase Realtime.
 * - Includes verified official Prophet's Mosque (Al-Masjid an-Nabawi) muezzins
 *   (under the Presidency of Religious Affairs at the Grand Mosque and the Prophet's Mosque)
 *   and Sheikh Mishary Rashid Alafasy with transparent licensing states ('upload_when_licensed'
 *   until an admin uploads a cleared recording).
 * - Supports separate Fajr Adhan ("As-salatu khayrun min an-nawm").
 * - Supports per-prayer modes: 'full' | 'takbir' | 'chime' | 'silent'.
 * - Ducks/pauses Quran recitation & ambient audio during Adhan and resumes afterward.
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
import type { RealtimeChannel } from '@supabase/supabase-js';

export type AdhanMode = 'full' | 'takbir' | 'chime' | 'silent';

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
  duration_seconds?: number | null;
  fajr_duration_seconds?: number | null;
  size_bytes?: number | null;
  storage_paths?: string[] | null;
  license_status: AdhanLicenseStatus;
  license_notes?: string | null;
  source_url?: string | null;
  official_verified?: boolean;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ActiveAdhanPlaybackState {
  isPlaying: boolean;
  prayerKey: string | null;
  prayerNameEn: string | null;
  prayerNameAr: string | null;
  muezzinNameEn: string | null;
  muezzinNameAr: string | null;
  mode: AdhanMode | 'preview';
  isFajrVariant: boolean;
  usedFallbackChime: boolean;
  backgroundAudioPaused: boolean;
  startedAt: number | null;
}

/**
 * Verified official Muezzins of Al-Masjid an-Nabawi (Prophet's Mosque, Madinah)
 * under the Presidency of Religious Affairs at the Grand Mosque and the Prophet's Mosque,
 * plus Sheikh Mishary Rashid Alafasy.
 * No hardcoded audio URLs — slots remain 'upload_when_licensed' until Admin uploads audio.
 */
export const OFFICIAL_MUEZZIN_CATALOG_SLOTS: AdhanVoiceRow[] = [
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

let cachedAdhanVoices: AdhanVoiceRow[] | null = null;
let lastAdhanFetchTime = 0;
let lastKnownAdhanVersion = 0;

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

/**
 * Fetches all active Adhan voices from `/api/adhan-voices` with direct Supabase fallback
 * and localStorage caching for offline resilience.
 */
export async function fetchActiveAdhanVoices(forceRefresh = false): Promise<AdhanVoiceRow[]> {
  const now = Date.now();
  if (!forceRefresh && cachedAdhanVoices && now - lastAdhanFetchTime < 8_000) {
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
        cachedAdhanVoices = data.voices;
        lastAdhanFetchTime = now;
        try {
          localStorage.setItem('nooraya_cached_adhan_voices_v1', JSON.stringify(data.voices));
        } catch {}
        return data.voices;
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
          cachedAdhanVoices = rows;
          lastAdhanFetchTime = now;
          try {
            localStorage.setItem('nooraya_cached_adhan_voices_v1', JSON.stringify(rows));
          } catch {}
          return rows;
        }
      }
    } catch {}
  }

  // 3. Offline cached voices or official catalog slots
  try {
    const raw = localStorage.getItem('nooraya_cached_adhan_voices_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedAdhanVoices = parsed;
        return parsed;
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
    if (document.visibilityState === 'visible') {
      void triggerRefresh();
    }
  };
  const handleOnline = () => void triggerRefresh();

  window.addEventListener('visibilitychange', handleVis);
  window.addEventListener('focus', handleVis);
  window.addEventListener('online', handleOnline);

  const pollTimer = window.setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void checkVersion();
    }
  }, 5000);

  return () => {
    if (channel && client) {
      client.removeChannel(channel).catch(() => {});
    }
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.clearInterval(pollTimer);
    window.removeEventListener('visibilitychange', handleVis);
    window.removeEventListener('focus', handleVis);
    window.removeEventListener('online', handleOnline);
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
 * Probes an audio file's duration in seconds before uploading.
 */
export async function probeAudioFileDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    const url = URL.createObjectURL(file);
    audio.src = url;

    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(180);
    }, 2500);

    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(Math.round(audio.duration || 180));
    };

    audio.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(180);
    };
  });
}

/**
 * Uploads an Adhan audio file (Standard or Fajr) to Supabase Storage / Server Media
 * and returns its public URL, duration, and storage path.
 */
export async function uploadAdhanAudioToCloud(
  file: File,
  voiceId: string,
  variant: 'standard' | 'fajr' = 'standard'
): Promise<{ publicUrl: string; durationSeconds: number; storagePath: string; sizeBytes: number }> {
  const durationSeconds = await probeAudioFileDuration(file);
  const extMatch = file.name.match(/\.(mp3|m4a|wav|ogg|aac)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
  const contentType =
    file.type && file.type.startsWith('audio/')
      ? file.type
      : ext === 'm4a'
      ? 'audio/mp4'
      : ext === 'wav'
      ? 'audio/wav'
      : ext === 'ogg'
      ? 'audio/ogg'
      : 'audio/mpeg';

  const cleanVoiceId = voiceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `adhan/${cleanVoiceId}_${variant}_${Date.now()}.${ext}`;

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
          body: file,
        });
        if (putRes.ok) {
          return {
            publicUrl: signData.publicUrl,
            durationSeconds,
            storagePath,
            sizeBytes: file.size,
          };
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
        body: file,
      });
      if (res.ok) {
        return {
          publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`,
          durationSeconds,
          storagePath,
          sizeBytes: file.size,
        };
      }
    } catch {}
  }

  // Method 3: Server-side upload for files <= 3.5 MB
  if (file.size <= 3.5 * 1024 * 1024) {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = String(reader.result || '');
          resolve(r.includes(',') ? r.split(',')[1] : r);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
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
          return {
            publicUrl: srvData.publicUrl,
            durationSeconds,
            storagePath,
            sizeBytes: file.size,
          };
        }
      }
    } catch {}
  }

  // Method 4: Chunked media upload fallback (supports large audio files on any server)
  const chunkedUrl = await uploadMediaToServer(file, {
    filename: storagePath,
    name: `${cleanVoiceId}_${variant}`,
    type: contentType,
  });

  if (chunkedUrl) {
    return {
      publicUrl: chunkedUrl,
      durationSeconds,
      storagePath,
      sizeBytes: file.size,
    };
  }

  throw new Error('Failed to upload Adhan audio file.');
}

// ==============================================================================
// IN-APP ADHAN PLAYBACK & WEBAUDIO CHIME / TAKBIR ENGINE
// ==============================================================================

let activeAudioCtx: AudioContext | null = null;
let activeSynthStopTimer: number | null = null;
let activeTakbirFadeTimer: number | null = null;

let playbackState: ActiveAdhanPlaybackState = {
  isPlaying: false,
  prayerKey: null,
  prayerNameEn: null,
  prayerNameAr: null,
  muezzinNameEn: null,
  muezzinNameAr: null,
  mode: 'full',
  isFajrVariant: false,
  usedFallbackChime: false,
  backgroundAudioPaused: false,
  startedAt: null,
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
 * Synthesizes a serene Medina Emerald harmonic bell chime or dual-phrase Takbir cadence
 * using the browser's Web Audio API (100% offline, zero hardcoded audio files).
 */
function playSynthesizedSanctuaryTone(variant: 'chime' | 'takbir', onEnded: () => void): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) {
      onEnded();
      return;
    }

    if (activeAudioCtx) {
      try {
        activeAudioCtx.close();
      } catch {}
    }

    const ctx: AudioContext = new Ctx();
    activeAudioCtx = ctx;

    const notes =
      variant === 'chime'
        ? [
            { freq: 528, start: 0.0, duration: 2.2, gain: 0.22 },
            { freq: 660, start: 0.55, duration: 2.4, gain: 0.18 },
            { freq: 792, start: 1.15, duration: 3.0, gain: 0.16 },
          ]
        : [
            // Dual-phrase reverent Takbir cadence
            { freq: 440, start: 0.0, duration: 1.2, gain: 0.22 },
            { freq: 554.37, start: 0.85, duration: 1.8, gain: 0.22 },
            { freq: 440, start: 2.8, duration: 1.2, gain: 0.22 },
            { freq: 554.37, start: 3.65, duration: 1.6, gain: 0.2 },
            { freq: 659.25, start: 4.8, duration: 2.8, gain: 0.18 },
          ];

    const now = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(n.freq * 2, now + n.start);

      const harmonicGain = ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.04, now + n.start);

      gainNode.gain.setValueAtTime(0.0001, now + n.start);
      gainNode.gain.exponentialRampToValueAtTime(n.gain, now + n.start + 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.duration);

      osc.connect(gainNode);
      harmonic.connect(harmonicGain);
      harmonicGain.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + n.start);
      harmonic.start(now + n.start);
      osc.stop(now + n.start + n.duration + 0.05);
      harmonic.stop(now + n.start + n.duration + 0.05);
    }

    const totalMs = variant === 'chime' ? 4300 : 7800;
    activeSynthStopTimer = window.setTimeout(() => {
      activeSynthStopTimer = null;
      if (activeAudioCtx === ctx) {
        try {
          ctx.close();
        } catch {}
        activeAudioCtx = null;
      }
      onEnded();
    }, totalMs);
  } catch {
    onEnded();
  }
}

/**
 * Immediately stops/silences any playing Adhan or chime and restores ducked Quran/ambient audio.
 */
export function stopAdhanPlayback(): void {
  if (activeSynthStopTimer) {
    clearTimeout(activeSynthStopTimer);
    activeSynthStopTimer = null;
  }
  if (activeTakbirFadeTimer) {
    clearTimeout(activeTakbirFadeTimer);
    activeTakbirFadeTimer = null;
  }
  if (activeAudioCtx) {
    try {
      activeAudioCtx.close();
    } catch {}
    activeAudioCtx = null;
  }

  const audio = getAdhanAudio();
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
    prayerKey: null,
    prayerNameEn: null,
    prayerNameAr: null,
    muezzinNameEn: null,
    muezzinNameAr: null,
    isFajrVariant: false,
    usedFallbackChime: false,
    backgroundAudioPaused: false,
    startedAt: null,
  });
}

/**
 * Resolves the best matching Muezzin voice from the catalog:
 * 1. Matches `preferredVoiceId` if it has an uploaded recording.
 * 2. Else falls back to the Admin default voice (`is_default`) if it has an uploaded recording.
 * 3. Else falls back to the first active voice with an uploaded recording.
 * 4. Else returns the matched catalog metadata slot (so UI displays the Muezzin name while playing the sanctuary chime).
 */
export function resolveVoiceForPlayback(
  voices: AdhanVoiceRow[],
  preferredVoiceId?: string,
  isFajr: boolean = false
): {
  voice: AdhanVoiceRow | null;
  audioUrl: string | null;
  isFajrVariant: boolean;
} {
  const activeVoices = voices.filter((v) => v.is_active !== false);
  const preferred = activeVoices.find((v) => v.id === preferredVoiceId) || null;
  const defaultVoice = activeVoices.find((v) => v.is_default && (v.audio_url || v.fajr_audio_url)) || null;
  const firstWithAudio = activeVoices.find((v) => Boolean(v.audio_url || v.fajr_audio_url)) || null;

  const pickUrl = (v: AdhanVoiceRow | null): { url: string | null; fajrUsed: boolean } => {
    if (!v) return { url: null, fajrUsed: false };
    if (isFajr && v.fajr_audio_url) {
      return { url: v.fajr_audio_url, fajrUsed: true };
    }
    if (v.audio_url) {
      return { url: v.audio_url, fajrUsed: false };
    }
    if (v.fajr_audio_url) {
      return { url: v.fajr_audio_url, fajrUsed: true };
    }
    return { url: null, fajrUsed: false };
  };

  const prefPick = pickUrl(preferred);
  if (prefPick.url && preferred) {
    return { voice: preferred, audioUrl: prefPick.url, isFajrVariant: prefPick.fajrUsed };
  }

  const defPick = pickUrl(defaultVoice);
  if (defPick.url && defaultVoice) {
    return { voice: defaultVoice, audioUrl: defPick.url, isFajrVariant: defPick.fajrUsed };
  }

  const anyPick = pickUrl(firstWithAudio);
  if (anyPick.url && firstWithAudio) {
    return { voice: firstWithAudio, audioUrl: anyPick.url, isFajrVariant: anyPick.fajrUsed };
  }

  const fallbackSlot = preferred || activeVoices[0] || OFFICIAL_MUEZZIN_CATALOG_SLOTS[0] || null;
  return { voice: fallbackSlot, audioUrl: null, isFajrVariant: false };
}

/**
 * Triggers in-app Adhan playback (or preview) with automatic ducking/pausing of Quran & ambient audio
 * and automatic resumption upon completion or manual stop.
 */
export async function startAdhanPlayback(options: {
  prayerKey: string;
  prayerNameEn: string;
  prayerNameAr: string;
  mode: AdhanMode;
  preferredVoiceId?: string;
  useFajrAdhan?: boolean;
  voices?: AdhanVoiceRow[];
}): Promise<void> {
  const {
    prayerKey,
    prayerNameEn,
    prayerNameAr,
    mode,
    preferredVoiceId,
    useFajrAdhan = true,
    voices: providedVoices,
  } = options;

  if (mode === 'silent') {
    return;
  }

  unlockAudio();
  stopAdhanPlayback();

  const voices = providedVoices || (await fetchActiveAdhanVoices());
  const isFajr = prayerKey === 'fajr' && useFajrAdhan;
  const resolved = resolveVoiceForPlayback(voices, preferredVoiceId, isFajr);

  // Duck & pause Quran recitation and ambient soundscape during Adhan
  const duckSnap = duckAndPauseForAdhan();
  const backgroundAudioPaused = duckSnap.quranWasPlaying || duckSnap.ambientWasPlaying;

  const finishPlayback = () => {
    stopAdhanPlayback();
  };

  if (mode === 'chime') {
    emitPlaybackState({
      isPlaying: true,
      prayerKey,
      prayerNameEn,
      prayerNameAr,
      muezzinNameEn: 'Medina Sanctuary Chime',
      muezzinNameAr: 'تنبيه الحرم الهادئ',
      mode: 'chime',
      isFajrVariant: false,
      usedFallbackChime: false,
      backgroundAudioPaused,
      startedAt: Date.now(),
    });
    playSynthesizedSanctuaryTone('chime', finishPlayback);
    return;
  }

  if (!resolved.audioUrl) {
    // Selected muezzin slot is awaiting licensed admin upload ('upload_when_licensed')
    emitPlaybackState({
      isPlaying: true,
      prayerKey,
      prayerNameEn,
      prayerNameAr,
      muezzinNameEn: resolved.voice?.muezzin_name_en || 'Medina Sanctuary Tone',
      muezzinNameAr: resolved.voice?.muezzin_name_ar || 'تنبيه الصلاة',
      mode,
      isFajrVariant: false,
      usedFallbackChime: true,
      backgroundAudioPaused,
      startedAt: Date.now(),
    });
    playSynthesizedSanctuaryTone(mode === 'takbir' ? 'takbir' : 'chime', finishPlayback);
    return;
  }

  // Play the Admin-uploaded Muezzin audio file
  const audio = getAdhanAudio();
  audio.volume = 1.0;
  audio.currentTime = 0;
  audio.src = resolved.audioUrl;

  emitPlaybackState({
    isPlaying: true,
    prayerKey,
    prayerNameEn,
    prayerNameAr,
    muezzinNameEn: resolved.voice?.muezzin_name_en || 'Muezzin',
    muezzinNameAr: resolved.voice?.muezzin_name_ar || null,
    mode,
    isFajrVariant: resolved.isFajrVariant,
    usedFallbackChime: false,
    backgroundAudioPaused,
    startedAt: Date.now(),
  });

  audio.onended = () => {
    finishPlayback();
  };

  audio.onerror = () => {
    // Graceful fallback to synthesized tone if audio stream fails
    playSynthesizedSanctuaryTone(mode === 'takbir' ? 'takbir' : 'chime', finishPlayback);
  };

  if (mode === 'takbir') {
    // For Short Takbir mode, play the opening Takbir (~14s) and smoothly fade out
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
          finishPlayback();
        }
      }, 180);
    }, 13_500);
  }

  try {
    await audio.play();
  } catch {
    playSynthesizedSanctuaryTone(mode === 'takbir' ? 'takbir' : 'chime', finishPlayback);
  }
}

/**
 * Plays an immediate preview of a specific Muezzin voice (Standard or Fajr) or tone mode.
 */
export async function playAdhanPreview(options: {
  voice?: AdhanVoiceRow;
  variant?: 'standard' | 'fajr' | 'takbir' | 'chime';
}): Promise<void> {
  const { voice, variant = 'standard' } = options;

  unlockAudio();
  stopAdhanPlayback();

  const duckSnap = duckAndPauseForAdhan();
  const backgroundAudioPaused = duckSnap.quranWasPlaying || duckSnap.ambientWasPlaying;

  if (variant === 'chime') {
    emitPlaybackState({
      isPlaying: true,
      prayerKey: 'preview',
      prayerNameEn: 'Chime Preview',
      prayerNameAr: 'معاينة التنبيه',
      muezzinNameEn: 'Medina Sanctuary Chime',
      muezzinNameAr: 'تنبيه الحرم الهادئ',
      mode: 'preview',
      isFajrVariant: false,
      usedFallbackChime: false,
      backgroundAudioPaused,
      startedAt: Date.now(),
    });
    playSynthesizedSanctuaryTone('chime', () => stopAdhanPlayback());
    return;
  }

  const targetUrl =
    variant === 'fajr'
      ? voice?.fajr_audio_url || voice?.audio_url || null
      : voice?.audio_url || voice?.fajr_audio_url || null;

  if (!targetUrl) {
    emitPlaybackState({
      isPlaying: true,
      prayerKey: 'preview',
      prayerNameEn: variant === 'takbir' ? 'Short Takbir Preview' : 'Adhan Preview (Awaiting Audio Upload)',
      prayerNameAr: 'معاينة الأذان',
      muezzinNameEn: voice?.muezzin_name_en || 'Sanctuary Takbir Tone',
      muezzinNameAr: voice?.muezzin_name_ar || null,
      mode: 'preview',
      isFajrVariant: variant === 'fajr',
      usedFallbackChime: true,
      backgroundAudioPaused,
      startedAt: Date.now(),
    });
    playSynthesizedSanctuaryTone('takbir', () => stopAdhanPlayback());
    return;
  }

  const audio = getAdhanAudio();
  audio.volume = 1.0;
  audio.currentTime = 0;
  audio.src = targetUrl;

  emitPlaybackState({
    isPlaying: true,
    prayerKey: 'preview',
    prayerNameEn: variant === 'fajr' ? 'Fajr Adhan Preview' : variant === 'takbir' ? 'Short Takbir Preview' : 'Adhan Preview',
    prayerNameAr: variant === 'fajr' ? 'معاينة أذان الفجر' : 'معاينة الأذان',
    muezzinNameEn: voice?.muezzin_name_en || 'Muezzin',
    muezzinNameAr: voice?.muezzin_name_ar || null,
    mode: 'preview',
    isFajrVariant: variant === 'fajr' && Boolean(voice?.fajr_audio_url),
    usedFallbackChime: false,
    backgroundAudioPaused,
    startedAt: Date.now(),
  });

  audio.onended = () => stopAdhanPlayback();
  audio.onerror = () => {
    playSynthesizedSanctuaryTone('takbir', () => stopAdhanPlayback());
  };

  if (variant === 'takbir') {
    activeTakbirFadeTimer = window.setTimeout(() => {
      stopAdhanPlayback();
    }, 15_000);
  }

  try {
    await audio.play();
  } catch {
    playSynthesizedSanctuaryTone('takbir', () => stopAdhanPlayback());
  }
}
