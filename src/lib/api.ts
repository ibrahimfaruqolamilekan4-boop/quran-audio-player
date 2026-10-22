import { Chapter } from '../types';

const API_BASE = 'https://api.quran.com/api/v4';

export async function getChapters(): Promise<Chapter[]> {
  try {
    const res = await fetch(`${API_BASE}/chapters?language=en`);
    if (!res.ok) throw new Error('Failed to fetch chapters');
    const data = await res.json();
    return Array.isArray(data.chapters) ? data.chapters : [];
  } catch (error: any) {
    console.error('Error fetching chapters:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

// ---------- Neon-backed app API (/api serverless functions) ----------

export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'user' | 'admin';
}

export interface AppPreferences {
  theme: string;
  activeBackgroundVideoId: string | null;
  ambientVideoMapping: Record<string, string>;
}

/** Thin fetch wrapper for the app's own /api endpoints. Throws Error with the server message on failure. */
export async function appApi<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => '');
    if (text && text.length < 120 && !text.includes('<html')) {
      data = { error: text };
    }
  }
  if (!res.ok) {
    const errorMsg = (data as { error?: string }).error;
    if (errorMsg) throw new Error(errorMsg);
    if (res.status === 405) throw new Error('Request method not allowed (405). Please refresh and try again.');
    if (res.status === 500) throw new Error('Server temporarily unavailable (500). Please try again.');
    throw new Error(`Request failed (${res.status})`);
  }
  return data as T;
}

