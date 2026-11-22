import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  Smartphone,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Zap,
  BatteryCharging,
  Info,
} from 'lucide-react';

interface BatteryOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Manufacturer = 'xiaomi' | 'samsung' | 'huawei' | 'oppo' | 'vivo' | 'stock';

interface BrandGuide {
  name: string;
  badge: string;
  accent: string;
  steps: Array<{
    title: string;
    details: string;
  }>;
  criticalNote: string;
}

const BRAND_GUIDES: Record<Manufacturer, BrandGuide> = {
  xiaomi: {
    name: 'Xiaomi / Redmi / POCO (MIUI & HyperOS)',
    badge: 'Aggressive Battery Killer',
    accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    criticalNote:
      'MIUI/HyperOS terminates background alarms unless both "Autostart" and "No restrictions" are enabled.',
    steps: [
      {
        title: 'Enable Autostart',
        details:
          'Open device Settings → Apps → Permissions → Autostart. Find Nooraya and toggle it ON.',
      },
      {
        title: 'Turn Off Battery Restrictions',
        details:
          'Open device Settings → Apps → Manage Apps → Nooraya → Battery Saver → Select "No restrictions".',
      },
      {
        title: 'Lock in Recent Apps',
        details:
          'Open App Switcher (Recent Apps), swipe down or long-press the Nooraya app card, and tap the Lock icon.',
      },
    ],
  },
  samsung: {
    name: 'Samsung (One UI)',
    badge: 'Sleeping Apps Policy',
    accent: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    criticalNote:
      'Samsung One UI automatically puts apps that haven\'t been opened in 3 days into "Deep Sleeping Apps".',
    steps: [
      {
        title: 'Add to Never Sleeping Apps',
        details:
          'Open Settings → Device Care (or Battery) → Background usage limits → Never sleeping apps → Tap "+" and add Nooraya.',
      },
      {
        title: 'Set Battery Usage to Unrestricted',
        details:
          'Long-press the Nooraya app icon on your home screen → Tap "i" (App info) → Battery → Choose "Unrestricted".',
      },
      {
        title: 'Exclude from Auto-Optimisation',
        details:
          'Settings → Device Care → Auto optimisation → Turn OFF "Restart when needed" or verify Nooraya is excluded.',
      },
    ],
  },
  huawei: {
    name: 'Huawei / Honor (EMUI & HarmonyOS)',
    badge: 'PowerGenie Engine',
    accent: 'text-red-400 border-red-500/30 bg-red-500/10',
    criticalNote:
      'Huawei PowerGenie aggressively freezes all scheduled timers unless Manual Launch is configured.',
    steps: [
      {
        title: 'Set App Launch to Manual',
        details:
          'Open Settings → Battery → App Launch (or Startup manager). Locate Nooraya, switch it from "Manage automatically" to "Manage manually".',
      },
      {
        title: 'Enable All Three Background Toggles',
        details:
          'In the popup, ensure Auto-launch, Secondary launch, and Run in background are ALL toggled ON.',
      },
      {
        title: 'Ignore Battery Optimisations',
        details:
          'Settings → Apps → Special app access → Battery optimisation → All apps → Nooraya → Select "Don\'t allow / Allow".',
      },
    ],
  },
  oppo: {
    name: 'Oppo / OnePlus / Realme (ColorOS & OxygenOS)',
    badge: 'Quick Freeze Defense',
    accent: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
    criticalNote:
      'ColorOS Quick Freeze pauses exact alarms when the screen has been off for more than 15 minutes.',
    steps: [
      {
        title: 'Allow Background Activity',
        details:
          'Long-press Nooraya icon → App Info → Battery usage → Enable "Allow background activity" & "Allow auto-launch".',
      },
      {
        title: 'Disable Sleep Standby Optimization',
        details:
          'Open Settings → Battery → Advanced settings → Turn OFF "Sleep standby optimization".',
      },
      {
        title: 'Lock App in Recent Tasks',
        details:
          'Open Multitasking view, tap the 3 dots (or pull down) on Nooraya, and tap "Lock".',
      },
    ],
  },
  vivo: {
    name: 'Vivo / iQOO (Funtouch OS & OriginOS)',
    badge: 'Background Power Control',
    accent: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    criticalNote:
      'Funtouch OS restricts apps consuming battery in the background unless High Background Power Consumption is granted.',
    steps: [
      {
        title: 'High Background Power Consumption',
        details:
          'Settings → Battery → Background power consumption management → Select Nooraya → Choose "Allow high background power consumption".',
      },
      {
        title: 'Enable Autostart Permission',
        details:
          'Open iManager → App management → Autostart management → Enable Nooraya.',
      },
    ],
  },
  stock: {
    name: 'Google Pixel / Motorola / Stock Android',
    badge: 'Standard Battery Saver',
    accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    criticalNote:
      'Standard Android respects exact alarms automatically, but Adaptive Battery can delay alarms on low power.',
    steps: [
      {
        title: 'Set App Battery to Unrestricted',
        details:
          'Long-press Nooraya icon → App Info → App battery usage → Select "Unrestricted".',
      },
      {
        title: 'Allow Alarms & Reminders',
        details:
          'Settings → Apps → Special app access → Alarms & reminders → Verify Nooraya is set to "Allowed".',
      },
    ],
  },
};

