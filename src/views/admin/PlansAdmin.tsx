import React, { useState, useEffect } from 'react';
import {
  Tag,
  Save,
  Clock,
  History,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { appApi } from '../../lib/api';
import { formatPlanPrice, type PlanRow, type PlanPriceLogRow } from '../../lib/supabase';

interface PlansAdminProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  askConfirm: (title: string, message: string, onConfirm: () => Promise<void> | void) => void;
}

export function PlansAdmin({ showToast, askConfirm }: PlansAdminProps) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [logs, setLogs] = useState<PlanPriceLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit form state for primary monthly plan
  const [editAmount, setEditAmount] = useState<number>(500);
  const [editDuration, setEditDuration] = useState<number>(30);
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editName, setEditName] = useState<string>('Monthly Sanctuary');

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, logsRes] = await Promise.all([
        appApi<{ ok: boolean; plans: PlanRow[] }>('/admin/plans').catch(() => ({ ok: false, plans: [] })),
        appApi<{ ok: boolean; logs: PlanPriceLogRow[] }>('/admin/plan-price-logs').catch(() => ({ ok: false, logs: [] })),
      ]);

      if (plansRes.plans && plansRes.plans.length > 0) {
        setPlans(plansRes.plans);
        const monthly = plansRes.plans.find((p) => p.code === 'premium_monthly') || plansRes.plans[0];
        setEditAmount(Number(monthly.amount));
        setEditDuration(Number(monthly.duration_days));
        setEditActive(Boolean(monthly.is_active));
        setEditName(monthly.name_en);
      }

      if (logsRes.logs) {
        setLogs(logsRes.logs);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePlan = () => {
    const current = plans.find((p) => p.code === 'premium_monthly') || plans[0];
    const isPriceChange = current && Number(current.amount) !== Number(editAmount);

    const performUpdate = async () => {
      setSaving(true);
      try {
        const res = await appApi<{ ok: boolean; plan: PlanRow }>('/admin/plans', {
          method: 'POST',
          body: {
            code: current?.code || 'premium_monthly',
            amount: Number(editAmount),
            duration_days: Number(editDuration),
            is_active: Boolean(editActive),
            name_en: editName.trim(),
          },
        });

        if (res.ok) {
          showToast('Subscription plan updated and price logged successfully!', 'success');
          await loadData();
        } else {
          showToast('Failed to update plan.', 'error');
        }
      } catch (err: any) {
        showToast(err?.message || 'Error updating plan.', 'error');
      } finally {
        setSaving(false);
      }
    };

    if (isPriceChange) {
      askConfirm(
        'Confirm Price Change',
        `You are changing the plan price from ${formatPlanPrice(current.amount, current.currency)} to ${formatPlanPrice(editAmount, current.currency)}. This change applies ONLY to new transactions. Existing active or pending payments will keep their original amount. Proceed?`,
        performUpdate
      );
    } else {
      performUpdate();
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-serif text-white flex items-center gap-2">
            <Coins size={20} className="text-emerald-400" />
            <span>Premium Pricing Source of Truth</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure the canonical plan price, duration, and active status in Supabase. All apps and devices sync
            instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Plans</span>
        </button>
      </div>

      {/* PLAN EDIT CARD */}
      <div className="p-6 rounded-3xl bg-[#0B101E] border border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-emerald-400" />
            <span className="text-sm font-bold text-white">Monthly Sanctuary Pass</span>
            <span className="text-[10px] font-mono text-slate-500">(code: premium_monthly)</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              editActive
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {editActive ? 'Active Plan' : 'Disabled'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">
              Price (Naira ₦) <span className="text-emerald-400 font-mono">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
              <input
                type="number"
                min="100"
                step="50"
                value={editAmount}
                onChange={(e) => setEditAmount(Number(e.target.value))}
                className="w-full bg-[#050811] border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Formatted: {formatPlanPrice(editAmount, 'NGN')}
            </span>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">Duration (Days)</label>
            <input
              type="number"
              min="1"
              max="365"
              value={editDuration}
              onChange={(e) => setEditDuration(Number(e.target.value))}
              className="w-full bg-[#050811] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Standard 30 days per payment</span>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">Display Title</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-[#050811] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Visible to all visitors</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
            />
            <span>Plan is active and available for payment</span>
          </label>

          <button
            type="button"
            onClick={handleSavePlan}
            disabled={saving || loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            <span>Save Pricing Changes</span>
          </button>
        </div>
      </div>

      {/* PRICE CHANGE AUDIT LOG TABLE */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <History size={16} className="text-slate-400" />
          <span>Price Change Audit Trail</span>
        </h3>

        {logs.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800/60 text-center text-xs text-slate-500">
            No price modifications recorded yet. Any price updates will appear here with user & timestamp.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#050811] border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Plan</th>
                  <th className="py-2.5 px-4">Old Price</th>
                  <th className="py-2.5 px-4">New Price</th>
                  <th className="py-2.5 px-4">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/20">
                    <td className="py-2.5 px-4 text-slate-400">{new Date(l.changed_at).toLocaleString()}</td>
                    <td className="py-2.5 px-4 font-mono text-white">{l.plan_code}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">₦{Number(l.old_amount).toLocaleString()}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                      ₦{Number(l.new_amount).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{l.changed_by || 'Admin'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
