import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Check,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { appApi } from '../../lib/api';
import { formatPlanPrice, type PaymentRow } from '../../lib/supabase';

interface PaymentsAdminProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  askConfirm: (title: string, message: string, onConfirm: () => Promise<void> | void) => void;
}

interface FlutterwaveDiagnostics {
  ok: boolean;
  publicKey: {
    configured: boolean;
    prefix: string | null;
    mode: 'live' | 'test' | 'unknown' | null;
    hasWhitespaceOrQuotes: boolean;
    variableName: string;
  };
  secretKey: {
    configured: boolean;
    prefix: string | null;
    mode: 'live' | 'test' | 'unknown' | null;
    hasWhitespaceOrQuotes: boolean;
    variableName: string;
  };
  webhookHash: {
    configured: boolean;
    variableName: string;
  };
  modeMatch: boolean;
  connectivity: {
    tested: boolean;
    success: boolean;
    status: number | null;
    message: string;
  };
  recommendations: string[];
}

export function PaymentsAdmin({ showToast, askConfirm }: PaymentsAdminProps) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reconciling, setReconciling] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [diag, setDiag] = useState<FlutterwaveDiagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const loadDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const res = await appApi<FlutterwaveDiagnostics>('/admin/payments/diagnostics');
      setDiag(res);
    } catch (e: any) {
      console.warn('Load diagnostics error:', e);
    } finally {
      setDiagLoading(false);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await appApi<{
        ok: boolean;
        payments: PaymentRow[];
        total: number;
      }>(
        `/admin/payments?search=${encodeURIComponent(search)}&status=${encodeURIComponent(
          statusFilter
        )}&page=${page}&pageSize=20`
      );

      if (res.ok) {
        setPayments(res.payments || []);
        setTotal(res.total || 0);
      }
    } catch (e: any) {
      console.warn('Load payments error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    loadDiagnostics();
  }, [search, statusFilter, page]);

  // Re-verify a stuck transaction with Flutterwave API
  const handleReverify = (p: PaymentRow) => {
    askConfirm(
      'Re-Verify Transaction',
      `Check Flutterwave API directly for reference "${p.tx_ref}"? If the payment cleared, the user's account will be unlocked immediately.`,
      async () => {
        setActionLoadingId(p.id);
        try {
          const res = await appApi<{ ok: boolean; status: string; message: string }>('/admin/payments', {
            method: 'POST',
            body: { action: 'reverify', tx_ref: p.tx_ref },
          });

          if (res.ok) {
            showToast(res.message, 'success');
            await loadPayments();
          } else {
            showToast(res.message || 'Payment is not successful in Flutterwave.', 'error');
          }
        } catch (e: any) {
          showToast(e?.message || 'Error re-verifying transaction.', 'error');
        } finally {
          setActionLoadingId(null);
        }
      }
    );
  };

  // Batch reconciliation
  const handleBatchReconcile = () => {
    askConfirm(
      'Reconcile All Pending Payments',
      'This will check Flutterwave for all pending payments created in the last 24 hours. Any successful payments that missed a webhook will be activated automatically. Proceed?',
      async () => {
        setReconciling(true);
        try {
          const res = await appApi<{ ok: boolean; checked: number; activated: number; message: string }>(
            '/admin/payments',
            {
              method: 'POST',
              body: { action: 'reconcile' },
            }
          );
          if (res.ok) {
            showToast(res.message, 'success');
            await loadPayments();
          } else {
            showToast('Reconciliation failed.', 'error');
          }
        } catch (e: any) {
          showToast(e?.message || 'Reconciliation error.', 'error');
        } finally {
          setReconciling(false);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-serif text-white flex items-center gap-2">
            <CreditCard size={20} className="text-emerald-400" />
            <span>Payments & Flutterwave Reconciliation</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Live log of all bank transfer and card transactions with automatic webhook verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadDiagnostics}
            disabled={diagLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Activity size={13} className={diagLoading ? 'animate-spin text-emerald-400' : 'text-emerald-400'} />
            <span>Check Gateway</span>
          </button>

          <button
            type="button"
            onClick={handleBatchReconcile}
            disabled={reconciling}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={13} className={reconciling ? 'animate-spin' : ''} />
            <span>Reconcile Pending (24h)</span>
          </button>

          <button
            type="button"
            onClick={loadPayments}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* FLUTTERWAVE GATEWAY DIAGNOSTICS */}
      {diag && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0D121F] to-[#0A0D14] border border-slate-800/80 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className={diag.connectivity.success ? 'text-emerald-400' : 'text-amber-400'} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Flutterwave Gateway Status
              </h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                diag.connectivity.success
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {diag.connectivity.success ? 'API Operational' : 'Connection Warning'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {/* Secret Key Card */}
            <div className="p-3 rounded-xl bg-[#080B11] border border-slate-800/60">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Server Secret Key</div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-200">
                  {diag.secretKey.prefix || 'Missing'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                    diag.secretKey.mode === 'live'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : diag.secretKey.mode === 'test'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {diag.secretKey.mode || 'Not set'}
                </span>
              </div>
            </div>

            {/* Public Key Card */}
            <div className="p-3 rounded-xl bg-[#080B11] border border-slate-800/60">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Public Key Config</div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-200">
                  {diag.publicKey.prefix || 'Missing'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                    diag.publicKey.mode === 'live'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : diag.publicKey.mode === 'test'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {diag.publicKey.mode || 'Server Only'}
                </span>
              </div>
            </div>

            {/* Mode Match & Webhook */}
            <div className="p-3 rounded-xl bg-[#080B11] border border-slate-800/60">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Webhook Secret Hash</div>
              <div className="flex items-center justify-between">
                <span className="text-slate-200">
                  {diag.webhookHash.configured ? 'Configured' : 'Missing'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                    diag.webhookHash.configured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {diag.webhookHash.configured ? 'Active' : 'Unset'}
                </span>
              </div>
            </div>
          </div>

          {diag.recommendations.length > 0 && (
            <div className="mt-2 space-y-1">
              {diag.recommendations.map((rec, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-amber-300/90">
                  <AlertTriangle size={12} className="shrink-0 text-amber-400" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEARCH & FILTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by tx_ref, bank, or account number..."
            className="w-full bg-[#0D121F] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Payment Statuses</option>
            <option value="successful">Successful Only</option>
            <option value="pending">Pending Only</option>
            <option value="overpaid">Overpaid</option>
            <option value="underpaid">Underpaid</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* PAYMENTS TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#050811] border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Method / Account</th>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString()}
                  <span className="block text-[10px] text-slate-500">
                    {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-semibold text-white block truncate max-w-[140px]">
                    {p.user_email || p.user_name || p.user_id.slice(0, 8)}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono font-bold text-emerald-300">
                  {formatPlanPrice(p.amount, p.currency)}
                  {p.amount_paid && p.amount_paid !== p.amount && (
                    <span className="block text-[10px] text-amber-300">Paid: ₦{p.amount_paid}</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 capitalize text-slate-300">
                    {p.method === 'bank_transfer' ? <Building2 size={13} /> : <CreditCard size={13} />}
                    <span>{p.method.replace('_', ' ')}</span>
                  </div>
                  {p.account_number && (
                    <span className="text-[10px] font-mono text-slate-500 block">
                      {p.bank_name}: {p.account_number}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono text-slate-400 select-all text-[11px] truncate max-w-[150px]">
                  {p.tx_ref}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      p.status === 'successful' || p.status === 'overpaid'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : p.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  {p.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => handleReverify(p)}
                      disabled={actionLoadingId === p.id}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      {actionLoadingId === p.id ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <RotateCcw size={11} />
                      )}
                      <span>Re-verify</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : 'Settled'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payments.length === 0 && !loading && (
        <div className="py-12 text-center text-xs text-slate-500">
          No payment transactions found matching your criteria.
        </div>
      )}

      {/* PAGINATION */}
      {total > 20 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
          <div>
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} transactions
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-mono text-slate-300">
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <button
              type="button"
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
