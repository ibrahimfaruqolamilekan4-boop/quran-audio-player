// GET & POST /api/admin/payments
// Admin endpoints to view all payment transactions, re-verify stuck payments, and run batch reconciliation
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireAdmin, sendJson, readJson, q } from '../_lib.mjs';
import {
  listPaymentsAdmin,
  getPaymentByTxRef,
  updatePaymentStatus,
  activateUserPremium,
  getPlanByCode,
} from '../lib/supabase-server';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const url = new URL(req.url || '', 'http://localhost');

  if (req.method === 'GET') {
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const result = await listPaymentsAdmin({ search, status, page, pageSize });
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (req.method === 'POST') {
    try {
      const body = (await readJson(req)) as any;
      const { action, tx_ref } = body;

      // 1. Re-verify a single stuck or pending transaction with Flutterwave API
      if (action === 'reverify' && tx_ref) {
        const payment = await getPaymentByTxRef(tx_ref);
        if (!payment) {
          return sendJson(res, 404, { error: 'Payment record not found' });
        }

        const flwSecretKey = process.env.FLW_SECRET_KEY;
        if (!flwSecretKey || flwSecretKey.includes('placeholder')) {
          return sendJson(res, 400, {
            error: 'Flutterwave secret key is not configured for live verification.',
          });
        }

        const flwRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify-by-reference?tx_ref=${encodeURIComponent(tx_ref)}`,
          {
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!flwRes.ok) {
          const errData = await flwRes.json().catch(() => ({}));
          return sendJson(res, 400, {
            error: (errData as any).message || 'Flutterwave was unable to verify reference.',
          });
        }

        const flwData = (await flwRes.json()) as any;
        if (flwData?.status === 'success' && flwData?.data?.status === 'successful') {
          const data = flwData.data;
          const amountPaid = Number(data.amount);
          const flwTxId = String(data.id || '');
          const flwRef = data.flw_ref;

          const requiredAmount = payment.amount;
          const finalStatus = amountPaid > requiredAmount ? 'overpaid' : 'successful';

          await updatePaymentStatus(tx_ref, {
            status: finalStatus,
            flw_id: flwTxId,
            flw_ref: flwRef,
            amount_paid: amountPaid,
            paid_at: new Date().toISOString(),
          });

          const plan = await getPlanByCode(payment.plan_code);
          const durationDays = plan?.duration_days || 30;

          await activateUserPremium(
            payment.user_id,
            payment.user_email || '',
            payment.plan_code,
            durationDays,
            flwTxId
          );

          return sendJson(res, 200, {
            ok: true,
            status: finalStatus,
            message: 'Transaction successfully verified and user premium activated!',
          });
        }

        return sendJson(res, 200, {
          ok: false,
          status: flwData?.data?.status || 'pending',
          message: 'Transaction is not marked successful in Flutterwave.',
        });
      }

      // 2. Batch Reconciliation Job: re-verify all pending payments in the last 24h
      if (action === 'reconcile') {
        const flwSecretKey = process.env.FLW_SECRET_KEY;
        if (!flwSecretKey || flwSecretKey.includes('placeholder')) {
          return sendJson(res, 400, {
            error: 'Flutterwave secret key is not configured for live reconciliation.',
          });
        }

        const { rows } = await q(
          `SELECT * FROM payments 
           WHERE status = 'pending' AND created_at > now() - interval '24 hours' 
           ORDER BY created_at DESC LIMIT 50`
        ).catch(() => ({ rows: [] }));

        let checked = 0;
        let activated = 0;

        for (const p of rows || []) {
          checked++;
          try {
            const flwRes = await fetch(
              `https://api.flutterwave.com/v3/transactions/verify-by-reference?tx_ref=${encodeURIComponent(p.tx_ref)}`,
              {
                headers: {
                  Authorization: `Bearer ${flwSecretKey}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (flwRes.ok) {
              const flwData = (await flwRes.json()) as any;
              if (flwData?.status === 'success' && flwData?.data?.status === 'successful') {
                const data = flwData.data;
                const amountPaid = Number(data.amount);
                const finalStatus = amountPaid > p.amount ? 'overpaid' : 'successful';

                await updatePaymentStatus(p.tx_ref, {
                  status: finalStatus,
                  flw_id: String(data.id || ''),
                  flw_ref: data.flw_ref,
                  amount_paid: amountPaid,
                  paid_at: new Date().toISOString(),
                });

                const plan = await getPlanByCode(p.plan_code);
                await activateUserPremium(
                  p.user_id,
                  '',
                  p.plan_code,
                  plan?.duration_days || 30,
                  String(data.id || '')
                );
                activated++;
              }
            }
          } catch (e) {
            console.warn(`[reconcile] Error checking ${p.tx_ref}:`, e);
          }
        }

        return sendJson(res, 200, {
          ok: true,
          checked,
          activated,
          message: `Reconciliation completed: ${checked} checked, ${activated} activated.`,
        });
      }

      return sendJson(res, 400, { error: 'Unknown action' });
    } catch (err: any) {
      console.error('[admin/payments] Error:', err);
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}
