/**
 * Server-side Supabase Admin & Database Layer for Plans & Payments
 * 
 * Uses SUPABASE_SERVICE_ROLE_KEY (server-side only) to bypass RLS,
 * with seamless fallback to Postgres connection pool (q) or persistent serverStore.
 * Never exposes or logs secret keys.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { q, serverStore, saveStore } from '../_lib.mjs';

export interface PlanRow {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string | null;
  amount: number;
  currency: string;
  duration_days: number;
  is_active: boolean;
  sort_order: number;
  features: string[];
  created_at: string;
  updated_at?: string;
}

export interface PlanPriceLogRow {
  id: string;
  plan_code: string;
  old_amount: number;
  new_amount: number;
  changed_by: string;
  changed_at: string;
}

export interface PaymentRow {
  id: string;
  user_id: string;
  plan_code: string;
  amount: number;
  currency: string;
  tx_ref: string;
  method: string;
  status: 'pending' | 'successful' | 'failed' | 'expired' | 'underpaid' | 'overpaid';
  flw_ref?: string | null;
  flw_id?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  expiry_date?: string | null;
  amount_paid?: number | null;
  metadata?: Record<string, any>;
  created_at: string;
  paid_at?: string | null;
  user_email?: string | null;
  user_name?: string | null;
}

const DEFAULT_MONTHLY_PLAN: PlanRow = {
  id: 'plan_premium_monthly',
  code: 'premium_monthly',
  name_en: 'Monthly Sanctuary',
  name_ar: 'الاشتراك الشهري',
  amount: 500,
  currency: 'NGN',
  duration_days: 30,
  is_active: true,
  sort_order: 1,
  features: [
    'Offline Surah Audio Downloads (Any Sheikh)',
    'All 7+ Atmospheric HD Video Soundscapes',
    'Studio High-Bitrate Recitations',
    'Distraction-Free Pure Quranic Sanctuary',
  ],
  created_at: new Date().toISOString(),
};

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  try {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return adminClient;
  } catch (e) {
    console.warn('[supabase-admin] Client init error:', e);
    return null;
  }
}

/**
 * Fetch all active plans (pricing source of truth)
 */
export async function getActivePlans(): Promise<PlanRow[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((r) => ({
          ...r,
          amount: Number(r.amount),
          features: Array.isArray(r.features) ? r.features : [],
        }));
      }
    } catch (e) {
      console.warn('[supabase-admin] getActivePlans error:', e);
    }
  }

  // Fallback to pool query
  try {
    const { rows } = await q(
      'SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC, created_at DESC'
    );
    if (rows && rows.length > 0) {
      return rows.map((r: any) => ({
        ...r,
        amount: Number(r.amount),
        features: typeof r.features === 'string' ? JSON.parse(r.features) : (r.features || []),
      }));
    }
  } catch {}

  // Fallback to store
  if (Array.isArray(serverStore?.plans) && serverStore.plans.length > 0) {
    return serverStore.plans.filter((p: any) => p.is_active);
  }

  return [DEFAULT_MONTHLY_PLAN];
}

/**
 * Fetch a single plan by code
 */
export async function getPlanByCode(code: string): Promise<PlanRow | null> {
  const plans = await getActivePlans();
  const found = plans.find((p) => p.code === code);
  if (found) return found;

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data } = await sb.from('plans').select('*').eq('code', code).single();
      if (data) {
        return {
          ...data,
          amount: Number(data.amount),
          features: Array.isArray(data.features) ? data.features : [],
        };
      }
    } catch {}
  }

  return code === 'premium_monthly' ? DEFAULT_MONTHLY_PLAN : null;
}

/**
 * Update plan (amount, duration, is_active) with automatic price change audit logging
 */
