import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Sparkles, Shield, WifiOff, Film, Headphones, Zap, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { appApi, type AppUser } from '../lib/api';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPlan?: 'monthly' | 'yearly' | 'lifetime';
}

interface PlanDetails {
  id: 'monthly' | 'yearly' | 'lifetime';
  name: string;
  tagline: string;
  amountNGN: number;
  amountUSD: number;
  badge?: string;
  savings?: string;
}

const PLANS: PlanDetails[] = [
  {
    id: 'monthly',
    name: 'Monthly Focus',
    tagline: 'Flexible spiritual companion',
    amountNGN: 1500,
    amountUSD: 2.99,
  },
  {
    id: 'yearly',
    name: 'Annual Sanctuary',
    tagline: 'Best value for daily consistency',
    amountNGN: 12000,
    amountUSD: 24.99,
    badge: 'Most Popular',
    savings: 'Save 33%',
  },
  {
    id: 'lifetime',
    name: 'Lifetime Heritage',
    tagline: 'One-time investment forever',
    amountNGN: 30000,
    amountUSD: 59.99,
    badge: 'Ultimate Value',
    savings: 'Pay Once Forever',
  },
];

const BENEFITS = [
  {
    icon: WifiOff,
    title: 'Offline Surah Audio Downloads',
    desc: 'Listen seamlessly anywhere with zero internet or airplane mode.',
  },
  {
    icon: Film,
    title: 'All 7+ HD Ambient Video Backgrounds',
    desc: 'Unlock Serene Clouds, Ocean Sunset, and Mountain Mist loops.',
  },
  {
    icon: Headphones,
    title: 'High-Bitrate Studio Audio',
    desc: 'Crystal-clear recitation streams across all 30+ sheikhs.',
  },
  {
    icon: Shield,
    title: 'Distraction-Free Sanctuary',
    desc: '100% pure focus environment with zero promotional clutter.',
  },
];

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: any) => void;
  }
}

export function SubscriptionModal({ isOpen, onClose, onSuccess, initialPlan = 'yearly' }: SubscriptionModalProps) {
  const { user, refreshUser, setUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'lifetime'>(initialPlan);
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPlan = PLANS.find(p => p.id === selectedPlan) || PLANS[1];
  const price = currency === 'NGN' ? `₦${currentPlan.amountNGN.toLocaleString()}` : `$${currentPlan.amountUSD}`;
  const amount = currency === 'NGN' ? currentPlan.amountNGN : currentPlan.amountUSD;

  const handleSubscribe = () => {
    setErrorMsg(null);

    if (!user) {
      setErrorMsg('Please log in or create an account first to activate Premium on your profile.');
      return;
    }

    const flwKey = import.meta.env.VITE_FLW_PUBLIC_KEY || 'FLWPUBK_TEST-5cb160cf25608b4923e20d20d43f07a4-X';
    const txRef = `nooraya-${selectedPlan}-${user.uid}-${Date.now()}`;

    // Verify Flutterwave v3 SDK script is loaded
    if (typeof window.FlutterwaveCheckout !== 'function') {
      setErrorMsg('Payment gateway script is loading. Please check your internet connection and try again in a moment.');
      return;
    }

    setProcessing(true);

    window.FlutterwaveCheckout({
      public_key: flwKey,
      tx_ref: txRef,
      amount,
      currency,
      payment_options: 'card, banktransfer, ussd',
      customer: {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
      },
      customizations: {
        title: 'Nooraya Quranic Sanctuary',
        description: `Upgrade to ${currentPlan.name} (${currency})`,
        logo: `${window.location.origin}/icon.svg`,
      },
      callback: async (data: any) => {
        try {
          const txId = data.transaction_id || data.id || data.flw_ref;
          const verifyResult = await appApi<{ ok: boolean; user: AppUser; message: string }>('/payments/verify-flutterwave', {
            method: 'POST',
            body: {
              transaction_id: txId,
              tx_ref: txRef,
              plan: selectedPlan,
            },
          });

          if (verifyResult?.user) {
            setUser(verifyResult.user);
          } else {
            await refreshUser();
          }

          setProcessing(false);
          onSuccess?.();
          onClose();
        } catch (err: any) {
          console.error('Verification error:', err);
          setErrorMsg(err?.message || 'Payment received, but verification encountered a delay. Your account will update shortly.');
          setProcessing(false);
        }
      },
      onclose: () => {
        setProcessing(false);
      },
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-[#0F172A]/95 border border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(20,184,166,0.15)] text-white my-8"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-medium uppercase tracking-widest mb-3">
              <Sparkles size={13} className="text-teal-400" />
              <span>Nooraya Sanctuary Premium</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif tracking-wide text-white">
              Deepen Your Spiritual Connection
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              Unlock offline Quran audio downloads, all 7+ ambient video soundscapes, and undisturbed focus.
            </p>
          </div>

          {/* Currency Toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex p-1 rounded-xl bg-slate-900/80 border border-slate-800">
              <button
                type="button"
                onClick={() => setCurrency('NGN')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currency === 'NGN' ? 'bg-teal-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                NGN (₦)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currency === 'USD' ? 'bg-teal-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>

          {/* Plan Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const planPrice = currency === 'NGN' ? `₦${plan.amountNGN.toLocaleString()}` : `$${plan.amountUSD}`;

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-b from-teal-500/20 to-teal-900/20 border-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-md bg-teal-500 text-black text-[10px] font-bold uppercase tracking-wider shadow">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-sm text-white">{plan.name}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{plan.tagline}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60">
                    <div className="text-xl font-bold font-serif text-teal-300">{planPrice}</div>
                    {plan.savings && (
                      <span className="text-[10px] font-medium text-emerald-400 block mt-0.5">
                        {plan.savings}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 mb-6">
            {BENEFITS.map((b, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 shrink-0 mt-0.5">
                  <b.icon size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">{b.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* Action CTA */}
          <button
            onClick={handleSubscribe}
            disabled={processing}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(20,184,166,0.3)] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Opening Flutterwave Secure Checkout...</span>
              </>
            ) : (
              <>
                <span>Upgrade Now — {price}</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500 text-center mt-3 flex items-center justify-center gap-1.5">
            <Shield size={12} className="text-teal-500/70" />
            <span>Secured with 256-bit encryption by Flutterwave v3</span>
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
