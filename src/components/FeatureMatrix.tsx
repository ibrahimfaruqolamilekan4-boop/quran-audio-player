import React from 'react';
import { Check, X, Sparkles, Shield, Star } from 'lucide-react';

export interface MatrixRow {
  name: string;
  free: string | boolean;
  premium: string | boolean;
  highlight?: boolean;
}

export interface MatrixCategory {
  title: string;
  rows: MatrixRow[];
}

export const FEATURE_MATRIX_DATA: MatrixCategory[] = [
  {
    title: 'Core Listening',
    rows: [
      { name: 'Full Quran (all 114 surahs)', free: true, premium: true },
      { name: 'Basic reciters (core popular ones)', free: true, premium: true },
      { name: 'Ambient soundscapes', free: '3–4 tracks', premium: 'All tracks', highlight: true },
      { name: 'Video backgrounds', free: 'Low quality / basic', premium: 'Full HD / cinematic', highlight: true },
    ],
  },
  {
    title: 'Playback Power',
    rows: [
      { name: 'Offline downloads', free: '3 surahs max', premium: 'Unlimited', highlight: true },
      { name: 'Sleep timer', free: false, premium: true, highlight: true },
      { name: 'Playback speed control', free: true, premium: true },
      { name: 'Per-ayah mode', free: 'Limited', premium: 'Full' },
    ],
  },
  {
    title: 'Spiritual Tools',
    rows: [
      { name: 'Prayer times & schedule', free: true, premium: true },
      { name: 'Qibla compass', free: true, premium: true },
      { name: 'Adhan notifications', free: 'Basic adhan', premium: 'Advanced (custom voices + offsets)', highlight: true },
      { name: 'Daily Azkar & supplications', free: true, premium: true },
    ],
  },
  {
    title: 'Experience & Cloud',
    rows: [
      { name: 'Sanctuary experience', free: 'Light / non-intrusive', premium: '100% Ad-free' },
      { name: 'Custom reciter uploads', free: false, premium: true, highlight: true },
      { name: 'Priority support & early features', free: false, premium: true },
    ],
  },
];

interface FeatureMatrixProps {
  className?: string;
  onUpgradeClick?: () => void;
  isPremium?: boolean;
}

export function FeatureMatrix({ className = '', onUpgradeClick, isPremium = false }: FeatureMatrixProps) {
  const renderValue = (val: string | boolean, isPremCol: boolean) => {
    if (val === true) {
      return (
        <span className={`inline-flex items-center gap-1 font-semibold text-xs ${isPremCol ? 'text-amber-400' : 'text-teal-400'}`}>
          <Check size={16} strokeWidth={2.5} className="shrink-0" />
          <span className="hidden sm:inline">Included</span>
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center gap-1 font-medium text-xs text-slate-500">
          <X size={15} strokeWidth={2} className="shrink-0" />
          <span className="hidden sm:inline">Unavailable</span>
        </span>
      );
    }
    return (
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-md inline-block ${
          isPremCol
            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            : 'bg-white/5 text-slate-300 border border-white/10'
        }`}
      >
        {val}
      </span>
    );
  };

  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-white/10 bg-[#06150F]/90 backdrop-blur-md shadow-2xl ${className}`}>
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 p-4 sm:p-5 border-b border-white/10 bg-white/[0.02] text-xs font-bold uppercase tracking-wider">
        <div className="col-span-6 sm:col-span-6 text-slate-400 flex items-center gap-1.5">
          <span>Feature</span>
        </div>
        <div className="col-span-3 sm:col-span-3 text-center text-slate-300">
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Free</span>
        </div>
        <div className="col-span-3 sm:col-span-3 text-center text-amber-300 flex items-center justify-center gap-1">
          <Sparkles size={14} className="text-amber-400" />
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 font-bold text-amber-300">
            Premium (₦500)
          </span>
        </div>
      </div>

      {/* Categories & Rows */}
      <div className="divide-y divide-white/[0.06]">
        {FEATURE_MATRIX_DATA.map((category) => (
          <div key={category.title} className="py-2">
            <div className="px-4 sm:px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-teal-400/90 bg-teal-950/30 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span>{category.title}</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {category.rows.map((row) => (
                <div
                  key={row.name}
                  className={`grid grid-cols-12 gap-2 px-4 sm:px-5 py-3 items-center text-xs transition-colors hover:bg-white/[0.02] ${
                    row.highlight ? 'bg-amber-500/[0.02]' : ''
                  }`}
                >
                  <div className="col-span-6 sm:col-span-6 text-slate-200 font-medium flex items-center gap-2">
                    {row.highlight && <Star size={12} className="text-amber-400 shrink-0 fill-amber-400/30" />}
                    <span>{row.name}</span>
                  </div>
                  <div className="col-span-3 sm:col-span-3 text-center flex items-center justify-center">
                    {renderValue(row.free, false)}
                  </div>
                  <div className="col-span-3 sm:col-span-3 text-center flex items-center justify-center">
                    {renderValue(row.premium, true)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade CTA footer if not premium */}
      {!isPremium && onUpgradeClick && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-amber-500/10 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <p className="text-sm font-semibold text-white flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles size={16} className="text-amber-400" />
              <span>Upgrade to Premium for only ₦500 / month</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Instant bank transfer & card activation · Cancel anytime
            </p>
          </div>
          <button
            type="button"
            onClick={onUpgradeClick}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer shrink-0"
          >
            Upgrade for ₦500
          </button>
        </div>
      )}
    </div>
  );
}
