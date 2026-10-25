// GET /api/plans
// Public endpoint returning active plans (pricing source of truth)
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from './_lib.mjs';
import { getActivePlans } from './lib/supabase-server';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const plans = await getActivePlans();
    return sendJson(res, 200, { ok: true, plans });
  } catch (err: any) {
    console.error('[plans] Error fetching plans:', err);
    return sendJson(res, 500, { error: 'Failed to retrieve plans' });
  }
}
