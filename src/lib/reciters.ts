import type { Reciter } from '../types';

/**
 * Row shape returned by /api/reciters (the admin-managed `global_reciters` table).
 * `serverUrl` is optional there because a row may exist purely to carry a portrait for a
 * curated sheikh, whose audio mirror is already defined in code.
 */
export interface GlobalReciterRow {
  id: string;
  name: string;
  style?: string | null;
  serverUrl?: string | null;
  imageUrl?: string | null;
}

/**
 * Merge admin-managed global rows over the reciters defined in code.
 *
 * - Same id with a photo -> that sheikh's portrait is replaced (admin control).
 * - Same id without a photo -> left untouched, so an empty global row cannot wipe a curated image.
 * - Unknown id with a server URL -> treated as a new global sheikh and appended.
 */
export function resolveReciters<T extends Reciter>(base: T[], globals: GlobalReciterRow[]): T[] {
  if (!globals.length) return base;

  const merged = base.map(reciter => {
    const override = globals.find(g => g.id === reciter.id);
    if (!override?.imageUrl) return reciter;
    return { ...reciter, imageUrl: override.imageUrl, imageCredit: undefined };
  });

  const appended = globals
    .filter(g => g.serverUrl && !base.some(r => r.id === g.id))
    .map(g => ({
      id: g.id,
      name: g.name,
      style: g.style || 'Murattal',
      region: 'Global',
      serverUrl: g.serverUrl as string,
      ...(g.imageUrl ? { imageUrl: g.imageUrl } : {}),
    }));

  return appended.length ? [...merged, ...(appended as unknown as T[])] : merged;
}
