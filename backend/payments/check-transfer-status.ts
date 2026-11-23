// GET /api/payments/check-transfer-status?tx_ref=...
// Polls transfer status from database and verifies with Flutterwave API.
// Activates Premium with stacking upon confirmed payment.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireAuth, sendJson } from '../_lib.mjs';
import {
  getPaymentByTxRef,
  updatePaymentStatus,
  activateUserPremium,
  getPlanByCode,
} from '../lib/supabase-server';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    const txRef = parsedUrl.searchParams.get('tx_ref');

    if (!txRef) {
      return sendJson(res, 400, { error: 'tx_ref query param is required' });
    }

    const payment = await getPaymentByTxRef(txRef);
    if (!payment) {
      return sendJson(res, 404, { error: 'Payment transaction not found' });
    }

    // 1. If already marked successful or overpaid in database, return immediately
    if (payment.status === 'successful' || payment.status === 'overpaid') {
      return sendJson(res, 200, {
        status: 'successful',
        isPremium: true,
        amount: payment.amount,
        paidAt: payment.paid_at,
        txRef: payment.tx_ref,
      });
    }

    // 2. Query Flutterwave API by tx_ref to verify if transfer completed
    const flwSecretKey = process.env.FLW_SECRET_KEY;
    let isSuccess = false;
    let flwTxId: string | undefined = undefined;
    let flwRef: string | undefined = undefined;
    let amountPaid = 0;

    if (flwSecretKey && !flwSecretKey.includes('placeholder')) {
      try {
        const flwRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify-by-reference?tx_ref=${encodeURIComponent(txRef)}`,
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
            if ((data.currency || 'NGN').toUpperCase() === (payment.currency || 'NGN').toUpperCase()) {
              amountPaid = Number(data.amount);
              flwTxId = String(data.id || '');
              flwRef = data.flw_ref;
              isSuccess = true;
            }
          }
        }
      } catch (err) {
        console.warn('[Payments] Flutterwave check status call error:', err);
      }
    }

    // Test simulation fallback when no live secret key is available
    const forceSimulate = parsedUrl.searchParams.get('simulate') === 'true';
    if (!isSuccess && (!flwSecretKey || flwSecretKey.includes('placeholder')) && forceSimulate) {
      isSuccess = true;
      amountPaid = payment.amount;
    }

    // 3. If verified, activate premium and update payment status
    if (isSuccess) {
      const requiredAmount = payment.amount;

      if (amountPaid < requiredAmount) {
        await updatePaymentStatus(txRef, {
          status: 'underpaid',
          flw_id: flwTxId,
          flw_ref: flwRef,
          amount_paid: amountPaid,
        });
        return sendJson(res, 200, {
          status: 'underpaid',
          isPremium: false,
          message: `Received ₦${amountPaid}, but required amount is ₦${requiredAmount}.`,
        });
      }

      const finalStatus = amountPaid > requiredAmount ? 'overpaid' : 'successful';
      await updatePaymentStatus(txRef, {
        status: finalStatus,
        flw_id: flwTxId,
        flw_ref: flwRef,
        amount_paid: amountPaid,
        paid_at: new Date().toISOString(),
      });

      const plan = await getPlanByCode(payment.plan_code);
      const durationDays = plan?.duration_days || 30;

      const { isPremium, expiresAt } = await activateUserPremium(
        payment.user_id,
        user.email,
        payment.plan_code,
        durationDays,
        flwTxId
      );

      return sendJson(res, 200, {
        status: 'successful',
        isPremium,
        expiresAt,
        amountPaid,
      });
    }

    return sendJson(res, 200, {
      status: payment.status || 'pending',
      isPremium: false,
      message: 'Transfer not yet confirmed. Inter-bank transfers typically take 30–90 seconds to clear.',
    });
  } catch (err: any) {
    console.error('[Payments] Check transfer status error:', err);
    return sendJson(res, 500, { error: 'Failed to verify transfer status' });
  }
}
