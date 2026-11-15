// GET /api/me/payments -> { ok: true, payments }
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAuthUser, sendJson, q, serverStore } from '../_lib.mjs';
import { getSupabaseAdmin } from '../lib/supabase-server';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return sendJson(res, 200, { ok: true, payments: [] });
    }

    const url = new URL(req.url || '', 'http://localhost');
    const requestedUserId = url.searchParams.get('user_id');
    const targetUserId =
      authUser.role === 'admin' && requestedUserId ? requestedUserId : authUser.uid;

    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('payments')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data)) {
          return sendJson(res, 200, {
            ok: true,
            payments: data.map((p: any) => ({
              ...p,
              amount: Number(p.amount),
              amount_paid: p.amount_paid ? Number(p.amount_paid) : null,
            })),
          });
        }
      } catch (e) {
        console.warn('[/api/me/payments] Supabase fetch failed, trying Postgres:', e);
      }
    }

    try {
      const { rows } = await q(
        `SELECT * FROM payments
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [targetUserId]
      );
      return sendJson(res, 200, {
        ok: true,
        payments: (rows || []).map((r: any) => ({
          ...r,
          amount: Number(r.amount),
          amount_paid: r.amount_paid ? Number(r.amount_paid) : null,
        })),
      });
    } catch {}

    const fallbackList = Array.isArray(serverStore?.payments)
      ? serverStore.payments.filter((p: any) => p?.user_id === targetUserId)
      : [];

    return sendJson(res, 200, { ok: true, payments: fallbackList });
  } catch (err) {
    console.error('[/api/me/payments] Error:', err);
    return sendJson(res, 200, { ok: true, payments: [] });
  }
}
