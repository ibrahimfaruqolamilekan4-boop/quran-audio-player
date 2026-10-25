/**
 * Supabase client & ambient backgrounds synchronization layer.
 * 
 * Manages fetching, caching, Realtime live subscriptions, and uploading
 * ambient backgrounds to Supabase Storage ('ambient-backgrounds' bucket)
 * and the 'backgrounds' / 'profiles' tables.
 */

import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

export interface BackgroundRow {
  id: string;
  name_en: string;
  name_ar?: string | null;
  category: string;
  video_url: string;
  poster_url?: string | null;
  size_bytes?: number | null;
  sort_order: number;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at: string;
  last_seen_at: string;
}

// In-memory cache for fast, stale-while-revalidate lookups
let cachedBackgrounds: BackgroundRow[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
export const STORAGE_BUCKET = 'ambient-backgrounds';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Validates a video file for mobile-friendly ambient background playback.
 * Constraints:
 * - Format: video/mp4 (H.264)
 * - Max size: 45 MB hard limit (optimal 3-8 MB)
 * - Resolution: Up to 1280x720 (720p max for battery & mobile data efficiency)
 */
export async function validateAmbientVideo(file: File): Promise<{
  valid: boolean;
  warning?: string;
  error?: string;
  width?: number;
  height?: number;
  duration?: number;
}> {
  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
  if (!isMp4) {
    return {
      valid: false,
      error: 'Invalid format. Backgrounds must be MP4 (H.264 video codec) for universal mobile support.',
    };
  }

  const MAX_SIZE_BYTES = 45 * 1024 * 1024; // 45MB strict hard limit
  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is 45 MB. Compress with 720p H.264 (target 3–8 MB).`,
    };
  }

  // Probe video metadata via object URL
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    (video as any).playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const timer = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: true,
        warning: 'Could not probe video dimensions; file size is acceptable.',
      });
    }, 4000);

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);

      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;

      let warning: string | undefined;

      if (width > 1280 || height > 720) {
        warning = `Resolution is ${width}x${height}. Recommended is 720p (1280x720 max) to conserve mobile battery and bandwidth.`;
      }

      if (file.size > 8 * 1024 * 1024) {
        warning = (warning ? warning + ' ' : '') + `Video is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Target range for smooth mobile looping is 3–8 MB.`;
      }

      resolve({
        valid: true,
        warning,
        width,
        height,
        duration,
      });
    };

    video.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Unable to decode video. Ensure it is encoded with H.264 and no audio track.',
      });
    };
  });
}

/**
 * Extracts a lightweight poster thumbnail from a video file or blob using HTML5 Canvas.
 * Returns a JPEG Blob (~30-50 KB).
 */
export async function extractVideoPoster(fileOrBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    (video as any).playsInline = true;
    video.crossOrigin = 'anonymous';

    const url = URL.createObjectURL(fileOrBlob);
    video.src = url;
    video.currentTime = 0.5; // capture at 0.5s to avoid initial black frames

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onseeked = () => {
      try {
        const width = Math.min(video.videoWidth || 640, 1280);
        const height = Math.min(video.videoHeight || 360, 720);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return reject(new Error('Canvas 2D context unavailable'));
        }
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate poster JPEG blob'));
            }
          },
          'image/jpeg',
          0.82
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video frame for poster'));
    };
  });
}

/**
 * Verifies that an uploaded video URL can actually be loaded and played by the browser.
 */
export async function verifyVideoPlayable(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    (video as any).playsInline = true;
    let resolved = false;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(false);
      }
    }, timeoutMs);

    video.onloadeddata = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve(true);
      }
    };

    video.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve(false);
      }
    };

    video.src = url;
    video.load();
  });
}

/**
 * Uploads a file directly to Supabase Storage bucket 'ambient-backgrounds'
 * Sets Cache-Control to 31536000 (1 year immutable) and performs up to 3 automatic retries.
 */
export async function uploadToSupabaseStorage(
  fileOrBlob: Blob,
  path: string,
  contentType: string,
  maxRetries = 3
): Promise<string> {
  const cleanPath = path.replace(/^\/+/, '');
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${cleanPath}`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': contentType,
            'x-upsert': 'true',
            'cache-control': 'max-age=31536000',
          },
          body: fileOrBlob,
        });

        if (res.ok) {
          return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${cleanPath}`;
        }
      }

      // Fallback to backend media API
      const formData = new FormData();
      formData.append('file', fileOrBlob, cleanPath);
      formData.append('bucket', STORAGE_BUCKET);
      formData.append('path', cleanPath);

      const res = await fetch('/api/admin/supabase-backgrounds', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const finalUrl = data.publicUrl || data.url;
        if (finalUrl) return finalUrl;
      }

      const errText = await res.text().catch(() => '');
      throw new Error(`Upload failed (attempt ${attempt}/${maxRetries}): ${errText || res.statusText}`);
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 800));
      }
    }
  }

  throw lastError || new Error(`Upload failed after ${maxRetries} attempts.`);
}

/**
 * Fetches all active ambient backgrounds from Supabase or the backend API.
 */
export async function fetchActiveBackgrounds(forceRefresh = false): Promise<BackgroundRow[]> {
  const now = Date.now();
  if (!forceRefresh && cachedBackgrounds && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedBackgrounds;
  }

  // 1. Try Supabase REST API directly if credentials exist
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const restUrl = `${SUPABASE_URL}/rest/v1/backgrounds?is_active=eq.true&order=sort_order.asc,created_at.desc`;
      const res = await fetch(restUrl, {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const rows: BackgroundRow[] = await res.json();
        if (Array.isArray(rows)) {
          cachedBackgrounds = rows;
          lastFetchTime = now;
          return rows;
        }
      }
    } catch (err) {
      console.warn('Direct Supabase fetch fallback to API:', err);
    }
  }

  // 2. Fetch from backend /api/backgrounds
  try {
    const res = await fetch('/api/backgrounds');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.backgrounds)) {
        cachedBackgrounds = data.backgrounds;
        lastFetchTime = now;
        return data.backgrounds;
      }
    }
  } catch (err) {
    console.warn('API /api/backgrounds fetch error:', err);
  }

  return cachedBackgrounds || [];
}

/**
 * Subscribes to Realtime updates on the 'backgrounds' table.
 * Emits updated background rows whenever an insert, update, or delete occurs.
 * Also refetches when tab visibility returns to visible or network reconnects.
 */
export function subscribeToBackgrounds(onChange: (backgrounds: BackgroundRow[]) => void): () => void {
  const client = getSupabaseClient();
  let channel: RealtimeChannel | null = null;

  const triggerRefresh = async () => {
    try {
      const updated = await fetchActiveBackgrounds(true);
      onChange(updated);
    } catch (e) {
      console.warn('Failed to refresh backgrounds on realtime event:', e);
    }
  };

  if (client) {
    try {
      channel = client
        .channel('public:backgrounds')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'backgrounds' },
          () => {
            triggerRefresh();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Could not subscribe to Supabase backgrounds channel:', err);
    }
  }

  // Resilience: Refetch when returning to app or coming online
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      triggerRefresh();
    }
  };
  const handleOnline = () => triggerRefresh();

  window.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleVisibility);
  window.addEventListener('online', handleOnline);

  return () => {
    if (channel && client) {
      client.removeChannel(channel).catch(() => {});
    }
    window.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleVisibility);
    window.removeEventListener('online', handleOnline);
  };
}

/**
 * Subscribes to Realtime updates on the 'profiles' table for admin community dashboard.
 */
export function subscribeToProfiles(onChange: () => void): () => void {
  const client = getSupabaseClient();
  let channel: RealtimeChannel | null = null;

  if (client) {
    try {
      channel = client
        .channel('public:profiles')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            onChange();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Could not subscribe to Supabase profiles channel:', err);
    }
  }

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      onChange();
    }
  };

  window.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleVisibility);

  return () => {
    if (channel && client) {
      client.removeChannel(channel).catch(() => {});
    }
    window.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleVisibility);
  };
}

/**
 * Fetches real profiles from Supabase for Admin management, supporting pagination,
 * search filtering, role filtering, and sort order.
 */
export async function fetchAdminProfiles(options: {
  search?: string;
  role?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'last_seen_at' | 'email' | 'full_name';
  sortAsc?: boolean;
} = {}): Promise<{ profiles: ProfileRow[]; total: number }> {
  const {
    search = '',
    role = 'all',
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortAsc = false,
  } = options;

  const client = getSupabaseClient();
  if (client) {
    try {
      let query = client.from('profiles').select('*', { count: 'exact' });

      if (role && role !== 'all') {
        query = query.eq('role', role);
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`email.ilike.${term},full_name.ilike.${term}`);
      }

      query = query.order(sortBy, { ascending: sortAsc });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (!error && Array.isArray(data)) {
        return {
          profiles: data as ProfileRow[],
          total: count || data.length,
        };
      }
    } catch (err) {
      console.warn('Supabase profiles query error, falling back to API:', err);
    }
  }

  // Fallback to /api/admin/overview
  const res = await fetch('/api/admin/overview');
  if (res.ok) {
    const data = await res.json();
    const rawUsers: any[] = data.users || [];
    let mapped: ProfileRow[] = rawUsers.map((u) => ({
      id: u.userId || u.uid || u.id,
      email: u.email || '',
      full_name: u.displayName || u.display_name || u.full_name || null,
      avatar_url: u.photoURL || u.photo_url || u.avatar_url || null,
      role: u.role || 'user',
      is_premium: Boolean(u.is_premium),
      premium_expires_at: u.premium_expires_at || null,
      created_at: u.createdAt || u.created_at || new Date().toISOString(),
      last_seen_at: u.lastLoginAt || u.last_seen_at || new Date().toISOString(),
    }));

    if (role && role !== 'all') {
      mapped = mapped.filter((p) => p.role === role);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      mapped = mapped.filter(
        (p) => (p.email && p.email.toLowerCase().includes(q)) || (p.full_name && p.full_name.toLowerCase().includes(q))
      );
    }

    const total = mapped.length;
    const from = (page - 1) * pageSize;
    return {
      profiles: mapped.slice(from, from + pageSize),
      total,
    };
  }

  return { profiles: [], total: 0 };
}

/**
 * Updates a user profile's role or premium status as an Admin.
 */
export async function updateProfileAdmin(
  userId: string,
  updates: {
    role?: 'user' | 'admin';
    is_premium?: boolean;
    premium_expires_at?: string | null;
    full_name?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('profiles').update(updates).eq('id', userId);
      if (!error) return { ok: true };
      console.warn('Direct Supabase profile update failed:', error.message);
    } catch (e: any) {
      console.warn('Direct Supabase update exception:', e);
    }
  }

  // Fallback to /api/admin/role
  try {
    const res = await fetch('/api/admin/role', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...updates }),
    });
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'Failed to update user profile.' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error updating user.' };
  }
}

export interface SupabaseDiagnosticResult {
  urlConfigured: boolean;
  anonKeyConfigured: boolean;
  tableReachable: boolean;
  tableCount: number;
  bucketReachable: boolean;
  bucketPublic: boolean;
  errorMessage?: string;
}

/**
 * Runs a live connection diagnostic against Supabase.
 * Checks URL, Anon Key, table access to 'backgrounds', and bucket access.
 */
export async function testSupabaseConnection(): Promise<SupabaseDiagnosticResult> {
  const result: SupabaseDiagnosticResult = {
    urlConfigured: Boolean(SUPABASE_URL),
    anonKeyConfigured: Boolean(SUPABASE_ANON_KEY),
    tableReachable: false,
    tableCount: 0,
    bucketReachable: false,
    bucketPublic: false,
  };

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    result.errorMessage = 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.';
    return result;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backgrounds?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (res.status === 200) {
      result.tableReachable = true;
      const data = await res.json();
      result.tableCount = Array.isArray(data) ? data.length : 0;
    } else if (res.status === 401) {
      result.errorMessage = 'HTTP 401 Unauthorized: Invalid Anon Key.';
      return result;
    } else if (res.status === 404 || res.status === 400) {
      result.errorMessage = `HTTP ${res.status}: Table 'backgrounds' not found. Apply schema.sql in Supabase SQL editor.`;
      return result;
    } else {
      result.errorMessage = `HTTP ${res.status} returned from Supabase REST API.`;
      return result;
    }

    // Check bucket
    try {
      const bRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${STORAGE_BUCKET}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (bRes.status === 200) {
        const bData = await bRes.json();
        result.bucketReachable = true;
        result.bucketPublic = Boolean(bData.public);
      }
    } catch {}
  } catch (err: any) {
    result.errorMessage = `Connection error: ${err?.message || 'Network failure'}`;
  }

  return result;
}
