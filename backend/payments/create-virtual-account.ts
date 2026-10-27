// POST /api/payments/create-virtual-account
// Generates a dynamic Flutterwave NGN virtual bank account for instant bank transfer payments.
// SERVER-SIDE ONLY: Reads the amount strictly from the plans table (never trusted from client).
// NEVER generates fake/synthetic account numbers. If Flutterwave virtual account creation fails,
// logs the exact API error and returns a friendly message with a direct hosted checkout fallback.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireAuth, sendJson, readJson } from '../_lib.mjs';
import {
  getPlanByCode,
  getUnexpiredPendingPayment,
  countRecentPaymentsByUser,
  createPaymentRecord,
} from '../lib/supabase-server';

interface VirtualAccountRequestBody {
  plan_code?: string;
  plan?: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const body = (await readJson(req).catch(() => ({}))) as VirtualAccountRequestBody;
    const planCode = body.plan_code || (body.plan === 'monthly' ? 'premium_monthly' : 'premium_monthly');

    // 1. Fetch plan from database (single source of truth for pricing)
    const plan = await getPlanByCode(planCode);
    if (!plan || !plan.is_active) {
      return sendJson(res, 400, { error: 'Selected plan is not currently available.' });
    }

    const userId = user.uid || (user as any).id;

    // 2. Reuse unexpired pending payment for the same user and plan
    // Only reuse if it has a REAL bank account number
    const existingPayment = await getUnexpiredPendingPayment(userId, plan.code);
    if (existingPayment && existingPayment.account_number && existingPayment.expiry_date) {
      const remainingSeconds = Math.max(
        0,
        Math.floor((new Date(existingPayment.expiry_date).getTime() - Date.now()) / 1000)
      );

      // Verify it's not a legacy synthetic 99xxx account
      if (remainingSeconds > 300 && !existingPayment.account_number.startsWith('99')) {
        return sendJson(res, 200, {
          success: true,
          reused: true,
          bankName: existingPayment.bank_name || 'Flutterwave Partner Bank',
          accountNumber: existingPayment.account_number,
          accountName: existingPayment.account_name || 'Nooraya Premium Recitation',
          amount: existingPayment.amount,
          currency: existingPayment.currency || 'NGN',
          txRef: existingPayment.tx_ref,
          expiresAt: existingPayment.expiry_date,
          expiresInSeconds: remainingSeconds,
          plan: {
            code: plan.code,
            name_en: plan.name_en,
            duration_days: plan.duration_days,
          },
        });
      }
    }

    // 3. Rate-limit creation per user (max 5 new pending accounts per 15 minutes)
    const recentCount = await countRecentPaymentsByUser(userId);
    if (recentCount >= 5) {
      return sendJson(res, 429, {
        error: 'Too many pending payment requests. Please complete your existing bank transfer or wait a few minutes.',
      });
    }

