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

