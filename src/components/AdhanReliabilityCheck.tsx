import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Smartphone,
  BatteryCharging,
  Clock,
  Volume2,
  Bell,
  Moon,
  Plane,
  Info,
} from 'lucide-react';
import type { UserLocation } from '../lib/location';
import type { PrayerSettings } from '../lib/prayer';
import type { AdhanVoiceRow } from '../lib/adhanAudio';
import {
  getNativeReliabilityStatus,
  openNativeReliabilitySetting,
  triggerNativeAdhanTestIn10Seconds,
  type NativeReliabilityStatus,
  type NativeSettingTarget,
} from '../lib/nativeMediaBridge';
import {
  syncOfflinePrayerSchedule,
  IOS_MAX_PENDING_NOTIFICATIONS,
  type OfflineSchedulePlan,
} from '../lib/offlinePrayerScheduler';

interface AdhanReliabilityCheckProps {
  location: UserLocation;
  settings: PrayerSettings;
  voices: AdhanVoiceRow[];
}

const OEM_GUIDES: Array<{ brands: string; path: string }> = [
  {
    brands: 'Tecno / Infinix / Itel (HiOS & XOS)',
    path: 'Phone Master → Toolbox → Auto-start Management → Enable Nooraya, AND Battery Lab → Battery Optimization → Nooraya → Do Not Optimize.',
  },
  {
    brands: 'Xiaomi / Redmi / POCO (HyperOS & MIUI)',
    path: 'Settings → Apps → Permissions → Autostart → Enable Nooraya, AND App Info → Battery Saver → No Restrictions.',
  },
  {
    brands: 'Samsung (OneUI)',
    path: 'Settings → Battery → Background Usage Limits → Never Auto Sleeping Apps → Add Nooraya, AND App Info → Battery → Unrestricted.',
  },
  {
    brands: 'Oppo / Realme / OnePlus (ColorOS & OxygenOS)',
    path: 'Settings → Apps → App Management → Nooraya → Battery Usage → Allow Background Activity & Allow Auto-Launch.',
  },
  {
    brands: 'Vivo / iQOO (FunTouchOS)',
    path: 'Settings → Battery → Background Power Consumption Management → Nooraya → Don’t Restrict Background Power Usage.',
  },
];

