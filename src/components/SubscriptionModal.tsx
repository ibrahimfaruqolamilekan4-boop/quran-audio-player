import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Check,
  Sparkles,
  Shield,
  WifiOff,
  Film,
  Headphones,
  Copy,
  Clock,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { appApi, type AppUser } from '../lib/api';
import {
  fetchActivePlans,
  subscribeToPlans,
  subscribeToUserPayments,
  formatPlanPrice,
  type PlanRow,
} from '../lib/supabase';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPlan?: string;
}

const DEFAULT_BENEFITS = [
  {
    icon: WifiOff,
    title: 'Offline Surah Audio Downloads',
    desc: 'Listen anywhere with zero mobile data, airplane mode, or spotty networks.',
  },
  {
    icon: Film,
    title: 'All HD Ambient Video Backgrounds',
    desc: 'Unlock Serene Clouds, Medina Night, Ocean Calm, and Mountain Mist loops.',
  },
  {
    icon: Headphones,
    title: 'Studio High-Bitrate Audio',
    desc: 'Crystal-clear recitation streams across all 30+ classical & modern sheikhs.',
  },
  {
    icon: Shield,
    title: 'Distraction-Free Pure Sanctuary',
    desc: '100% pure focus environment with zero ads, clutter, or promotional noise.',
  },
];

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: any) => void;
  }
}

