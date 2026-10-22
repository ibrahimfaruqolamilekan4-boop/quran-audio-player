// POST /api/webhooks/flutterwave
// Handles asynchronous Flutterwave webhook events (e.g. charge.completed)
import { type Handler, q, sendJson, readJson } from '../_lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // Verify webhook hash secret if configured
  const secretHash = process.env.FLW_WEBHOOK_HASH;
  const signature = req.headers['verif-hash'];

  if (secretHash && signature !== secretHash) {
    return sendJson(res, 401, { error: 'Invalid webhook signature hash.' });
  }

  try {
    const payload = (await readJson(req)) as any;
    const event = payload?.event;
    const data = payload?.data;

    if (event === 'charge.completed' && data?.status === 'successful') {
      const email = data?.customer?.email;
      const txId = String(data?.id || '');
      const txRef = String(data?.tx_ref || '');

      // Determine plan from txRef or default to yearly
      let plan: 'monthly' | 'yearly' | 'lifetime' = 'yearly';
      if (txRef.includes('monthly')) plan = 'monthly';
      else if (txRef.includes('lifetime')) plan = 'lifetime';

      let expiresAt: string | null = null;
      if (plan === 'monthly') {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expiresAt = d.toISOString();
      } else if (plan === 'yearly') {
        const d = new Date();
        d.setDate(d.getDate() + 365);
        expiresAt = d.toISOString();
      }

      if (email) {
        await q(
          `UPDATE users SET
             is_premium = true,
             subscription_plan = $1,
             flw_transaction_id = $2,
             premium_expires_at = $3
           WHERE LOWER(email) = LOWER($4)`,
          [plan, txId, expiresAt, email]
        );
      }
    }

    return sendJson(res, 200, { received: true });
  } catch (err: any) {
    console.error('[flw-webhook] Error processing webhook:', err);
    return sendJson(res, 500, { error: 'Webhook processing failed.' });
  }
};

export default handler;