export function BatteryOptimizationModal({ isOpen, onClose }: BatteryOptimizationModalProps) {
  const [selectedBrand, setSelectedBrand] = useState<Manufacturer>('xiaomi');

  if (!isOpen) return null;

  const guide = BRAND_GUIDES[selectedBrand];

  return (
    <div className="fixed inset-0 z-[96] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-gradient-to-b from-[#081F17] via-[#051711] to-[#020A07] border border-emerald-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.9)] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-emerald-900/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Battery Saver &amp; Closed-App Adhan Guide
              </h3>
              <p className="text-xs text-emerald-200/70 mt-0.5">
                Prevent aggressive phone battery savers from killing offline prayer alarms
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200/70 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Brand Selector Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(BRAND_GUIDES) as Manufacturer[]).map((key) => {
            const b = BRAND_GUIDES[key];
            const isSelected = selectedBrand === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedBrand(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-[#04140D] hover:bg-[#072418] text-emerald-200/80 border border-emerald-900/60'
                }`}
              >
                <span>{b.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Brand Instructions */}
        <div className="mt-4 space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#04140D] border border-emerald-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <Smartphone size={14} className="text-emerald-400" />
                <span>{guide.name}</span>
              </div>
              <p className="text-[11px] text-amber-200/80 mt-1 leading-relaxed">
                {guide.criticalNote}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider shrink-0 border ${guide.accent}`}
            >
              {guide.badge}
            </span>
          </div>

          {/* Step Cards */}
          <div className="space-y-2.5">
            {guide.steps.map((step, idx) => (
              <div
                key={idx}
                className="bg-[#020B07] border border-emerald-950 hover:border-emerald-800/60 transition-colors rounded-2xl p-4 flex items-start gap-3.5"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white">{step.title}</h4>
                  <p className="text-xs text-emerald-200/75 mt-1 leading-relaxed">
                    {step.details}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Universal Airplane Mode Guarantee Note */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-200/85 leading-relaxed">
              <strong>Offline Guarantee:</strong> Once battery restrictions are disabled for Nooraya, our native exact alarms (<code className="text-emerald-300">SCHEDULE_EXACT_ALARM</code>) will reliably wake the phone and sound the Adhan even in <strong>Airplane Mode</strong> with Wi-Fi and Cellular turned off.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-emerald-900/60 flex items-center justify-between">
          <span className="text-[11px] text-emerald-300/60">
            Settings persist permanently until manual reset.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-emerald-500/20 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