export async function updatePlanAdmin(
  code: string,
  updates: { amount?: number; duration_days?: number; is_active?: boolean; name_en?: string },
  changedBy: string
): Promise<{ ok: boolean; plan?: PlanRow; error?: string }> {
  const currentPlan = await getPlanByCode(code);
  if (!currentPlan) return { ok: false, error: `Plan "${code}" not found.` };

  const oldAmount = currentPlan.amount;
  const newAmount = updates.amount !== undefined ? Number(updates.amount) : oldAmount;
  const isPriceChanged = newAmount !== oldAmount;

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (updates.amount !== undefined) updateData.amount = newAmount;
      if (updates.duration_days !== undefined) updateData.duration_days = Number(updates.duration_days);
      if (updates.is_active !== undefined) updateData.is_active = Boolean(updates.is_active);
      if (updates.name_en !== undefined) updateData.name_en = updates.name_en;

      const { data, error } = await sb.from('plans').update(updateData).eq('code', code).select().single();
      if (error) throw error;

      if (isPriceChanged) {
        await sb.from('plan_price_logs').insert({
          plan_code: code,
          old_amount: oldAmount,
          new_amount: newAmount,
          changed_by: changedBy || 'admin',
          changed_at: new Date().toISOString(),
        });
      }

      return {
        ok: true,
        plan: {
          ...data,
          amount: Number(data.amount),
          features: Array.isArray(data.features) ? data.features : [],
        },
      };
    } catch (e: any) {
      console.warn('[supabase-admin] updatePlan error:', e);
    }
  }

  // Fallback to Postgres pool or store
  try {
    await q(
      `UPDATE plans SET
         amount = COALESCE($1, amount),
         duration_days = COALESCE($2, duration_days),
         is_active = COALESCE($3, is_active),
         updated_at = now()
       WHERE code = $4`,
      [updates.amount, updates.duration_days, updates.is_active, code]
    );

    if (isPriceChanged) {
      await q(
        `INSERT INTO plan_price_logs (plan_code, old_amount, new_amount, changed_by, changed_at)
         VALUES ($1, $2, $3, $4, now())`,
        [code, oldAmount, newAmount, changedBy || 'admin']
      );
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to update plan.' };
  }
}

/**
 * Fetch price change audit logs
 */
export async function getPlanPriceLogs(code?: string): Promise<PlanPriceLogRow[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      let query = sb.from('plan_price_logs').select('*').order('changed_at', { ascending: false });
      if (code) query = query.eq('plan_code', code);
      const { data, error } = await query.limit(50);
      if (!error && Array.isArray(data)) {
        return data.map((r) => ({
          ...r,
          old_amount: Number(r.old_amount),
          new_amount: Number(r.new_amount),
        }));
      }
    } catch {}
  }

  try {
    const { rows } = await q(
      'SELECT * FROM plan_price_logs ORDER BY changed_at DESC LIMIT 50'
    );
    if (rows) {
      return rows.map((r: any) => ({
        ...r,
        old_amount: Number(r.old_amount),
        new_amount: Number(r.new_amount),
      }));
    }
  } catch {}

  return [];
}

/**
 * Find an unexpired pending payment with an active virtual account for this user and plan.
 * Reusing accounts saves round trips and avoids polluting Flutterwave with abandoned accounts.
 */
