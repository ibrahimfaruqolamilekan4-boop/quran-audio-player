// POST /api/payments/create-hosted-checkout
// Server-side payment creation for Flutterwave multi-channel checkout (Card, Bank Transfer, USSD, OPay).
// SERVER-SIDE ONLY: Reads the amount strictly from the plans table (never trusted from client).
// Eliminates client-side "invalid public key" errors by generating a secure hosted checkout link server-side.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireAuth, sendJson, readJson } from '../_lib.mjs';
import {
  getPlanByCode,
  createPaymentRecord,
} from '../lib/supabase-server';

interface HostedCheckoutRequestBody {
  plan_code?: string;
  plan?: string;
  redirect_url?: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const body = (await readJson(req).catch(() => ({}))) as HostedCheckoutRequestBody;
    const planCode = body.plan_code || (body.plan === 'monthly' ? 'premium_monthly' : 'premium_monthly');

    // 1. Fetch plan from database (single source of truth for pricing)
    const plan = await getPlanByCode(planCode);
    if (!plan || !plan.is_active) {
      return sendJson(res, 400, { error: 'Selected plan is not currently available.' });
    }

    const userId = user.uid || (user as any).id;
    const txRef = `qf-ch-${Date.now()}-${userId.slice(0, 8)}`;

    const rawSecret = process.env.FLW_SECRET_KEY || '';
    const flwSecretKey = rawSecret.trim().replace(/^['"]|['"]$/g, '');

    if (!flwSecretKey || flwSecretKey.includes('placeholder')) {
      console.error('[Payments] Hosted checkout failed: FLW_SECRET_KEY is not configured in environment variables.');
      return sendJson(res, 500, {
        error: 'Payment gateway configuration error. Please ensure FLW_SECRET_KEY is configured in Vercel.',
      });
    }

    // Determine return URL
    const hostHeader = req.headers.host || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (hostHeader.startsWith('localhost') ? 'http' : 'https');
    const origin = `${proto}://${hostHeader}`;
    const redirectUrl = body.redirect_url || `${origin}/premium?status=successful&tx_ref=${encodeURIComponent(txRef)}&plan_code=${encodeURIComponent(plan.code)}`;

    // 2. Call Flutterwave Standard Hosted Payment API
    const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flwSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: plan.amount,
        currency: plan.currency || 'NGN',
        redirect_url: redirectUrl,
        customer: {
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
        },
        customizations: {
          title: 'Nooraya Quranic Sanctuary',
          description: `${plan.name_en} Subscription (${plan.duration_days} days)`,
          logo: `${origin}/icon.svg`,
        },
      }),
    });

    const flwData = (await flwRes.json().catch(() => ({}))) as any;

    if (!flwRes.ok || flwData?.status !== 'success' || !flwData?.data?.link) {
      const errMsg = flwData?.message || `Flutterwave API returned status ${flwRes.status}`;
      console.error('[Payments] Flutterwave hosted payment creation failed:', {
        status: flwRes.status,
        message: errMsg,
        txRef,
        planCode: plan.code,
      });

      return sendJson(res, 400, {
        error: errMsg || 'Unable to generate Flutterwave checkout link.',
      });
    }

    const checkoutUrl = flwData.data.link;

    // 3. Store pending payment row in database
    await createPaymentRecord({
      user_id: userId,
      plan_code: plan.code,
      amount: plan.amount,
      currency: plan.currency || 'NGN',
      tx_ref: txRef,
      method: 'hosted_checkout',
      status: 'pending',
      metadata: {
        plan_name: plan.name_en,
        duration_days: plan.duration_days,
        user_email: user.email,
        checkout_url: checkoutUrl,
      },
    });

    return sendJson(res, 200, {
      success: true,
      checkoutUrl,
      txRef,
      amount: plan.amount,
      currency: plan.currency || 'NGN',
      plan: {
        code: plan.code,
        name_en: plan.name_en,
        duration_days: plan.duration_days,
      },
    });
  } catch (err: any) {
    console.error('[Payments] Create hosted checkout error:', err);
    return sendJson(res, 500, { error: 'Failed to initialize payment gateway' });
  }
}
