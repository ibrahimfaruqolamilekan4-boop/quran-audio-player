import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Check,
  ShieldCheck,
  WifiOff,
  Film,
  Headphones,
  Zap,
  ArrowRight,
  Clock,
  Copy,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  RefreshCw,
  ExternalLink,
  Receipt,
  FileText,
  Printer,
  X,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { appApi } from '../lib/api';
import {
  fetchActivePlans,
  subscribeToPlans,
  subscribeToUserPayments,
  fetchUserPayments,
  formatPlanPrice,
  type PlanRow,
  type PaymentRow,
} from '../lib/supabase';

const FEATURES = [
  {
    icon: WifiOff,
    title: 'Offline Surah Audio Downloads',
    desc: 'Download any surah from all 30+ sheikhs and listen anytime with zero internet or cellular data.',
  },
  {
    icon: Film,
    title: 'All Atmospheric HD Video Soundscapes',
    desc: 'Immersive Medina night prayer, rain dua, ocean calm, firelight, and mountain mist loops.',
  },
  {
    icon: Headphones,
    title: 'Studio High-Bitrate Recitation',
    desc: 'Uncompressed, crystal-clear audio streams across every classical and modern reciter.',
  },
  {
    icon: ShieldCheck,
    title: 'Pure Spiritual Sanctuary',
    desc: 'Zero distracting clutter, ad-free forever, designed purely for sincere worship and focus.',
  },
];

