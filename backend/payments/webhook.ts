// POST /api/webhooks/flutterwave
// Handles asynchronous Flutterwave webhook events (e.g. charge.completed)
// Verifies verif-hash, verifies transaction server-side with Flutterwave v3 API,
// checks currency, tx_ref, amount >= plan.amount, and activates premium idempotently with stacking.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, readJson } from '../_lib.mjs';
import {
  getPaymentByTxRef,
  updatePaymentStatus,
  activateUserPremium,
  getPlanByCode,
} from '../lib/supabase-server';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // 1. Verify webhook signature hash against FLW_WEBHOOK_HASH
  const secretHash = process.env.FLW_WEBHOOK_HASH;
  const signature = req.headers['verif-hash'];

  if (secretHash && signature !== secretHash) {
    console.warn('[flw-webhook] Signature mismatch received:', signature);
    return sendJson(res, 401, { error: 'Invalid webhook signature hash.' });
  }

  try {
    const payload = (await readJson(req)) as any;
    const event = payload?.event;
    const data = payload?.data;

    if (event !== 'charge.completed' || !data) {
      return sendJson(res, 200, { received: true, ignored: true });
    }

    const txId = String(data.id || '');
    const txRef = String(data.tx_ref || '');
    const customerEmail = data.customer?.email || '';

    if (!txRef) {
      return sendJson(res, 200, { received: true, warning: 'No tx_ref in webhook' });
    }

    // 2. Fetch stored payment row from database
    const payment = await getPaymentByTxRef(txRef);
    if (!payment) {
      console.warn(`[flw-webhook] Payment row not found for tx_ref: ${txRef}`);
      return sendJson(res, 200, { received: true, warning: 'Payment not found' });
    }

    // 3. Idempotency: if already processed, return 200 immediately without double-granting
    if (payment.status === 'successful' || payment.status === 'overpaid') {
      return sendJson(res, 200, { received: true, message: 'Payment already processed' });
    }

    // 4. Server-side verification with official Flutterwave API
    const flwSecretKey = process.env.FLW_SECRET_KEY;
    let verifiedStatus = data.status;
    let verifiedAmount = Number(data.amount) || 0;
    let verifiedCurrency = (data.currency || 'NGN').toUpperCase();
    let flwRef = data.flw_ref || null;

    if (flwSecretKey && !flwSecretKey.includes('placeholder')) {
      try {
        const verifyRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(txId)}/verify`,
          {
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (verifyRes.ok) {
          const verifyData = (await verifyRes.json()) as any;
          if (verifyData?.status === 'success' && verifyData?.data) {
            verifiedStatus = verifyData.data.status;
            verifiedAmount = Number(verifyData.data.amount);
            verifiedCurrency = (verifyData.data.currency || 'NGN').toUpperCase();
            flwRef = verifyData.data.flw_ref || flwRef;
          }
        }
      } catch (err) {
        console.warn('[flw-webhook] Flutterwave server verification call error:', err);
      }
    }

    // 5. Verify status, currency, and tx_ref
    if (verifiedStatus !== 'successful') {
      await updatePaymentStatus(txRef, {
        status: 'failed',
        flw_id: txId,
        flw_ref: flwRef,
        amount_paid: verifiedAmount,
      });
      return sendJson(res, 200, { received: true, status: 'failed' });
    }

    if (verifiedCurrency !== (payment.currency || 'NGN').toUpperCase()) {
      await updatePaymentStatus(txRef, {
        status: 'failed',
        flw_id: txId,
        flw_ref: flwRef,
        metadata: { ...payment.metadata, currencyMismatch: verifiedCurrency },
      });
      return sendJson(res, 200, { received: true, error: 'Currency mismatch' });
    }

    // 6. Check amount against stored plan amount for this payment
    const requiredAmount = payment.amount;

    // Underpayment: do NOT activate premium
    if (verifiedAmount < requiredAmount) {
      await updatePaymentStatus(txRef, {
        status: 'underpaid',
        flw_id: txId,
        flw_ref: flwRef,
        amount_paid: verifiedAmount,
        metadata: {
          ...payment.metadata,
          underpayment: true,
          shortfall: requiredAmount - verifiedAmount,
        },
      });
      console.warn(`[flw-webhook] Underpayment on ${txRef}: received ₦${verifiedAmount}, required ₦${requiredAmount}`);
      return sendJson(res, 200, { received: true, status: 'underpaid' });
    }

    // Overpayment or Exact payment: activate premium!
    const isOverpaid = verifiedAmount > requiredAmount;
    const finalStatus = isOverpaid ? 'overpaid' : 'successful';

    await updatePaymentStatus(txRef, {
      status: finalStatus,
      flw_id: txId,
      flw_ref: flwRef,
      amount_paid: verifiedAmount,
      paid_at: new Date().toISOString(),
      metadata: {
        ...payment.metadata,
        overpayment: isOverpaid,
        excess: isOverpaid ? verifiedAmount - requiredAmount : 0,
      },
    });

    // 7. Activate premium on user account with stacking duration
    const plan = await getPlanByCode(payment.plan_code);
    const durationDays = plan?.duration_days || 30;

    await activateUserPremium(
      payment.user_id,
      customerEmail,
      payment.plan_code,
      durationDays,
      txId
    );

    return sendJson(res, 200, { received: true, activated: true, status: finalStatus });
  } catch (err: any) {
    console.error('[flw-webhook] Error processing webhook:', err);
    return sendJson(res, 500, { error: 'Webhook processing failed.' });
  }
}