export function AdhanReliabilityCheck({
  location,
  settings,
  voices,
}: AdhanReliabilityCheckProps) {
  const [status, setStatus] = useState<NativeReliabilityStatus | null>(null);
  const [plan, setPlan] = useState<OfflineSchedulePlan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshAll = useCallback(
    async (forceReschedule = false) => {
      setRefreshing(true);
      try {
        const [rel, syncRes] = await Promise.all([
          getNativeReliabilityStatus(),
          syncOfflinePrayerSchedule({
            location,
            settings,
            voices,
            force: forceReschedule,
          }),
        ]);
        setStatus(rel);
        setPlan(syncRes.plan);
        if (forceReschedule) {
          setActionMessage(
            syncRes.nativeResult
              ? `Rescheduled ${syncRes.nativeResult.scheduledCount} offline native prayer alarms (${syncRes.plan.daysCovered} days ahead).`
              : `Recomputed ${syncRes.plan.totalPendingCount} local prayer alerts for the next ${syncRes.plan.daysCovered} days (ready for native sync).`
          );
        }
      } finally {
        setRefreshing(false);
      }
    },
    [location, settings, voices]
  );

  useEffect(() => {
    void refreshAll(false);
  }, [refreshAll]);

  const handleOpenSetting = async (target: NativeSettingTarget, label: string) => {
    const res = await openNativeReliabilitySetting(target);
    if (!res.opened) {
      setActionMessage(
        `${label} system deep-link is available inside the native Android / iOS app. In the web PWA, adjust this in your phone’s Settings app.`
      );
    }
  };

  const handleNative10sTest = async () => {
    const sample = plan?.alarms[0];
    if (!sample) {
      setActionMessage('Enable at least one prayer reminder first to test offline Adhan scheduling.');
      return;
    }
    const res = await triggerNativeAdhanTestIn10Seconds(sample);
    setActionMessage(
      res.ok
        ? '10-second offline native Adhan alarm scheduled! Turn on Airplane Mode, close the app, and lock your screen now.'
        : res.error || 'Native 10-second test requires the installed Android/iOS native app.'
    );
  };

  const isAndroid = status?.platform === 'capacitor-android' || status?.platform === 'pwa-android' || status?.platform === 'browser-android';
  const isIOS = status?.platform === 'capacitor-ios' || status?.platform === 'pwa-ios' || status?.platform === 'browser-ios';

  const checkRows: Array<{
    key: string;
    label: string;
    detail: string;
    ok: boolean;
    target: NativeSettingTarget;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }> = [
    {
      key: 'notifications',
      label: 'Notifications Permission',
      detail: 'Required so the OS can display prayer banners and wake the Adhan channel.',
      ok: Boolean(status?.notificationsGranted),
      target: 'notifications',
      icon: Bell,
    },
    ...(isAndroid || !isIOS
      ? [
          {
            key: 'exact_alarms',
            label: 'Exact Alarms (SCHEDULE_EXACT_ALARM)',
            detail:
              'Required on Android 12–15+ so Fajr–Isha fire at the exact minute during Doze mode without delay.',
            ok: Boolean(status?.canScheduleExactAlarms),
            target: 'exact_alarms' as NativeSettingTarget,
            icon: Clock,
          },
          {
            key: 'battery_optimization',
            label: 'Unrestricted Battery Optimization',
            detail:
              'Prevents Android Doze and manufacturer battery killers from postponing closed-app Adhan alarms.',
            ok: Boolean(status?.batteryOptimizationIgnored),
            target: 'battery_optimization' as NativeSettingTarget,
            icon: BatteryCharging,
          },
          {
            key: 'oem_autostart',
            label: `OEM Autostart & Background Run (${status?.oemManufacturer || 'Android'})`,
            detail:
              'Critical on Tecno, Infinix, Xiaomi, Samsung, Oppo & Vivo so alarms survive phone reboots and killed app state.',
            ok: status?.isNative ? !status.oemRequiresAutostartStep : false,
            target: 'oem_autostart' as NativeSettingTarget,
            icon: Smartphone,
          },
          {
            key: 'channel_sound',
            label: 'Per-Prayer Channel Sound (Real Muezzin Audio)',
            detail:
              'Verifies high-importance Adhan notification channels are enabled with real recorded voice audio (never synthetic tones).',
            ok: Boolean(status?.channelSoundConfigured),
            target: 'channel_sound' as NativeSettingTarget,
            icon: Volume2,
          },
          {
            key: 'dnd',
            label: 'Do Not Disturb (DND) Override / Policy',
            detail:
              'Optional: allow Fajr & prayer alerts to ring while DND is active overnight.',
            ok: Boolean(status?.dndInterruptsAllowed),
            target: 'dnd' as NativeSettingTarget,
            icon: Moon,
          },
        ]
      : []),
    ...(isIOS
      ? [
          {
            key: 'ios_time_sensitive',
            label: 'iOS Time Sensitive Notifications',
            detail:
              'Allows prayer alerts to break through Scheduled Summary & Focus modes when permitted (never requires restricted Critical Alerts).',
            ok: Boolean(status?.iosTimeSensitiveAllowed),
            target: 'notifications' as NativeSettingTarget,
            icon: Clock,
          },
        ]
      : []),
  ];

  return (
    <div
      data-testid="adhan-reliability-check"
      className="bg-gradient-to-br from-[#061812] via-[#04120D] to-[#020A07] border border-emerald-500/30 rounded-3xl p-6 lg:p-7 shadow-xl space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-900/70 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-300 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight">
                Adhan Reliability Check &amp; Offline 10-Day Schedule
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 flex items-center gap-1">
                <Plane size={10} />
                {status?.isNative ? 'Native Offline Ready' : 'PWA Mode (Offline Native Ready)'}
              </span>
            </div>
            <p className="text-xs text-emerald-200/70 mt-1 max-w-2xl leading-relaxed">
              Computes your next <strong className="text-white">10 days</strong> of prayer times locally on this device (zero internet needed).
              In the native Android/iOS app, alarms fire in Airplane Mode with the app completely closed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void refreshAll(true)}
            disabled={refreshing}
            data-testid="refresh-offline-schedule-btn"
            className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh 10-Day Schedule</span>
          </button>

          {status?.isNative && (
            <button
              type="button"
              onClick={() => void handleNative10sTest()}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold cursor-pointer"
            >
              Test Offline Adhan in 10s
            </button>
          )}
        </div>
      </div>

      {/* Offline Rolling Schedule Summary */}
      {plan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#020B07] border border-emerald-950 rounded-2xl p-3.5">
            <div className="text-[10px] uppercase font-bold text-emerald-400/65">Offline Window</div>
            <div className="text-lg font-extrabold font-mono text-white mt-0.5">
              {plan.daysCovered} Days
            </div>
            <div className="text-[10px] text-emerald-300/60 mt-0.5">
              Calculated locally via adhan
            </div>
          </div>

          <div className="bg-[#020B07] border border-emerald-950 rounded-2xl p-3.5">
            <div className="text-[10px] uppercase font-bold text-emerald-400/65">Pending Alarms</div>
            <div className="text-lg font-extrabold font-mono text-emerald-300 mt-0.5">
              {plan.totalPendingCount} / {IOS_MAX_PENDING_NOTIFICATIONS}
            </div>
            <div className="text-[10px] text-emerald-300/60 mt-0.5">
              {plan.withinIos64Cap ? 'Safely within iOS 64-cap' : 'Capped for iOS safety'}
            </div>
          </div>

          <div className="bg-[#020B07] border border-emerald-950 rounded-2xl p-3.5">
            <div className="text-[10px] uppercase font-bold text-emerald-400/65">Next Local Alert</div>
            <div className="text-sm font-bold text-amber-300 mt-1 truncate">
              {plan.alarms[0]
                ? `${plan.alarms[0].prayerNameEn} • ${plan.alarms[0].prayerTimeFormatted}`
                : 'None enabled'}
            </div>
            <div className="text-[10px] text-emerald-300/60 mt-0.5 truncate">
              {plan.alarms[0]?.nativeSoundResource || 'Silent text alert'}
            </div>
          </div>

          <div className="bg-[#020B07] border border-emerald-950 rounded-2xl p-3.5">
            <div className="text-[10px] uppercase font-bold text-emerald-400/65">Top-Up Reminder</div>
            <div className="text-sm font-bold text-white mt-1 truncate">
              {plan.topUpReminder ? plan.topUpReminder.dateKey : '—'}
            </div>
            <div className="text-[10px] text-emerald-300/60 mt-0.5">
              Day-9 auto-refresh prompt
            </div>
          </div>
        </div>
      )}

      {actionMessage && (
        <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-xs text-emerald-100 flex items-center gap-2">
          <Info size={14} className="text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Honest Platform Reality Banner */}
      {!status?.isNative && (
        <div className="bg-amber-950/35 border border-amber-500/35 rounded-2xl p-4 text-xs text-amber-100/85 leading-relaxed space-y-1">
          <div className="font-bold text-amber-300 uppercase text-[11px] tracking-wider">
            Web PWA vs. Native App Reality (Honest Disclosure)
          </div>
          <p>
            You are currently running the <strong>Web / PWA version</strong>. Web browsers cannot schedule local offline alarms or play custom Adhan audio while the app is closed (Web Push requires internet and uses the OS default sound). The native Android &amp; iOS Capacitor wrapper uses this exact 10-day local schedule to ring in <strong>Airplane Mode</strong> with the real Muezzin Adhan.
          </p>
        </div>
      )}

      {/* iPhone Honest Disclosures (Silent Switch, Focus Mode, 64-Notification Limit) */}
      <div className="bg-[#020B07]/90 border border-emerald-900/70 rounded-2xl p-4 text-xs text-emerald-100/80 space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          iPhone (iOS) Important Behavior Notes
        </div>
        <ul className="list-disc pl-4 space-y-1 text-[11px] text-emerald-200/75 leading-relaxed">
          <li>
            <strong>Hardware Silent Switch &amp; Focus Modes:</strong> iOS mutes local notification Adhan sounds when the side Silent switch is on or a Focus mode blocks Time Sensitive notifications.
          </li>
          <li>
            <strong>30-Second Clip + Full Adhan on Tap:</strong> Apple limits local notification sounds to under 30 seconds (Nooraya bundles authentic 28-second Madinah &amp; Alafasy clips). Tapping the notification opens Nooraya to play the full 3–4 minute Adhan.
          </li>
          <li>
            <strong>64 Pending Notifications Cap:</strong> iOS caps local scheduled alerts at 64. Nooraya schedules 10 days ahead and adds a gentle Day-9 reminder — if you don&apos;t open the app for over 10 days, scheduled alerts will pause until you reopen Nooraya.
          </li>
        </ul>
      </div>

      {/* Interactive Device Reliability Checklist */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          System Reliability Checklist &amp; Settings Shortcuts
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {checkRows.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.key}
                className="bg-[#020B07] border border-emerald-950 rounded-2xl p-3.5 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      row.ok
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/35'
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="truncate">{row.label}</span>
                      {row.ok ? (
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-200/70 mt-0.5 leading-relaxed">
                      {row.detail}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleOpenSetting(row.target, row.label)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-200 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>Settings</span>
                  <ExternalLink size={10} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Android Battery-Aggressive OEM Instructions (Tecno, Infinix, Xiaomi, Samsung, Oppo, Vivo) */}
      <div className="bg-[#020B07]/90 border border-emerald-900/70 rounded-2xl p-4 space-y-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
          Android Phone-Specific Guides (Tecno, Infinix, Xiaomi, Samsung, Oppo, Vivo)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {OEM_GUIDES.map((oem) => (
            <div
              key={oem.brands}
              className="bg-[#04140D] border border-emerald-950 rounded-xl p-3 text-[11px]"
            >
              <div className="font-bold text-white">{oem.brands}</div>
              <div className="text-emerald-200/75 mt-0.5 leading-relaxed">{oem.path}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