export function SubscriptionModal({
  isOpen,
  onClose,
  onSuccess,
  initialPlan = 'premium_monthly',
}: SubscriptionModalProps) {
  const { user, refreshUser, setUser } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>(initialPlan);
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'card'>('transfer');

  // Virtual Account state
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
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [fallbackCheckoutUrl, setFallbackCheckoutUrl] = useState<string | null>(null);
  const [loadingHosted, setLoadingHosted] = useState(false);

  // Status check & verification
  const [verifying, setVerifying] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3600);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const pollingRef = useRef<any>(null);

  // 1. Load active plans from database
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  const activePlan = plans.find((p) => p.code === selectedPlanCode) || plans[0];

  // 2. Fetch Virtual Account instantly on plan selection
  const fetchVirtualAccount = async (planCode: string) => {
    if (!user) return;
    setLoadingAccount(true);
    setAccountError(null);
    setVerificationNotice(null);
    setFallbackCheckoutUrl(null);

    try {
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
        body: { plan_code: planCode },
      });

      if (res.success && res.accountNumber && res.bankName) {
        setVirtualAccount(res as any);
        setCountdown(res.expiresInSeconds || 3600);
      } else {
        setVirtualAccount(null);
        if (res.fallbackCheckoutUrl) {
          setFallbackCheckoutUrl(res.fallbackCheckoutUrl);
        }
        setAccountError(res.error || 'Dynamic virtual account generation is temporarily unavailable.');
      }
    } catch (err: any) {
      setAccountError(err?.message || 'Failed to fetch bank transfer details.');
    } finally {
      setLoadingAccount(false);
    }
  };

  // Trigger instant account generation when modal opens or plan changes
  useEffect(() => {
    if (isOpen && user && selectedPlanCode && paymentMethod === 'transfer') {
      fetchVirtualAccount(selectedPlanCode);
    }
  }, [isOpen, user, selectedPlanCode, paymentMethod]);

  // 3. Countdown timer
  useEffect(() => {
    if (!virtualAccount || !isOpen) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [virtualAccount, isOpen]);

  // 4. Realtime & Polling payment confirmation
  useEffect(() => {
    if (!isOpen || !virtualAccount || paymentSuccess) return;

    // Supabase Realtime listener
    const userId = user?.uid || (user as any)?.id;
    const unsubRealtime = subscribeToUserPayments(userId, (payload) => {
      if (
        payload.new?.tx_ref === virtualAccount.txRef &&
        (payload.new?.status === 'successful' || payload.new?.status === 'overpaid')
      ) {
        handleSuccessActivation();
      }
    });

    // Auto-polling every 5 seconds
    pollingRef.current = setInterval(async () => {
      try {
        const res = await appApi<{
          status: string;
          isPremium: boolean;
        }>(`/payments/check-transfer-status?tx_ref=${encodeURIComponent(virtualAccount.txRef)}`);

        if (res.isPremium || res.status === 'successful') {
          handleSuccessActivation();
        }
      } catch {}
    }, 5000);

    return () => {
      unsubRealtime();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen, virtualAccount, paymentSuccess]);

  const handleSuccessActivation = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPaymentSuccess(true);
    await refreshUser();
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 3000);
  };

  const handleCopy = (text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Manual "I've Sent the Money" click
  const handleCheckStatus = async () => {
    if (!virtualAccount) return;
    setVerifying(true);
    setVerificationNotice(null);

    try {
      const res = await appApi<{
        status: string;
        isPremium: boolean;
        message?: string;
      }>(`/payments/check-transfer-status?tx_ref=${encodeURIComponent(virtualAccount.txRef)}`);

      if (res.isPremium || res.status === 'successful') {
        handleSuccessActivation();
      } else {
        setVerificationNotice(
          res.message || 'Payment not yet cleared by the inter-bank switch. Please wait 30–60 seconds.'
        );
      }
    } catch (err: any) {
      setVerificationNotice(err?.message || 'Verification check timed out. Retrying automatically.');
    } finally {
      setVerifying(false);
    }
  };

  // Flutterwave server-side hosted checkout for cards/USSD/OPay
  const handleCardCheckout = async () => {
    if (!user) {
      setAccountError('Please sign in or create an account to activate Premium on your profile.');
      return;
    }
    if (!activePlan) return;

    setLoadingHosted(true);
    setAccountError(null);

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
        throw new Error('Unable to generate checkout link.');
      }
    } catch (err: any) {
      setAccountError(err?.message || 'Failed to initialize payment gateway. Please try again.');
    } finally {
      setLoadingHosted(false);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-[#0B101E] border border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-[0_0_60px_rgba(16,185,129,0.15)] text-white my-6"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Success Screen Overlay */}
          {paymentSuccess ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-2xl font-bold font-serif text-white">Payment Confirmed!</h2>
              <p className="text-slate-300 text-sm max-w-sm mx-auto">
                Welcome to <strong>Nooraya Premium</strong>. Your sanctuary is unlocked with 30 days of offline
                downloads and full ambient video soundscapes.
              </p>
              <div className="pt-2">
                <span className="text-xs text-emerald-400 font-mono">Redirecting to your sanctuary...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-2.5">
                  <Sparkles size={13} className="text-emerald-400" />
                  <span>Nooraya Quranic Sanctuary</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
                  Unlock Premium Offline Downloads
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Manual 30-day renewal. No unexpected automatic debits.
                </p>
              </div>

              {/* Plan Card (Dynamic from plans table) */}
              <div className="mb-4">
                {plansLoading ? (
                  <div className="h-16 rounded-2xl bg-slate-900/80 animate-pulse border border-slate-800" />
                ) : activePlan ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-emerald-950/30 border border-emerald-500/40 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{activePlan.name_en}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500 text-slate-950">
                          {activePlan.duration_days} Days Access
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Download any surah & listen with zero internet connection
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold font-serif text-emerald-300">
                        {formatPlanPrice(activePlan.amount, activePlan.currency)}
                      </div>
                      <span className="text-[10px] text-slate-400">per 30 days</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Payment Method Switcher */}
              <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'transfer'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Building2 size={14} />
                  <span>Bank Transfer (Instant)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Card / USSD / OPay</span>
                </button>
              </div>

              {/* Bank Transfer View */}
              {paymentMethod === 'transfer' && (
                <div className="space-y-3.5">
                  {loadingAccount ? (
                    <div className="py-10 text-center space-y-3">
                      <RefreshCw size={24} className="animate-spin text-emerald-400 mx-auto" />
                      <p className="text-xs text-slate-300 font-medium">
                        Requesting dedicated Flutterwave virtual account...
                      </p>
                    </div>
                  ) : accountError ? (
                    <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-center space-y-2">
                      <AlertCircle size={20} className="text-rose-400 mx-auto" />
                      <p className="text-xs text-rose-300">{accountError}</p>
                      <button
                        type="button"
                        onClick={() => fetchVirtualAccount(selectedPlanCode)}
                        className="px-4 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold cursor-pointer"
                      >
                        Retry Bank Transfer
                      </button>
                    </div>
                  ) : virtualAccount ? (
                    <div className="space-y-3">
                      {/* Virtual Account Box */}
                      <div className="p-4 rounded-2xl bg-[#060913] border border-slate-800 space-y-3">
                        {/* Countdown Header */}
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
                          <span className="text-slate-400">Transfer Account Expires In:</span>
                          <span className="font-mono font-bold text-amber-300 flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimer(countdown)}
                          </span>
                        </div>

                        {/* Account Number with Copy */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                              Account Number
                            </span>
                            <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400 tracking-wider">
                              {virtualAccount.accountNumber}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(virtualAccount.accountNumber, 'account')}
                            className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            {copiedField === 'account' ? (
                              <>
                                <Check size={14} className="text-emerald-400" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Bank Name & Amount */}
                        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Bank Name</span>
                            <strong className="text-white">{virtualAccount.bankName}</strong>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Exact Amount to Send</span>
                            <strong className="text-emerald-300 font-serif text-sm">
                              {formatPlanPrice(virtualAccount.amount, virtualAccount.currency)}
                            </strong>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 pt-1">
                          Beneficiary: <span className="text-slate-300">{virtualAccount.accountName}</span>
                        </div>
                      </div>

                      {/* Instructions */}
                      <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                        Open your bank app or dial your bank USSD code, transfer exactly{' '}
                        <strong className="text-white">
                          {formatPlanPrice(virtualAccount.amount, virtualAccount.currency)}
                        </strong>{' '}
                        to the account above. Your subscription unlocks automatically as soon as the transfer lands.
                      </p>

                      {verificationNotice && (
                        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs text-center">
                          {verificationNotice}
                        </div>
                      )}

                      {/* I've Paid CTA */}
                      <button
                        type="button"
                        onClick={handleCheckStatus}
                        disabled={verifying}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {verifying ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Confirming with Inter-Bank Network...</span>
                          </>
                        ) : (
                          <>
                            <span>I Have Sent the Money</span>
                            <ArrowRight size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  ) : fallbackCheckoutUrl ? (
                    <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-center space-y-3">
                      <p className="text-xs text-amber-200 leading-relaxed">
                        Direct virtual transfer account is currently provisioning on Flutterwave. You can complete your payment instantly with Bank Transfer, USSD, OPay, or Debit Card via Flutterwave checkout:
                      </p>
                      <button
                        type="button"
                        onClick={handleCardCheckout}
                        disabled={loadingHosted}
                        className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loadingHosted ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Connecting to Flutterwave...</span>
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
                  ) : null}
                </div>
              )}

              {/* Card / Standard Checkout View */}
              {paymentMethod === 'card' && (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-2xl bg-[#060913] border border-slate-800 space-y-2 text-center">
                    <CreditCard size={28} className="text-emerald-400 mx-auto" />
                    <h3 className="text-sm font-bold text-white">Flutterwave Multi-Channel Checkout</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Pay using your Nigerian Debit Card, USSD, OPay, or Bank Account via Flutterwave's secure hosted
                      gateway.
                    </p>
                  </div>

                  {activePlan && (
                    <button
                      type="button"
                      onClick={handleCardCheckout}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Pay {formatPlanPrice(activePlan.amount, activePlan.currency)} with Card / USSD</span>
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Features list */}
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-800/80 mt-4">
                {DEFAULT_BENEFITS.slice(0, 4).map((b, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                      <b.icon size={12} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-semibold text-slate-200">{b.title}</h4>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-500 text-center mt-4 flex items-center justify-center gap-1">
                <Shield size={11} className="text-emerald-400" />
                <span>256-bit encrypted Flutterwave v3 payment gateway</span>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
