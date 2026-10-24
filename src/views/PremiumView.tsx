import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { appApi } from '../lib/api';

interface PlanConfig {
  id: 'monthly' | 'yearly';
  name: string;
  tagline: string;
  amountNGN: number;
  amountUSD: number;
  period: string;
  badge?: string;
  savings?: string;
}

const PLANS: PlanConfig[] = [
  {
    id: 'monthly',
    name: 'Monthly Focus',
    tagline: 'Flexible spiritual companion with full offline audio access',
    amountNGN: 2500,
    amountUSD: 3.99,
    period: 'per month',
  },
  {
    id: 'yearly',
    name: 'Annual Sanctuary',
    tagline: 'Deep year-long commitment with uninterrupted offline downloads',
    amountNGN: 24000,
    amountUSD: 34.99,
    period: 'per year',
    badge: 'Best Value',
    savings: 'Save 20%',
  },
];

const FEATURES = [
  {
    icon: WifiOff,
    title: 'Offline Surah Audio Downloads',
    desc: 'Download any surah from any reciter and listen without internet.',
  },
  {
    icon: Film,
    title: '6+ Atmospheric Video Soundscapes',
    desc: 'Immersive Medina night prayer, rain dua, ocean calm & cosmos visuals.',
  },
  {
    icon: Headphones,
    title: 'Studio High-Bitrate Recitation',
    desc: 'Uncompressed audio across 30+ classical and contemporary sheikhs.',
  },
  {
    icon: ShieldCheck,
    title: 'Pure Spiritual Sanctuary',
    desc: 'Zero distracting clutter, ad-free forever, designed for sincere focus.',
  },
];

