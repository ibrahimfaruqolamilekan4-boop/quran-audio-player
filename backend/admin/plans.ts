// GET & POST /api/admin/plans
// Admin endpoints to view and manage subscription plans and pricing
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireAdmin, sendJson, readJson } from '../_lib.mjs';
import {
  getActivePlans,
  updatePlanAdmin,
  getPlanPriceLogs,
} from '../lib/supabase-server';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const url = new URL(req.url || '', 'http://localhost');
  const path = url.pathname;

  if (req.method === 'GET') {
    if (path.includes('logs')) {
      const logs = await getPlanPriceLogs();
      return sendJson(res, 200, { ok: true, logs });
    }
    const plans = await getActivePlans();
    return sendJson(res, 200, { ok: true, plans });
  }

  if (req.method === 'POST') {
    try {
      const body = (await readJson(req)) as any;
      const { code, amount, duration_days, is_active, name_en } = body;

      if (!code) {
        return sendJson(res, 400, { error: 'Plan code is required' });
      }

      const result = await updatePlanAdmin(
        code,
        {
          amount: amount !== undefined ? Number(amount) : undefined,
          duration_days: duration_days !== undefined ? Number(duration_days) : undefined,
          is_active: is_active !== undefined ? Boolean(is_active) : undefined,
          name_en,
        },
        admin.email || admin.uid
      );

      if (!result.ok) {
        return sendJson(res, 400, { error: result.error || 'Failed to update plan' });
      }

      return sendJson(res, 200, { ok: true, plan: result.plan });
    } catch (err: any) {
      console.error('[admin/plans] Error:', err);
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}