export async function getUnexpiredPendingPayment(userId: string, planCode: string): Promise<PaymentRow | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const nowIso = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // Must have at least 5m left
      const { data, error } = await sb
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .eq('plan_code', planCode)
        .eq('status', 'pending')
        .gt('expiry_date', nowIso)
        .not('account_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          amount: Number(data.amount),
          amount_paid: data.amount_paid ? Number(data.amount_paid) : null,
        };
      }
    } catch {}
  }

  try {
    const { rows } = await q(
      `SELECT * FROM payments 
       WHERE user_id = $1 AND plan_code = $2 AND status = 'pending' 
         AND account_number IS NOT NULL AND expiry_date > now() + interval '5 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, planCode]
    );
    if (rows && rows[0]) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
        amount_paid: rows[0].amount_paid ? Number(rows[0].amount_paid) : null,
      };
    }
  } catch {}

  // In-memory fallback
  if (Array.isArray(serverStore?.payments)) {
    const now = Date.now();
    const match = serverStore.payments.find(
      (p: any) =>
        p.user_id === userId &&
        p.plan_code === planCode &&
        p.status === 'pending' &&
        p.account_number &&
        new Date(p.expiry_date).getTime() > now + 300_000
    );
    if (match) return match;
  }

  return null;
}

/**
 * Count recent payment requests created by user (rate limit: max 5 per 15 minutes)
 */
export async function countRecentPaymentsByUser(userId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count } = await sb
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('created_at', fifteenMinsAgo);
      return count || 0;
    } catch {}
  }

  try {
    const { rows } = await q(
      `SELECT count(*) FROM payments WHERE user_id = $1 AND created_at > now() - interval '15 minutes'`,
      [userId]
    );
    return rows[0]?.count ? parseInt(rows[0].count, 10) : 0;
  } catch {}

  return 0;
}

/**
 * Record a new pending or completed payment
 */
export async function createPaymentRecord(data: {
  user_id: string;
  plan_code: string;
  amount: number;
  currency: string;
  tx_ref: string;
  method?: string;
  status?: PaymentRow['status'];
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  expiry_date?: string | null;
  flw_ref?: string | null;
  flw_id?: string | null;
  metadata?: Record<string, any>;
}): Promise<PaymentRow> {
  const record: any = {
    user_id: data.user_id,
    plan_code: data.plan_code,
    amount: data.amount,
    currency: data.currency || 'NGN',
    tx_ref: data.tx_ref,
    method: data.method || 'bank_transfer',
    status: data.status || 'pending',
    bank_name: data.bank_name || null,
    account_number: data.account_number || null,
    account_name: data.account_name || null,
    expiry_date: data.expiry_date || null,
    flw_ref: data.flw_ref || null,
    flw_id: data.flw_id || null,
    metadata: data.metadata || {},
    created_at: new Date().toISOString(),
  };

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data: inserted, error } = await sb.from('payments').insert(record).select().single();
      if (!error && inserted) {
        return {
          ...inserted,
          amount: Number(inserted.amount),
        };
      }
    } catch (e) {
      console.warn('[supabase-admin] createPaymentRecord error:', e);
    }
  }

  try {
    const { rows } = await q(
      `INSERT INTO payments (
         user_id, plan_code, amount, currency, tx_ref, method, status,
         bank_name, account_number, account_name, expiry_date, flw_ref, flw_id, metadata, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
       RETURNING *`,
      [
        record.user_id,
        record.plan_code,
        record.amount,
        record.currency,
        record.tx_ref,
        record.method,
        record.status,
        record.bank_name,
        record.account_number,
        record.account_name,
        record.expiry_date,
        record.flw_ref,
        record.flw_id,
        JSON.stringify(record.metadata),
      ]
    );
    if (rows && rows[0]) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
      };
    }
  } catch {}

  // Store fallback
  if (!serverStore.payments) serverStore.payments = [];
  serverStore.payments.push(record);
  await saveStore();
  return record;
}

/**
 * Fetch a payment by tx_ref
 */
export async function getPaymentByTxRef(txRef: string): Promise<PaymentRow | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb.from('payments').select('*').eq('tx_ref', txRef).maybeSingle();
      if (!error && data) {
        return {
          ...data,
          amount: Number(data.amount),
          amount_paid: data.amount_paid ? Number(data.amount_paid) : null,
        };
      }
    } catch {}
  }

  try {
    const { rows } = await q('SELECT * FROM payments WHERE tx_ref = $1 LIMIT 1', [txRef]);
    if (rows && rows[0]) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
        amount_paid: rows[0].amount_paid ? Number(rows[0].amount_paid) : null,
      };
    }
  } catch {}

  if (Array.isArray(serverStore?.payments)) {
    const match = serverStore.payments.find((p: any) => p.tx_ref === txRef);
    if (match) return match;
  }

  return null;
}

/**
 * Updates payment status and paid metadata
 */
export async function updatePaymentStatus(
  txRef: string,
  updates: {
    status: PaymentRow['status'];
    flw_id?: string;
    flw_ref?: string;
    amount_paid?: number;
    paid_at?: string | null;
    metadata?: Record<string, any>;
  }
): Promise<PaymentRow | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('payments')
        .update({
          status: updates.status,
          ...(updates.flw_id ? { flw_id: updates.flw_id } : {}),
          ...(updates.flw_ref ? { flw_ref: updates.flw_ref } : {}),
          ...(updates.amount_paid !== undefined ? { amount_paid: updates.amount_paid } : {}),
          ...(updates.paid_at ? { paid_at: updates.paid_at } : {}),
          ...(updates.metadata ? { metadata: updates.metadata } : {}),
        })
        .eq('tx_ref', txRef)
        .select()
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          amount: Number(data.amount),
          amount_paid: data.amount_paid ? Number(data.amount_paid) : null,
        };
      }
    } catch (e) {
      console.warn('[supabase-admin] updatePaymentStatus error:', e);
    }
  }

  try {
    const { rows } = await q(
      `UPDATE payments SET
         status = $1,
         flw_id = COALESCE($2, flw_id),
         flw_ref = COALESCE($3, flw_ref),
         amount_paid = COALESCE($4, amount_paid),
         paid_at = COALESCE($5, paid_at)
       WHERE tx_ref = $6
       RETURNING *`,
      [
        updates.status,
        updates.flw_id || null,
        updates.flw_ref || null,
        updates.amount_paid ?? null,
        updates.paid_at || null,
        txRef,
      ]
    );
    if (rows && rows[0]) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
      };
    }
  } catch {}

  if (Array.isArray(serverStore?.payments)) {
    const p = serverStore.payments.find((x: any) => x.tx_ref === txRef);
    if (p) {
      p.status = updates.status;
      if (updates.flw_id) p.flw_id = updates.flw_id;
      if (updates.amount_paid) p.amount_paid = updates.amount_paid;
      if (updates.paid_at) p.paid_at = updates.paid_at;
      await saveStore();
      return p;
    }
  }

  return null;
}

/**
 * Activates user premium with stacking duration:
 * premium_expires_at = max(now, current_expiry) + duration_days
 */
export async function activateUserPremium(
  userId: string,
  userEmail: string,
  planCode: string,
  durationDays: number,
  flwTxId?: string
): Promise<{ isPremium: boolean; expiresAt: string }> {
  let currentExpiry = 0;

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data: profile } = await sb
        .from('profiles')
        .select('premium_expires_at')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.premium_expires_at) {
        currentExpiry = new Date(profile.premium_expires_at).getTime();
      }
    } catch {}
  }

  if (!currentExpiry) {
    try {
      const { rows } = await q('SELECT premium_expires_at FROM users WHERE uid = $1 OR email = $2', [
        userId,
        userEmail,
      ]);
      if (rows && rows[0]?.premium_expires_at) {
        currentExpiry = new Date(rows[0].premium_expires_at).getTime();
      }
    } catch {}
  }

  // Early renewal stacks time instead of wasting it
  const baseTime = Math.max(Date.now(), currentExpiry);
  const durationMs = (durationDays || 30) * 24 * 60 * 60 * 1000;
  const newExpiresAt = new Date(baseTime + durationMs).toISOString();

  // 1. Update Supabase profiles
  if (sb) {
    try {
      await sb
        .from('profiles')
        .update({
          is_premium: true,
          premium_expires_at: newExpiresAt,
          subscription_plan: planCode,
          flw_transaction_id: flwTxId || null,
        })
        .eq('id', userId);
    } catch (e) {
      console.warn('[supabase-admin] Update profile premium failed:', e);
    }
  }

  // 2. Update users table for legacy compatibility
  try {
    await q(
      `UPDATE users SET
         is_premium = true,
         subscription_plan = $1,
         flw_transaction_id = $2,
         premium_expires_at = $3
       WHERE uid = $4 OR LOWER(email) = LOWER($5)`,
      [planCode, flwTxId || null, newExpiresAt, userId, userEmail]
    );
  } catch {}

  // 3. Update store
  if (Array.isArray(serverStore?.users)) {
    const u = serverStore.users.find((x: any) => x.uid === userId || x.email === userEmail);
    if (u) {
      u.is_premium = true;
      u.subscription_plan = planCode;
      u.premium_expires_at = newExpiresAt;
      await saveStore();
    }
  }

  return { isPremium: true, expiresAt: newExpiresAt };
}

/**
 * List payments with search, pagination, and status filters for admin panel
 */
export async function listPaymentsAdmin(options: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ payments: PaymentRow[]; total: number }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(50, Math.max(5, options.pageSize || 20));
  const status = options.status && options.status !== 'all' ? options.status : null;
  const search = (options.search || '').trim().toLowerCase();

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      let query = sb
        .from('payments')
        .select('*, profiles:user_id(email, full_name)', { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (search) {
        query = query.or(`tx_ref.ilike.%${search}%,bank_name.ilike.%${search}%,account_number.ilike.%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);

      if (!error && Array.isArray(data)) {
        const payments = data.map((p: any) => ({
          ...p,
          amount: Number(p.amount),
          amount_paid: p.amount_paid ? Number(p.amount_paid) : null,
          user_email: p.profiles?.email || null,
          user_name: p.profiles?.full_name || null,
        }));
        return { payments, total: count || payments.length };
      }
    } catch (e) {
      console.warn('[supabase-admin] listPaymentsAdmin error:', e);
    }
  }

  // Postgres pool fallback
  try {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (tx_ref ILIKE $${params.length} OR bank_name ILIKE $${params.length} OR account_number ILIKE $${params.length})`;
    }

    const countRes = await q(`SELECT count(*) FROM payments ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(pageSize);
    params.push((page - 1) * pageSize);
    const { rows } = await q(
      `SELECT p.*, pr.email as user_email, pr.full_name as user_name
       FROM payments p
       LEFT JOIN profiles pr ON p.user_id = pr.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      payments: (rows || []).map((r: any) => ({
        ...r,
        amount: Number(r.amount),
        amount_paid: r.amount_paid ? Number(r.amount_paid) : null,
      })),
      total,
    };
  } catch {}

  const allPayments = Array.isArray(serverStore?.payments) ? serverStore.payments : [];
  return {
    payments: allPayments.slice((page - 1) * pageSize, page * pageSize),
    total: allPayments.length,
  };
}
