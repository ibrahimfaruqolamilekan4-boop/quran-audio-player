import React, { useState, useEffect, useCallback } from 'react';
import {
  BellRing,
  BellOff,
  Send,
  Smartphone,
  Share,
  PlusSquare,
  CheckCircle2,
  AlertTriangle,
  Activity,
  RefreshCw,
  ShieldCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import type { UserLocation } from '../lib/location';
import type { PrayerSettings } from '../lib/prayer';
import {
  subscribeToPrayerPushNotifications,
  unsubscribeFromPrayerPushNotifications,
  sendTestPushNotification,
  fetchPushDiagnostics,
  type PushDiagnosticsReport,
} from '../lib/pushNotifications';

interface PushNotificationsPanelProps {
  location: UserLocation;
  settings: PrayerSettings;
  onUpdateSettings?: (patch: Partial<PrayerSettings>) => void;
  isAdminView?: boolean;
}

export function PushNotificationsPanel({
  location,
  settings,
  onUpdateSettings,
  isAdminView = false,
}: PushNotificationsPanelProps) {
  const [diag, setDiag] = useState<PushDiagnosticsReport | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [dispatchingCron, setDispatchingCron] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(isAdminView);

  const loadDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    try {
      const report = await fetchPushDiagnostics();
      setDiag(report);
    } catch (e) {
      console.warn('Diagnostics check error:', e);
    } finally {
      setLoadingDiag(false);
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  // Keep server subscription in sync when user is already subscribed and changes location or settings
  useEffect(() => {
    if (!diag?.pushSubscribed) return;
    const timer = window.setTimeout(() => {
      void subscribeToPrayerPushNotifications(location, settings).then(() => {
        void loadDiagnostics();
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    diag?.pushSubscribed,
    location.latitude,
    location.longitude,
    location.timezone,
    location.cityName,
    settings.method,
    settings.madhab,
    settings.highLatitudeRule,
    settings.reminderMinutesBefore,
    settings.prayerReminders,
    loadDiagnostics,
  ]);

  const handleToggleSubscription = async () => {
    setStatusMessage(null);
    setSubscribing(true);
    try {
      if (diag?.pushSubscribed) {
        await unsubscribeFromPrayerPushNotifications();
        setStatusMessage({
          text: 'Background push notifications disabled and your coordinates were deleted from the server.',
          type: 'info',
        });
      } else {
        const res = await subscribeToPrayerPushNotifications(location, settings);
        if (res.ok) {
          setStatusMessage({
            text: `Background Push Notifications enabled for ${location.cityName} (${location.timezone})!`,
            type: 'success',
          });
        } else {
          setStatusMessage({
            text: res.error || 'Could not enable background push notifications.',
            type: 'error',
          });
        }
      }
      await loadDiagnostics();
    } finally {
      setSubscribing(false);
    }
  };

  const handleSendTest = async () => {
    setStatusMessage(null);
    setTestingPush(true);
    try {
      const res = await sendTestPushNotification(location.cityName);
      setStatusMessage({
        text: res.message,
        type: res.ok ? 'success' : 'error',
      });
      await loadDiagnostics();
    } finally {
      setTestingPush(false);
    }
  };

  const handleRunDispatchNow = async () => {
    setDispatchingCron(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/push/dispatch', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatusMessage({
          text: `Scheduler dispatch completed: ${data.checked} active subscriptions checked, ${data.sent} push notifications sent, ${data.expiredDeactivated} expired endpoints cleaned.`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: data.error || 'Dispatch check failed.',
          type: 'error',
        });
      }
      await loadDiagnostics();
    } finally {
      setDispatchingCron(false);
    }
  };

  const caps = diag?.capabilities;

  return (
    <div className="bg-gradient-to-br from-[#061812] via-[#04120D] to-[#020A07] border border-emerald-500/30 rounded-3xl p-6 lg:p-7 shadow-xl space-y-5">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-900/70 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-300 shrink-0">
            <BellRing size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight">
                Notifications When the App is Closed (Web Push)
              </h3>
              {diag?.pushSubscribed ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Subscribed & Active
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                  Off (Device-Only Mode)
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-200/70 mt-1 max-w-2xl leading-relaxed">
              Receive prayer alerts for <strong className="text-white">{location.cityName}</strong> even when Nooraya is closed or your phone screen is locked. Tapping a notification opens Nooraya and plays the Adhan immediately.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleSubscription}
            disabled={subscribing}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
              diag?.pushSubscribed
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {diag?.pushSubscribed ? (
              <>
                <BellOff size={14} />
                <span>{subscribing ? 'Disabling...' : 'Disable Closed-App Push'}</span>
              </>
            ) : (
              <>
                <BellRing size={14} />
                <span>{subscribing ? 'Subscribing...' : 'Enable Closed-App Push'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSendTest}
            disabled={testingPush}
            className="px-4 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Send size={13} />
            <span>{testingPush ? 'Sending...' : 'Send Test Notification'}</span>
          </button>
        </div>
      </div>

      {/* iOS Safari "Add to Home Screen First" Guide */}
      {caps?.iosRequiresHomeScreenInstall && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <Smartphone size={16} className="text-amber-400 shrink-0" />
            <span>Install to Home Screen First to Get Notifications on iPhone</span>
          </div>
          <p className="text-xs text-amber-100/80 leading-relaxed">
            Apple iOS requires web apps to be added to your Home Screen before background push notifications can be enabled:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-[#020B07]/80 border border-amber-500/25 rounded-xl p-3 flex items-center gap-2.5 text-amber-100">
              <Share size={16} className="text-amber-400 shrink-0" />
              <span>1. Tap <strong>Share</strong> in the Safari toolbar</span>
            </div>
            <div className="bg-[#020B07]/80 border border-amber-500/25 rounded-xl p-3 flex items-center gap-2.5 text-amber-100">
              <PlusSquare size={16} className="text-amber-400 shrink-0" />
              <span>2. Select <strong>Add to Home Screen</strong></span>
            </div>
            <div className="bg-[#020B07]/80 border border-amber-500/25 rounded-xl p-3 flex items-center gap-2.5 text-amber-100">
              <BellRing size={16} className="text-amber-400 shrink-0" />
              <span>3. Open Nooraya from Home Screen & tap <strong>Enable</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Status Toast Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-red-950/60 border-red-500/40 text-red-200'
              : 'bg-slate-900 border-slate-700 text-slate-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Reminder Timing Offset & Privacy Disclosure */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-5 bg-[#020B07]/90 border border-emerald-900/70 rounded-2xl p-4">
          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Clock size={13} className="text-emerald-400" />
            <span>Notification Timing</span>
          </label>
          <select
            value={settings.reminderMinutesBefore || 0}
            onChange={(e) => onUpdateSettings?.({ reminderMinutesBefore: Number(e.target.value) })}
            className="w-full bg-[#04140D] border border-emerald-800/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
          >
            <option value={0}>At Exact Prayer Time (0 min)</option>
            <option value={5}>5 Minutes Before Prayer</option>
            <option value={10}>10 Minutes Before Prayer</option>
            <option value={15}>15 Minutes Before Prayer</option>
          </select>
        </div>

        <div className="md:col-span-7 bg-[#020B07]/90 border border-emerald-900/70 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck size={17} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-emerald-200/75 leading-relaxed">
            <strong className="text-white">Privacy Guarantee:</strong> Your location stays on your device by default. Only when you enable Closed-App Push above are your city coordinates ({location.cityName}) stored in `push_subscriptions` so our per-minute scheduler can send timely alerts. Disabling push deletes your server record immediately.
          </div>
        </div>
      </div>

      {/* Expandable Diagnostics Panel (User + Admin) */}
      <div className="pt-2 border-t border-emerald-900/60">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <Activity size={14} className="text-teal-400" />
            <span>Push & Scheduler Diagnostics (User + Admin)</span>
            {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <div className="flex items-center gap-2">
            {isAdminView && (
              <button
                type="button"
                onClick={handleRunDispatchNow}
                disabled={dispatchingCron}
                className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/35 text-teal-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Zap size={12} />
                <span>{dispatchingCron ? 'Running Dispatch...' : 'Run Per-Minute Dispatch Now'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadDiagnostics}
              className="text-[11px] text-emerald-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={11} className={loadingDiag ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {showDiagnostics && diag && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            <div className="bg-[#020B07] border border-emerald-950 rounded-xl p-3">
              <div className="text-[10px] uppercase text-emerald-400/60 font-bold">Permission</div>
              <div className="font-mono font-bold text-white mt-1 capitalize">
                {diag.capabilities.permission}
              </div>
              <div className="text-[10px] text-emerald-300/60 mt-0.5">
                {diag.capabilities.isStandalonePWA ? 'Standalone PWA' : 'Browser Tab'}
              </div>
            </div>

            <div className="bg-[#020B07] border border-emerald-950 rounded-xl p-3">
              <div className="text-[10px] uppercase text-emerald-400/60 font-bold">Service Worker</div>
              <div className="font-mono font-bold text-white mt-1 capitalize">
                {diag.serviceWorkerState}
              </div>
              <div className="text-[10px] text-emerald-300/60 truncate mt-0.5">
                {diag.swScriptUrl ? diag.swScriptUrl.split('/').pop() : 'push-sw.js'}
              </div>
            </div>

            <div className="bg-[#020B07] border border-emerald-950 rounded-xl p-3">
              <div className="text-[10px] uppercase text-emerald-400/60 font-bold">Push Endpoint</div>
              <div className="font-mono font-bold text-white mt-1">
                {diag.pushSubscribed ? 'Subscribed' : 'Not Subscribed'}
              </div>
              <div className="text-[10px] text-emerald-300/60 truncate mt-0.5">
                {diag.endpointHost || 'No active endpoint'}
              </div>
            </div>

            <div className="bg-[#020B07] border border-emerald-950 rounded-xl p-3">
              <div className="text-[10px] uppercase text-emerald-400/60 font-bold">VAPID & Cron</div>
              <div className="font-mono font-bold text-emerald-300 mt-1">
                {diag.vapidPublicKeyReady ? 'VAPID Ready' : 'Unavailable'}
              </div>
              <div className="text-[10px] text-emerald-300/60 truncate mt-0.5">
                {diag.totalActiveSubscriptions} active device(s)
              </div>
            </div>

            <div className="bg-[#020B07] border border-emerald-950 rounded-xl p-3">
              <div className="text-[10px] uppercase text-emerald-400/60 font-bold">Next Server Push</div>
              <div className="font-mono font-bold text-amber-300 mt-1">
                {diag.nextScheduledPrayer ? diag.nextScheduledPrayer.english : '—'}
              </div>
              <div className="text-[10px] text-emerald-300/60 truncate mt-0.5">
                {diag.nextScheduledPrayer
                  ? new Date(diag.nextScheduledPrayer.timeIso).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Subscribe to schedule'}
              </div>
            </div>

            <div className="bg-[#020B07] border border-emerald-950 rounded-xl p-3">
              <div className="text-[10px] uppercase text-emerald-400/60 font-bold">Last Push Status</div>
              <div className="font-mono font-bold text-white mt-1 truncate">
                {diag.serverSubscription?.lastStatus || 'None yet'}
              </div>
              <div className="text-[10px] text-emerald-300/60 truncate mt-0.5">
                {diag.serverSubscription?.lastSentAt
                  ? new Date(diag.serverSubscription.lastSentAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Use Test button'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