export function PremiumView() {
  const { user, isPremium, refreshUser, setUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
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
  } | null>(null);
  const [isGeneratingAccount, setIsGeneratingAccount] = useState(false);
  const [isPollingStatus, setIsPollingStatus] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600);
  const [successNotice, setSuccessNotice] = useState(false);

  const activePlan = PLANS.find(p => p.id === selectedPlan) || PLANS[1];

  // 60-Minute Countdown Timer for Virtual Account
  useEffect(() => {
    if (!isTransferModalOpen || !virtualAccount) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTransferModalOpen, virtualAccount]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const handleCopy = (text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Start Bank Transfer Flow
  const handleInitiateBankTransfer = async () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    try {
      setIsGeneratingAccount(true);
      setPollingError(null);
      const res = await appApi<{
        bankName: string;
        accountNumber: string;
        accountName: string;
        amount: number;
        currency: string;
        txRef: string;
        expiresAt: string;
      }>('/payments/create-virtual-account', {
        method: 'POST',
        body: { plan: selectedPlan },
      });

      setVirtualAccount(res);
      setTimeLeftSeconds(3600);
      setIsTransferModalOpen(true);
    } catch (err: any) {
      setPollingError(err?.message || 'Failed to generate virtual account details. Please try again.');
    } finally {
      setIsGeneratingAccount(false);
    }
  };

  // Check Transfer Status ("I've Sent the Money")
  const handleCheckTransferStatus = async (simulate = false) => {
    if (!virtualAccount) return;

    try {
      setIsPollingStatus(true);
      setPollingError(null);

      const query = `/payments/check-transfer-status?tx_ref=${encodeURIComponent(virtualAccount.txRef)}${
        simulate ? '&simulate=true' : ''
      }`;
      const res = await appApi<{
        status: string;
        isPremium: boolean;
        user?: any;
        message?: string;
      }>(query);

      if (res.isPremium) {
        if (res.user) setUser(res.user);
        await refreshUser();
        setSuccessNotice(true);
        setIsTransferModalOpen(false);
      } else {
        setPollingError(
          res.message || 'Payment not yet confirmed by the bank. Please allow 1-2 minutes for inter-bank clearance.'
        );
      }
    } catch (err: any) {
      setPollingError(err?.message || 'Verification failed. Please retry in a few moments.');
    } finally {
      setIsPollingStatus(false);
    }
  };

  // Flutterwave Card Standard Checkout Fallback
  const handleCardCheckout = () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    const flwKey =
      (import.meta as any).env.VITE_FLW_PUBLIC_KEY ||
      (import.meta as any).env.FLW_PUBLIC_KEY ||
      'FLWPUBK_TEST-SANDBOX';

    if (typeof window.FlutterwaveCheckout !== 'function') {
      alert('Flutterwave checkout script is loading. Please retry in a few seconds.');
      return;
    }

    const txRef = `qf-card-${Date.now()}-${user.id.slice(0, 8)}`;
    const amount = currency === 'NGN' ? activePlan.amountNGN : activePlan.amountUSD;

    window.FlutterwaveCheckout({
      public_key: flwKey,
      tx_ref: txRef,
      amount,
      currency,
      payment_options: 'card,ussd',
      customer: {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
      },
      customizations: {
        title: 'Quranify Focus Premium',
        description: `${activePlan.name} (${currency} ${amount})`,
        logo: `${window.location.origin}/icon.svg`,
      },
      callback: async (data: any) => {
        try {
          const transactionId = data.transaction_id || data.id;
          await appApi('/payments/verify-flutterwave', {
            method: 'POST',
            body: {
              transaction_id: transactionId,
              tx_ref: txRef,
              plan: selectedPlan,
            },
          });
          await refreshUser();
          setSuccessNotice(true);
        } catch (e: any) {
          alert(`Verification: ${e?.message || 'Payment completed but verification pending.'}`);
        }
      },
      onclose: () => {},
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#11382B] border border-[#1F8A6A]/30 text-[#D4AF37] text-xs font-semibold tracking-wide">
          <Sparkles size={14} />
          <span>Sacred Sanctuary Premium</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-[#F6F1E4] tracking-tight">
          Uncompromised Focus & Full Offline Recitations
        </h1>
        <p className="text-[#A8BFB3] text-base sm:text-lg max-w-2xl mx-auto">
          Save entire chapters from your favorite reciters for airplane mode, unlock all ambient soundscapes, and immerse in flawless sound quality.
        </p>
      </div>

      {/* Active Subscription Banner */}
      {isPremium && (
        <div className="p-6 rounded-3xl bg-[#0C2A20] border border-[#34C38F]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#34C38F]/20 text-[#34C38F] flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-[#F6F1E4]">
                Your Premium Membership is Active
              </h3>
              <p className="text-sm text-[#A8BFB3]">
                Full offline downloads and all soundscape presets are fully unlocked on this account.
              </p>
            </div>
          </div>
          <span className="px-4 py-2 rounded-xl bg-[#11382B] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold tracking-wide text-center">
            Active Sanctuary Member
          </span>
        </div>
      )}

      {/* Success Modal Toast */}
      {successNotice && (
        <div className="p-5 rounded-2xl bg-[#0C2A20] border border-[#34C38F] text-[#34C38F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} />
            <span className="font-semibold text-sm">
              Alhamdulillah! Your Premium subscription has been successfully activated.
            </span>
          </div>
          <button
            onClick={() => setSuccessNotice(false)}
            className="text-xs px-3 py-1 rounded-lg bg-[#11382B] hover:bg-[#176B53] text-[#F6F1E4]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map(plan => {
          const isSelected = selectedPlan === plan.id;
          const displayPrice =
            currency === 'NGN' ? `₦${plan.amountNGN.toLocaleString()}` : `$${plan.amountUSD}`;

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`medina-card p-7 sm:p-8 cursor-pointer relative flex flex-col justify-between transition-all duration-300 ${
                isSelected
                  ? 'border-[#1F8A6A] bg-[#0C2A20] shadow-[0_0_30px_rgba(31,138,106,0.25)] ring-1 ring-[#1F8A6A]'
                  : 'bg-[#0C2A20]/60 border-white/8 hover:border-white/15'
              }`}
            >
              {plan.badge && (
                <div className="absolute top-5 right-5 px-3 py-1 rounded-full bg-[#D4AF37] text-[#06150F] text-xs font-bold tracking-wide flex items-center gap-1 shadow-md">
                  <Sparkles size={12} />
                  <span>{plan.badge}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-bold text-[#F6F1E4]">{plan.name}</h3>
                  <p className="text-sm text-[#A8BFB3]">{plan.tagline}</p>
                </div>

                <div className="pt-2 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-serif font-bold text-[#F6F1E4]">
                    {displayPrice}
                  </span>
                  <span className="text-sm text-[#A8BFB3]">{plan.period}</span>
                  {plan.savings && (
                    <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-md bg-[#1F8A6A]/20 text-[#34C38F] border border-[#1F8A6A]/30">
                      {plan.savings}
                    </span>
                  )}
                </div>

                <div className="h-px bg-white/8 my-6" />

                <ul className="space-y-3">
                  {FEATURES.map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#F6F1E4]">
                      <div className="w-5 h-5 rounded-full bg-[#1F8A6A]/20 text-[#34C38F] flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <div>
                        <span className="font-semibold">{feat.title}</span>
                        <p className="text-xs text-[#A8BFB3] mt-0.5">{feat.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8 mt-auto">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedPlan(plan.id);
                    if (paymentMethod === 'transfer') {
                      void handleInitiateBankTransfer();
                    } else {
                      handleCardCheckout();
                    }
                  }}
                  className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-base transition-all ${
                    isSelected
                      ? 'medina-btn-primary shadow-lg shadow-[#1F8A6A]/30'
                      : 'bg-[#11382B] hover:bg-[#176B53] text-[#F6F1E4]'
                  }`}
                >
                  <span>Select {plan.name}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Selection Section */}
      <div className="medina-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-[#F6F1E4]">Payment Method</h3>
            <p className="text-sm text-[#A8BFB3] mt-1">
              Select your preferred payment method. Direct bank transfer provides instant Nigerian bank account generation.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#11382B] p-1.5 rounded-2xl border border-white/8">
            <button
              onClick={() => setPaymentMethod('transfer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                paymentMethod === 'transfer'
                  ? 'bg-[#1F8A6A] text-white shadow-md'
                  : 'text-[#A8BFB3] hover:text-[#F6F1E4]'
              }`}
            >
              <Building2 size={16} />
              <span>Bank Transfer (NGN)</span>
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                paymentMethod === 'card'
                  ? 'bg-[#1F8A6A] text-white shadow-md'
                  : 'text-[#A8BFB3] hover:text-[#F6F1E4]'
              }`}
            >
              <CreditCard size={16} />
              <span>Card / International</span>
            </button>
          </div>
        </div>

        <div className="pt-2">
          {paymentMethod === 'transfer' ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-[#06150F]/70 border border-white/8 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#F6F1E4] text-sm">Direct Virtual Bank Transfer</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#34C38F]/20 text-[#34C38F]">
                    Fast & Zero Card Needed
                  </span>
                </div>
                <p className="text-xs text-[#A8BFB3]">
                  A dedicated Nigerian virtual account is generated exclusively for your payment. Transfer via your bank app to activate immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={handleInitiateBankTransfer}
                disabled={isGeneratingAccount}
                className="medina-btn-primary px-6 shrink-0"
              >
                {isGeneratingAccount ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Generating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Pay with Bank Transfer (₦{activePlan.amountNGN.toLocaleString()})</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-[#06150F]/70 border border-white/8 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#F6F1E4] text-sm">Debit / Credit Card Checkout</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1F8A6A]/20 text-[#A8BFB3]">
                    Flutterwave v3 Secure
                  </span>
                </div>
                <p className="text-xs text-[#A8BFB3]">
                  Supports Visa, Mastercard, Verve, and international bank cards securely encrypted.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCardCheckout}
                className="medina-btn-primary px-6 shrink-0"
              >
                <span>Pay with Card ({currency === 'NGN' ? `₦${activePlan.amountNGN.toLocaleString()}` : `$${activePlan.amountUSD}`})</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Bank Transfer Modal */}
      <AnimatePresence>
        {isTransferModalOpen && virtualAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#0C2A20] border border-white/12 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1F8A6A]/20 text-[#34C38F] flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#F6F1E4]">
                      Pay with Bank Transfer
                    </h3>
                    <p className="text-xs text-[#A8BFB3]">
                      Transfer the exact amount to activate your subscription
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#11382B] text-[#D4AF37] text-xs font-mono font-bold">
                  <Clock size={13} />
                  <span>{formatCountdown(timeLeftSeconds)}</span>
                </div>
              </div>

              {/* Amount Display */}
              <div className="text-center py-3 bg-[#06150F]/80 rounded-2xl border border-white/8 space-y-1">
                <span className="text-xs text-[#A8BFB3] uppercase tracking-wider font-semibold">
                  Exact Amount to Transfer
                </span>
                <div className="text-3xl sm:text-4xl font-serif font-bold text-[#F6F1E4] tracking-tight">
                  ₦{virtualAccount.amount.toLocaleString()}
                </div>
                <span className="text-[11px] text-[#D4AF37] font-medium">
                  Do not add extra kobo or fees.
                </span>
              </div>

              {/* Account Details Box */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#11382B]/60 border border-white/8 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[#A8BFB3]">Bank Name</span>
                    <div className="text-base font-bold text-[#F6F1E4]">{virtualAccount.bankName}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(virtualAccount.bankName, 'bank')}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#A8BFB3] hover:text-white transition-colors"
                  >
                    {copiedField === 'bank' ? <Check size={16} className="text-[#34C38F]" /> : <Copy size={16} />}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[#11382B]/60 border border-white/8 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[#A8BFB3]">Account Number</span>
                    <div className="text-xl font-mono font-bold text-[#F6F1E4] tracking-wider">
                      {virtualAccount.accountNumber}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(virtualAccount.accountNumber, 'account')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F8A6A] hover:bg-[#27A37E] text-white text-xs font-bold transition-all shadow-md"
                  >
                    {copiedField === 'account' ? (
                      <>
                        <Check size={14} />
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

                <div className="p-4 rounded-2xl bg-[#11382B]/60 border border-white/8 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[#A8BFB3]">Beneficiary Account Name</span>
                    <div className="text-sm font-semibold text-[#F6F1E4]">{virtualAccount.accountName}</div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-xs text-[#A8BFB3] space-y-1">
                <p>• Open your mobile banking app or internet banking.</p>
                <p>• Make a transfer of <strong>₦{virtualAccount.amount.toLocaleString()}</strong> to the account above.</p>
                <p>• Once completed, tap the button below to confirm.</p>
              </div>

              {/* Error Notice */}
              {pollingError && (
                <div className="p-3.5 rounded-xl bg-[#E5675B]/15 border border-[#E5675B]/30 text-[#E5675B] text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{pollingError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleCheckTransferStatus(false)}
                  disabled={isPollingStatus}
                  className="flex-1 medina-btn-primary py-3.5"
                >
                  {isPollingStatus ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Checking Bank Confirmation...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>I've Sent the Money</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-5 py-3.5 rounded-2xl bg-[#11382B] hover:bg-[#176B53] text-[#A8BFB3] hover:text-[#F6F1E4] text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>

              {/* Test mode button when testing in sandbox */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => handleCheckTransferStatus(true)}
                  className="text-[11px] text-[#A8BFB3]/60 hover:text-[#D4AF37] underline transition-colors"
                >
                  [Sandbox / Demo] Simulate Instant Transfer Confirmation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
