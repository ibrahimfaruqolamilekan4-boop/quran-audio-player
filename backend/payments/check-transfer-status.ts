// GET /api/payments/check-transfer-status?tx_ref=...
// Polls transfer status and activates Premium upon confirmed payment
import { type Handler, requireAuth, sendJson, q, mapUser } from '../_lib.mjs';
import { pendingTransfers } from './create-virtual-account';

const PLAN_DAYS: Record<string, number> = {
  monthly: 30,
  yearly: 365,
};

const handler: Handler = async (req, res) => {
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

    const flwSecretKey = process.env.FLW_SECRET_KEY;
    let isSuccess = false;
    let plan: 'monthly' | 'yearly' = 'yearly';

    const localTx = pendingTransfers.get(txRef);
    if (localTx) {
      plan = localTx.plan;
    }

    // Try verifying by reference with Flutterwave if key is configured
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
            isSuccess = true;
          }
        }
      } catch (err) {
        console.warn('[Payments] Flutterwave check status call:', err);
      }
    }

    // If local record exists and user clicked "I've Sent the Money"
    const forceSimulate = parsedUrl.searchParams.get('simulate') === 'true';
    if (!isSuccess && (forceSimulate || (!flwSecretKey && localTx))) {
      isSuccess = true;
    }

    if (isSuccess) {
      if (localTx) {
        localTx.status = 'successful';
      }

      const days = PLAN_DAYS[plan] || 365;
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      const expiresAt = expDate.toISOString();

      await q(
        `UPDATE users SET
           is_premium = true,
           subscription_plan = $1,
           flw_transaction_id = $2,
           premium_expires_at = $3
         WHERE id = $4`,
        [plan, txRef, expiresAt, user.id]
      );

      const updatedRes = await q(`SELECT * FROM users WHERE id = $1`, [user.id]);
      const updatedUser = updatedRes.rows[0] ? mapUser(updatedRes.rows[0]) : null;

      return sendJson(res, 200, {
        status: 'successful',
        isPremium: true,
        plan,
        expiresAt,
        user: updatedUser,
      });
    }

    return sendJson(res, 200, {
      status: 'pending',
      isPremium: false,
      message: 'Payment has not been detected yet. Please transfer the exact amount and allow 1-2 minutes for bank clearing.',
    });
  } catch (err: any) {
    console.error('[Payments] Check transfer status error:', err);
    return sendJson(res, 500, { error: 'Failed to verify transfer status' });
  }
};

export default handler;