export function PremiumView() {
  const { user, isPremium, refreshUser, setUser } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('premium_monthly');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'card'>('transfer');

  // Transfer Modal & Dynamic Virtual Account state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    currency: string;
    txRef: string;
    expiresAt: string;
    expiresInSeconds: number;
  } | null>(null);
  const [isGeneratingAccount, setIsGeneratingAccount] = useState(false);
  const [fallbackCheckoutUrl, setFallbackCheckoutUrl] = useState<string | null>(null);
  const [loadingHosted, setLoadingHosted] = useState(false);
  const [isPollingStatus, setIsPollingStatus] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600);
  const [successNotice, setSuccessNotice] = useState(false);

  // User payment history & receipt
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<PaymentRow | null>(null);

  const pollingTimerRef = useRef<any>(null);

  // 1. Load active plans
  useEffect(() => {
    let mounted = true;
    async function load() {
      setPlansLoading(true);
      try {
        const loaded = await fetchActivePlans();
        if (mounted && loaded.length > 0) {
          setPlans(loaded);
          if (!loaded.some((p) => p.code === selectedPlanCode)) {
            setSelectedPlanCode(loaded[0].code);
          }
        }
      } finally {
        if (mounted) setPlansLoading(false);
      }
    }

    load();
    const unsub = subscribeToPlans(load);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const activePlan = plans.find((p) => p.code === selectedPlanCode) || plans[0];

  // 2. Load payment history for the current user
  const loadUserPayments = async () => {
    const userId = user?.uid || (user as any)?.id;
    if (!userId) return;
    setPaymentsLoading(true);
    try {
      const history = await fetchUserPayments(userId);
      setPayments(history);
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    loadUserPayments();
  }, [user]);

  // 3. 60-Minute Countdown Timer for Virtual Account
  useEffect(() => {
    if (!isTransferModalOpen || !virtualAccount) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTransferModalOpen, virtualAccount]);

  // 4. Realtime & polling listeners while transfer modal is open
  useEffect(() => {
    if (!isTransferModalOpen || !virtualAccount || successNotice) return;

    const userId = user?.uid || (user as any)?.id;
    const unsub = subscribeToUserPayments(userId, (payload) => {
      if (
        payload.new?.tx_ref === virtualAccount.txRef &&
        (payload.new?.status === 'successful' || payload.new?.status === 'overpaid')
      ) {
        handleTransferSuccess();
      }
    });

    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await appApi<{ status: string; isPremium: boolean }>(
          `/payments/check-transfer-status?tx_ref=${encodeURIComponent(virtualAccount.txRef)}`
        );
        if (res.isPremium || res.status === 'successful') {
          handleTransferSuccess();
        }
      } catch {}
    }, 5000);

    return () => {
      unsub();
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isTransferModalOpen, virtualAccount, successNotice]);

  const handleTransferSuccess = async () => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    setSuccessNotice(true);
    setIsTransferModalOpen(false);
    await refreshUser();
    await loadUserPayments();
  };

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const handleCopy = (text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Start Bank Transfer Flow (< 3 seconds target)
  const handleInitiateBankTransfer = async () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    if (!activePlan) return;

    try {
      setIsGeneratingAccount(true);
      setPollingError(null);
      setFallbackCheckoutUrl(null);

      const res = await appApi<{
        success: boolean;
        bankName?: string;
        accountNumber?: string;
        accountName?: string;
        amount: number;
        currency: string;
        txRef: string;
        expiresAt: string;
        expiresInSeconds: number;
        error?: string;
        fallbackCheckoutUrl?: string;
      }>('/payments/create-virtual-account', {
        method: 'POST',
        body: { plan_code: activePlan.code },
      });

      if (res.success && res.accountNumber && res.bankName) {
        setVirtualAccount(res as any);
        setTimeLeftSeconds(res.expiresInSeconds || 3600);
        setIsTransferModalOpen(true);
      } else {
        setVirtualAccount(null);
        if (res.fallbackCheckoutUrl) {
          setFallbackCheckoutUrl(res.fallbackCheckoutUrl);
        }
        setPollingError(res.error || 'Dynamic virtual account generation is temporarily unavailable.');
        setIsTransferModalOpen(true);
      }
    } catch (err: any) {
      setPollingError(err?.message || 'Failed to generate bank transfer details. Please retry.');
      setIsTransferModalOpen(true);
    } finally {
      setIsGeneratingAccount(false);
    }
  };

  // Manual Check Transfer Status ("I've Sent the Money")
  const handleCheckTransferStatus = async () => {
    if (!virtualAccount) return;

    try {
      setIsPollingStatus(true);
      setPollingError(null);

      const query = `/payments/check-transfer-status?tx_ref=${encodeURIComponent(virtualAccount.txRef)}`;
      const res = await appApi<{
        status: string;
        isPremium: boolean;
        user?: any;
        message?: string;
      }>(query);

      if (res.isPremium || res.status === 'successful') {
        if (res.user) setUser(res.user);
        handleTransferSuccess();
      } else {
        setPollingError(
          res.message || 'Payment not yet confirmed by the inter-bank network. Please allow 30–60 seconds for clearance.'
        );
      }
    } catch (err: any) {
      setPollingError(err?.message || 'Verification failed. Retrying automatically.');
    } finally {
      setIsPollingStatus(false);
    }
  };

  // Flutterwave server-side hosted checkout for Card / USSD / Bank Transfer
  const handleCardCheckout = async () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    if (!activePlan) return;

    setLoadingHosted(true);
    try {
      const res = await appApi<{
        success: boolean;
        checkoutUrl: string;
        txRef: string;
      }>('/payments/create-hosted-checkout', {
        method: 'POST',
        body: { plan_code: activePlan.code },
      });

      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        alert('Could not initialize Flutterwave checkout gateway. Please try again.');
      }
    } catch (e: any) {
      alert(`Checkout initialization: ${e?.message || 'Failed to connect to Flutterwave'}`);
    } finally {
      setLoadingHosted(false);
    }
  };

  // Expiry date calculation & reminder banners
  const expiryDate = user?.premium_expires_at ? new Date(user.premium_expires_at) : null;
  const now = Date.now();
  const msRemaining = expiryDate ? expiryDate.getTime() - now : 0;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const isExpiringSoon = isPremium && daysRemaining <= 7 && daysRemaining > 0;
  const isExpired = user?.is_premium && msRemaining <= 0;

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 p-4 sm:p-8 space-y-8 max-w-5xl mx-auto pb-32">
      {/* SUCCESS BANNER */}
      <AnimatePresence>
        {successNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-5 rounded-3xl bg-emerald-950/60 border border-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.2)] flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Payment Confirmed — Premium Active!</h3>
                <p className="text-xs text-slate-300">
                  Your 30-day access has been stacked onto your account. Enjoy full offline downloads.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessNotice(false)}
              className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXPIRY REMINDER BANNERS */}
      {isExpiringSoon && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-200">
            <Clock size={16} className="text-amber-400 shrink-0" />
            <span>
              Your Premium pass expires in <strong>{daysRemaining} day{daysRemaining === 1 ? '' : 's'}</strong>. Renew today to keep your offline library active!
            </span>
          </div>
          <button
            type="button"
            onClick={handleInitiateBankTransfer}
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 cursor-pointer shrink-0"
          >
            Renew Now
          </button>
        </div>
      )}

      {isExpired && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-rose-200">
            <Lock size={16} className="text-rose-400 shrink-0" />
            <span>
              Your Premium pass has expired. Your downloaded files are preserved and safely locked. Tap Renew to unlock immediately.
            </span>
          </div>
          <button
            type="button"
            onClick={handleInitiateBankTransfer}
            className="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-400 cursor-pointer shrink-0"
          >
            Renew Pass
          </button>
        </div>
      )}

      {/* HERO SECTION */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-widest shadow-sm">
          <Sparkles size={14} className="text-emerald-400" />
          <span>Nooraya Sanctuary Membership</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white tracking-tight">
          Deepen Your Spiritual Focus
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
          One simple monthly pass. Full offline audio downloads, all 7+ video soundscapes, and undisturbed Quranic reflection.
        </p>
      </div>

      {/* MEMBERSHIP STATUS CARD */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Current Account Status
          </span>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                isPremium ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-slate-600'
              }`}
            />
            <span className="text-lg font-bold text-white">
              {isPremium ? 'Active Sanctuary Member' : 'Free Tier Account'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isPremium && expiryDate ? (
              <>
                Valid until <strong className="text-slate-200">{expiryDate.toLocaleDateString()}</strong> ({daysRemaining} days remaining).
              </>
            ) : (
              'Upgrade to unlock unlimited offline surah audio downloads and high-bitrate streaming.'
            )}
          </p>
        </div>

        {isPremium && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleInitiateBankTransfer}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Extend / Stack 30 Days</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* PLAN SELECTION & PRICING (READ DYNAMICALLY FROM SUPABASE) */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white font-serif flex items-center gap-2">
          <span>Choose Your Sanctuary Pass</span>
        </h2>

        {plansLoading ? (
          <div className="h-44 rounded-3xl bg-slate-900/50 animate-pulse border border-slate-800" />
        ) : activePlan ? (
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-[#0A1224] border-2 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.12)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                {activePlan.duration_days} Days Full Access
              </div>
              <h3 className="text-2xl font-serif font-bold text-white">{activePlan.name_en}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Download any surah from any sheikh for seamless offline listening with zero internet. Includes all
                panoramic Medina & nature video soundscapes.
              </p>
              <div className="text-[11px] text-emerald-400 font-medium pt-1">
                ✓ Stacking duration: renewing adds 30 full days to your existing date.
              </div>
            </div>

            <div className="text-center md:text-right shrink-0 space-y-3">
              <div>
                <span className="text-3xl sm:text-4xl font-serif font-bold text-emerald-300">
                  {formatPlanPrice(activePlan.amount, activePlan.currency)}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">30 days per payment</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleInitiateBankTransfer}
                  disabled={isGeneratingAccount}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isGeneratingAccount ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Opening Transfer...</span>
                    </>
                  ) : (
                    <>
                      <Building2 size={14} />
                      <span>Pay with Bank Transfer</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCardCheckout}
                  className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard size={14} />
                  <span>Card / USSD</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* BENEFIT HIGHLIGHTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map((f, idx) => (
          <div key={idx} className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <f.icon size={18} />
            </div>
            <h4 className="text-sm font-bold text-white">{f.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* MANUAL RENEWAL GUARANTEE */}
      <div className="p-6 rounded-3xl bg-[#090E1C] border border-slate-800 text-center space-y-2">
        <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span>Manual Renewal Guarantee (Zero Auto-Debits)</span>
        </h3>
        <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
          We will <strong>never</strong> silently charge your card or account. Every subscription pass is manually
          initiated by you. If your pass expires, your downloaded files remain safely stored on your device and
          immediately unlock the moment you renew.
        </p>
      </div>

      {/* USER PAYMENT HISTORY & RECEIPTS */}
      {user && (
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white font-serif flex items-center gap-2">
              <Receipt size={18} className="text-emerald-400" />
              <span>Payment History & Receipts</span>
            </h2>
            <button
              type="button"
              onClick={loadUserPayments}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              Refresh History
            </button>
          </div>

          {paymentsLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading your transaction receipts...</div>
          ) : payments.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900/30 border border-slate-800/60 text-center text-xs text-slate-500">
              No payments recorded yet. Upgrade above to receive your first official receipt.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-800/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#050811] border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4 text-slate-300">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">Monthly Pass</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-300">
                        {formatPlanPrice(p.amount, p.currency)}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-400">
                        {p.method.replace('_', ' ')}
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
                        <button
                          type="button"
                          onClick={() => setReceiptPayment(p)}
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold cursor-pointer"
                        >
                          <FileText size={12} />
                          <span>View Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DYNAMIC VIRTUAL ACCOUNT MODAL */}
      <AnimatePresence>
        {isTransferModalOpen && virtualAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0B101E] border border-emerald-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 size={16} className="text-emerald-400" />
                  Bank Transfer Details
                </h3>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {virtualAccount ? (
                <>
                  {/* Countdown Bar */}
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Account Expires In:</span>
                    <span className="font-mono font-bold text-amber-300 flex items-center gap-1">
                      <Clock size={12} />
                      {formatCountdown(timeLeftSeconds)}
                    </span>
                  </div>

                  {/* Account Box */}
                  <div className="p-4 rounded-2xl bg-[#060913] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Account Number
                        </span>
                        <span className="text-2xl font-mono font-bold text-emerald-400 tracking-wider">
                          {virtualAccount.accountNumber}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(virtualAccount.accountNumber, 'modal_acc')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        {copiedField === 'modal_acc' ? (
                          <>
                            <Check size={13} />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Bank</span>
                        <strong className="text-white">{virtualAccount.bankName}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Amount to Send</span>
                        <strong className="text-emerald-300 font-serif text-sm">
                          {formatPlanPrice(virtualAccount.amount, virtualAccount.currency)}
                        </strong>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1">
                      Account Name: <span className="text-slate-300">{virtualAccount.accountName}</span>
                    </div>
                  </div>

                  {pollingError && (
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs text-center">
                      {pollingError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCheckTransferStatus}
                    disabled={isPollingStatus}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isPollingStatus ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Verifying Transfer with Bank...</span>
                      </>
                    ) : (
                      <>
                        <span>I Have Sent the Money</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    Transfers typically clear in 30–60 seconds. This screen will automatically update as soon as the bank
                    confirms receipt.
                  </p>
                </>
              ) : (
                <div className="space-y-4 py-2 text-center">
                  <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                    <p className="text-xs text-amber-200 leading-relaxed">
                      Direct virtual transfer account generation is currently provisioning on Flutterwave. You can pay instantly using Bank Transfer, Card, or USSD via Flutterwave secure checkout:
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCardCheckout}
                    disabled={loadingHosted}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loadingHosted ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Redirecting to Checkout...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} />
                        <span>Pay via Flutterwave Multi-Channel Checkout</span>
                        <ExternalLink size={14} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OFFICIAL RECEIPT MODAL */}
      <AnimatePresence>
        {receiptPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-slate-950">Nooraya Quranic Sanctuary</h3>
                  <span className="text-[10px] text-slate-500">Official Payment Receipt</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptPayment(null)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Reference:</span>
                  <span className="font-mono font-bold text-slate-900">{receiptPayment.tx_ref}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Date:</span>
                  <span className="font-semibold">{new Date(receiptPayment.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Email:</span>
                  <span className="font-semibold">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sanctuary Plan:</span>
                  <span className="font-semibold">30-Day Monthly Access Pass</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Channel:</span>
                  <span className="font-semibold capitalize">{receiptPayment.method.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t text-sm">
                  <span className="font-bold text-slate-950">Amount Paid:</span>
                  <span className="font-serif font-bold text-emerald-700 text-lg">
                    {formatPlanPrice(receiptPayment.amount, receiptPayment.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="font-bold uppercase text-emerald-600">{receiptPayment.status}</span>
                </div>
              </div>

              <div className="pt-3 border-t flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptPayment(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
