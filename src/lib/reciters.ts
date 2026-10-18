import type { Reciter } from '../types';

/**
 * Row shape returned by /api/reciters (the admin-managed `global_reciters` table).
 * `serverUrl` is optional because a row may exist to carry a portrait/bio for a
 * curated sheikh or a custom sheikh added by the admin.
 */
export interface GlobalReciterRow {
  id: string;
  name: string;
  nameArabic?: string | null;
  style?: string | null;
  category?: string | null;
  bio?: string | null;
  serverUrl?: string | null;
  imageUrl?: string | null;
}

/**
 * Merge admin-managed global rows over the reciters defined in code.
 *
 * - Same id -> replaces portrait, bio, category, Arabic name, or serverUrl when provided by admin.
 * - Unknown id -> appended as a global sheikh visible to every user, phone, and tablet.
 */
export function resolveReciters<T extends Reciter>(base: T[], globals: GlobalReciterRow[]): T[] {
  if (!globals.length) return base;

  const merged = base.map(reciter => {
    const override = globals.find(g => g.id === reciter.id);
    if (!override) return reciter;
    const cleanImg = override.imageUrl ? override.imageUrl.replace(/^https?:\/\/localhost(:\d+)?/, '') : undefined;
    return {
      ...reciter,
      ...(override.name && override.name !== reciter.id ? { name: override.name } : {}),
      ...(override.nameArabic ? { nameArabic: override.nameArabic } : {}),
      ...(override.category ? { category: override.category } : {}),
      ...(override.bio ? { bio: override.bio } : {}),
      ...(override.serverUrl ? { serverUrl: override.serverUrl } : {}),
      ...(cleanImg ? { imageUrl: cleanImg, imageCredit: undefined } : {}),
    };
  });

  const appended = globals
    .filter(g => !base.some(r => r.id === g.id))
    .map(g => {
      const cleanImg = g.imageUrl ? g.imageUrl.replace(/^https?:\/\/localhost(:\d+)?/, '') : undefined;
      return {
        id: g.id,
        name: g.name || g.id,
        ...(g.nameArabic ? { nameArabic: g.nameArabic } : {}),
        style: g.style && g.style !== 'Custom Global' ? g.style : 'Murattal',
        category: g.category || 'Sweet Voices',
        ...(g.bio ? { bio: g.bio } : {}),
        region: 'Global',
        serverUrl: g.serverUrl || 'https://server8.mp3quran.net/afs',
        ...(cleanImg ? { imageUrl: cleanImg } : {}),
      };
    });

  return appended.length ? [...merged, ...(appended as unknown as T[])] : merged;
}