    // 4. Create new transaction reference
    const txRef = `qf-bt-${Date.now()}-${userId.slice(0, 8)}`;
    const rawSecret = process.env.FLW_SECRET_KEY || '';
    const flwSecretKey = rawSecret.trim().replace(/^['"]|['"]$/g, '');

    const expiryMinutes = 60;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    let bankName = '';
    let accountNumber = '';
    let accountName = '';
    let flwRef: string | null = null;
    let flwId: string | null = null;
    let flwErrorMessage: string | null = null;

    // Determine host origin for fallback checkout
    const hostHeader = req.headers.host || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (hostHeader.startsWith('localhost') ? 'http' : 'https');
    const origin = `${proto}://${hostHeader}`;

    // 5. Call Flutterwave dynamic bank transfer charge API
    if (flwSecretKey && !flwSecretKey.includes('placeholder')) {
      try {
        const flwRes = await fetch('https://api.flutterwave.com/v3/charges?type=bank_transfer', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: plan.amount,
            currency: plan.currency || 'NGN',
            email: user.email,
            tx_ref: txRef,
            fullname: user.displayName || user.email.split('@')[0],
          }),
        });

        const flwData = (await flwRes.json().catch(() => ({}))) as any;

        if (flwRes.ok && (flwData?.status === 'success' || flwData?.status === 'pending')) {
          const auth = flwData?.meta?.authorization || flwData?.data;
          const candidateAccount = auth?.transfer_account || auth?.account_number || auth?.accountnumber;

          if (candidateAccount) {
            accountNumber = String(candidateAccount).trim();
            bankName = auth.transfer_bank || auth.bank_name || auth.bankname || 'Flutterwave Partner Bank';
            accountName = auth.account_name || auth.transfer_account_name || `Nooraya / ${user.email.split('@')[0]}`;
            flwRef = flwData?.data?.flw_ref || auth?.flw_ref || null;
            flwId = flwData?.data?.id ? String(flwData.data.id) : null;
          } else {
            flwErrorMessage = flwData?.message || 'Flutterwave response did not contain virtual account details.';
          }
        } else {
          flwErrorMessage = flwData?.message || `Flutterwave API returned status ${flwRes.status}`;
        }
      } catch (err: any) {
        flwErrorMessage = err?.message || 'Network error reaching Flutterwave API.';
      }
    } else {
      flwErrorMessage = 'FLW_SECRET_KEY is not configured in server environment.';
    }

    // 6. If Flutterwave returned a real virtual account: Store & return it
    if (accountNumber && bankName) {
      await createPaymentRecord({
        user_id: userId,
        plan_code: plan.code,
        amount: plan.amount,
        currency: plan.currency || 'NGN',
        tx_ref: txRef,
        method: 'bank_transfer',
        status: 'pending',
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        expiry_date: expiresAt,
        flw_ref: flwRef,
        flw_id: flwId,
        metadata: {
          plan_name: plan.name_en,
          duration_days: plan.duration_days,
          user_email: user.email,
        },
      });

      return sendJson(res, 200, {
        success: true,
        bankName,
        accountNumber,
        accountName,
        amount: plan.amount,
        currency: plan.currency || 'NGN',
        txRef,
        expiresAt,
        expiresInSeconds: expiryMinutes * 60,
        plan: {
          code: plan.code,
          name_en: plan.name_en,
          duration_days: plan.duration_days,
        },
      });
    }

    // 7. VIRTUAL ACCOUNT FAILED: NEVER generate a fake number.
    // Log the exact error for admin diagnosis and generate a hosted checkout fallback.
    console.error('[Payments Admin Alert] Dynamic virtual account generation failed:', {
      error: flwErrorMessage,
      user_email: user.email,
      txRef,
      plan_code: plan.code,
    });

    // Generate fallback hosted checkout link so the user can still pay seamlessly via card or bank transfer
    let fallbackCheckoutUrl: string | null = null;
    if (flwSecretKey && !flwSecretKey.includes('placeholder')) {
      try {
        const redirectUrl = `${origin}/premium?status=successful&tx_ref=${encodeURIComponent(txRef)}&plan_code=${encodeURIComponent(plan.code)}`;
        const fallbackRes = await fetch('https://api.flutterwave.com/v3/payments', {
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
              description: `${plan.name_en} (${plan.amount} ${plan.currency})`,
              logo: `${origin}/icon.svg`,
            },
          }),
        });

        const fallbackData = (await fallbackRes.json().catch(() => ({}))) as any;
        if (fallbackRes.ok && fallbackData?.data?.link) {
          fallbackCheckoutUrl = fallbackData.data.link;

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
              fallback_from: 'bank_transfer',
            },
          });
        }
      } catch (fbErr) {
        console.warn('[Payments] Hosted checkout fallback generation notice:', fbErr);
      }
    }

    return sendJson(res, 200, {
      success: false,
      error: 'Direct virtual bank account generation is temporarily unavailable. Please proceed using Flutterwave multi-channel checkout.',
      detailedError: flwErrorMessage,
      fallbackCheckoutUrl,
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
    console.error('[Payments] Create virtual account error:', err);
    return sendJson(res, 500, { error: 'Failed to process payment request' });
  }
}
