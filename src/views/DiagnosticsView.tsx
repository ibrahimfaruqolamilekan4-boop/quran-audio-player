import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  Send,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  Play,
  Sliders,
  Video,
  Radio,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  type DiagEvent,
  type DiagCategory,
  initProdDiagnostics,
  subscribeDiagEvents,
  clearDiagEvents,
  probeAudioRangeSupport,
  uploadDiagReportToSupport,
  getLatestVideoQualitySnapshot,
} from '../lib/prodDiagnostics';
import {
  APP_BUILD_VERSION,
  FEATURE_FLAG_CATALOG,
  getFeatureFlags,
  setFeatureFlagOverride,
  resetFeatureFlagOverrides,
  getDeviceRolloutBucket,
  type FeatureFlagsState,
} from '../lib/featureFlags';
import { getQuranAudio, getAmbientAudio, getAdhanAudio } from '../lib/persistentAudio';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Events',
  audio_event: 'Audio Events',
  play_promise: 'play() Promises',
  pause_call: 'pause() Stack Traces',
  src_change: 'src Changes',
  media_session: 'Media Session',
  lifecycle: 'Visibility / Freeze',
  freeze_gap: 'Suspend Gaps',
  sw_audio_fetch: 'SW / 206 Range',
  video_quality: 'Video Quality',
  adhan: 'Adhan',
  error: 'Errors',
};

export function DiagnosticsView() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<DiagEvent[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [flags, setFlags] = useState<FeatureFlagsState>(() => getFeatureFlags());
  const [supportNote, setSupportNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [probingRange, setProbingRange] = useState(false);
  const [rangeProbeResult, setRangeProbeResult] = useState<any | null>(null);
  const [, setTick] = useState(0);

  const htmlBuildId = useMemo(() => {
    if (typeof document === 'undefined') return APP_BUILD_VERSION;
    return (
      document.querySelector('meta[name="build-id"]')?.getAttribute('content') ||
      APP_BUILD_VERSION
    );
  }, []);

  useEffect(() => {
    void initProdDiagnostics();
    const unsub = subscribeDiagEvents((list) => {
      setEvents(list);
    });
    const timer = setInterval(() => setTick((t) => t + 1), 1500);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const filteredEvents = useMemo(() => {
    if (categoryFilter === 'all') return events;
    return events.filter((e) => e.category === (categoryFilter as DiagCategory));
  }, [events, categoryFilter]);

  const quranEl = typeof window !== 'undefined' ? getQuranAudio() : null;
  const ambientEl = typeof window !== 'undefined' ? getAmbientAudio() : null;
  const adhanEl = typeof window !== 'undefined' ? getAdhanAudio() : null;
  const videoSnap = getLatestVideoQualitySnapshot();

  const handleToggleFlag = (key: keyof FeatureFlagsState) => {
    const next = setFeatureFlagOverride(key, !flags[key]);
    setFlags(next);
  };

  const handleResetFlags = () => {
    setFlags(resetFeatureFlagOverrides());
  };

  const handleProbeRange = async () => {
    setProbingRange(true);
    try {
      const targetUrl =
        quranEl?.src && quranEl.src.startsWith('http')
          ? quranEl.src
          : 'https://server8.mp3quran.net/afs/001.mp3';
      const res = await probeAudioRangeSupport(targetUrl);
      setRangeProbeResult(res);
    } finally {
      setProbingRange(false);
    }
  };

  const handleSendToSupport = async () => {
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await uploadDiagReportToSupport(supportNote);
      if (res.ok) {
        setUploadResult({
          ok: true,
          message: `Report uploaded to support (${res.reportId}).`,
        });
        setSupportNote('');
      } else {
        setUploadResult({
          ok: false,
          message: res.error || 'Could not upload report.',
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCopyJson = () => {
    const bundle = {
      buildVersion: APP_BUILD_VERSION,
      htmlBuildId,
      flags,
      videoSnapshot: videoSnap,
      events: filteredEvents.slice(0, 200),
    };
    navigator.clipboard
      ?.writeText(JSON.stringify(bundle, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#06150F] text-[#F6F1E4] p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6 pb-28">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0C2A20] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/home')}
              className="w-10 h-10 rounded-xl bg-[#11382B] hover:bg-[#176B53] flex items-center justify-center text-[#F6F1E4] border border-white/10 cursor-pointer"
              aria-label="Back to player"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-[#34C38F]" />
                <h1 className="text-xl font-serif font-bold text-[#F6F1E4]">
                  Production Diagnostics &amp; Feature Flags (/diag)
                </h1>
              </div>
              <p className="text-xs text-[#A8BFB3] mt-0.5 font-mono">
                Build: {APP_BUILD_VERSION} • Deploy ID: {htmlBuildId} • Rollout Bucket: #{getDeviceRolloutBucket()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/control-audio-test.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#11382B] hover:bg-[#176B53] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold transition-colors"
            >
              <ExternalLink size={14} />
              Phase 0B Static Control Test
            </a>
            <button
              type="button"
              onClick={handleProbeRange}
              disabled={probingRange}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1F8A6A] hover:bg-[#27A37E] text-[#F6F1E4] text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <Radio size={14} />
              {probingRange ? 'Probing 206 Range...' : 'Verify HTTP 206 Range'}
            </button>
          </div>
        </div>

        {/* Live Singleton Audio Elements & Video Quality Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0C2A20] border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Singleton Quran &lt;audio&gt;
              </span>
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded ${
                  quranEl && !quranEl.paused
                    ? 'bg-[#34C38F]/20 text-[#34C38F]'
                    : 'bg-white/10 text-[#A8BFB3]'
                }`}
              >
                {quranEl && !quranEl.paused ? 'PLAYING' : 'PAUSED'}
              </span>
            </div>
            <div className="text-xs font-mono text-[#D1DFD8] space-y-1">
              <div>
                readyState: <strong>{quranEl?.readyState ?? 0}</strong> | networkState:{' '}
                <strong>{quranEl?.networkState ?? 0}</strong>
              </div>
              <div>
                time: <strong>{(quranEl?.currentTime || 0).toFixed(1)}s</strong> /{' '}
                {(quranEl?.duration || 0).toFixed(1)}s
              </div>
              <div>
                error:{' '}
                <strong className={quranEl?.error ? 'text-[#E5675B]' : 'text-[#34C38F]'}>
                  {quranEl?.error ? `Code ${quranEl.error.code}` : 'None'}
                </strong>
              </div>
              <div className="truncate text-[11px] text-[#A8BFB3]" title={quranEl?.src || ''}>
                src: {quranEl?.src || '(empty)'}
              </div>
            </div>
          </div>

          <div className="bg-[#0C2A20] border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#34C38F]">
                Ambient &amp; Adhan &lt;audio&gt;
              </span>
              <span className="text-xs font-mono text-[#A8BFB3]">
                MediaSession: {typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession.playbackState : 'n/a'}
              </span>
            </div>
            <div className="text-xs font-mono text-[#D1DFD8] space-y-1">
              <div>
                Ambient: <strong>{ambientEl && !ambientEl.paused ? 'PLAYING' : 'PAUSED'}</strong> (rs={ambientEl?.readyState ?? 0})
              </div>
              <div>
                Adhan: <strong>{adhanEl && !adhanEl.paused ? 'PLAYING' : 'PAUSED'}</strong> (rs={adhanEl?.readyState ?? 0})
              </div>
              {rangeProbeResult && (
                <div className="pt-1 border-t border-white/10 text-[11px]">
                  206 Probe: Status{' '}
                  <strong className={rangeProbeResult.is206 ? 'text-[#34C38F]' : 'text-[#E0A63A]'}>
                    {rangeProbeResult.status}
                  </strong>{' '}
                  | Range: {rangeProbeResult.contentRange || rangeProbeResult.acceptRanges || 'n/a'} | SW:{' '}
                  {rangeProbeResult.fromServiceWorker ? 'Yes' : 'Bypassed'}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0C2A20] border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                <Video size={14} /> Background Video Metrics
              </span>
              <span className="text-xs font-mono text-[#34C38F]">
                {videoSnap ? videoSnap.renditionLabel : 'Measuring...'}
              </span>
            </div>
            {videoSnap ? (
              <div className="text-xs font-mono text-[#D1DFD8] space-y-1">
                <div>
                  Source: <strong>{videoSnap.videoWidth}x{videoSnap.videoHeight}</strong> | Viewport:{' '}
                  <strong>{videoSnap.cssWidth}x{videoSnap.cssHeight} @{videoSnap.dpr}x</strong>
                </div>
                <div>
                  Visible Strip: <strong>{Math.round(videoSnap.visibleSourceWidth)}x{Math.round(videoSnap.visibleSourceHeight)}</strong> | Upscale:{' '}
                  <strong
                    className={
                      videoSnap.effectiveUpscaleFactor <= 1.5
                        ? 'text-[#34C38F]'
                        : 'text-[#E0A63A]'
                    }
                  >
                    {videoSnap.effectiveUpscaleFactor.toFixed(2)}x
                  </strong>
                </div>
                <div>
                  Dropped Frames:{' '}
                  <strong>
                    {videoSnap.droppedVideoFrames} / {videoSnap.totalVideoFrames}
                  </strong>{' '}
                  ({(videoSnap.droppedFrameRatio * 100).toFixed(1)}%)
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#A8BFB3]">
                Open the player or home screen with an active background video to measure upscale factor and dropped frames.
              </p>
            )}
          </div>
        </div>

        {/* Phase 5: Feature Flags & Kill Switches */}
        <div className="bg-[#0C2A20] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-[#D4AF37]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#F6F1E4]">
                Phase 5 Feature Flags &amp; Instant Kill-Switches
              </h2>
            </div>
            <button
              type="button"
              onClick={handleResetFlags}
              className="text-xs text-[#A8BFB3] hover:text-[#F6F1E4] underline cursor-pointer"
            >
              Reset to Rollout Defaults
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FEATURE_FLAG_CATALOG.map((item) => {
              const enabled = flags[item.key];
              return (
                <div
                  key={item.key}
                  className="bg-[#06150F] border border-white/10 rounded-xl p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#11382B] text-[#34C38F]">
                        {item.phase}
                      </span>
                      <span className="text-sm font-semibold text-[#F6F1E4]">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#A8BFB3] leading-relaxed">
                      {item.description}
                    </p>
                    <p className="text-[11px] text-[#6E887C] font-mono">
                      Rollback: {item.rollbackPlan}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFlag(item.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                      enabled
                        ? 'bg-[#34C38F] text-[#06150F]'
                        : 'bg-[#E5675B]/20 text-[#E5675B] border border-[#E5675B]/40'
                    }`}
                  >
                    {enabled ? 'ENABLED' : 'KILLED'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Opt-In Send to Support */}
        <div className="bg-[#0C2A20] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#F6F1E4]">
                Opt-In Diagnostic Upload to Support (/api/diag)
              </h2>
              <p className="text-xs text-[#A8BFB3]">
                Rate-limited (max 5/10 min). Uploads timestamped audio/visibility/SW logs and stack traces without any personal tokens or secrets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#11382B] hover:bg-[#176B53] text-xs font-semibold text-[#F6F1E4] border border-white/10 cursor-pointer"
              >
                {copied ? <Check size={14} className="text-[#34C38F]" /> : <Copy size={14} />}
                {copied ? 'Copied JSON' : 'Copy JSON'}
              </button>
              <button
                type="button"
                onClick={() => void clearDiagEvents()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#11382B] hover:bg-[#E5675B]/20 text-xs font-semibold text-[#E5675B] border border-white/10 cursor-pointer"
              >
                <Trash2 size={14} />
                Clear Log
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={supportNote}
              onChange={(e) => setSupportNote(e.target.value)}
              placeholder="Optional note (e.g., iPhone 15 Pro PWA paused 5 min on lock screen)..."
              className="flex-1 bg-[#06150F] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-[#F6F1E4] placeholder-[#6E887C] focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="button"
              onClick={handleSendToSupport}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#E2C04B] text-[#06150F] text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <Send size={14} />
              {uploading ? 'Uploading...' : 'Send to Support'}
            </button>
          </div>

          {uploadResult && (
            <div
              className={`text-xs px-3 py-2 rounded-lg font-medium ${
                uploadResult.ok
                  ? 'bg-[#34C38F]/15 text-[#34C38F] border border-[#34C38F]/30'
                  : 'bg-[#E5675B]/15 text-[#E5675B] border border-[#E5675B]/30'
              }`}
            >
              {uploadResult.message}
            </div>
          )}
        </div>

        {/* Event Log Filter & Table */}
        <div className="bg-[#0C2A20] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategoryFilter(key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    categoryFilter === key
                      ? 'bg-[#D4AF37] text-[#06150F]'
                      : 'bg-[#06150F] text-[#A8BFB3] hover:text-[#F6F1E4] border border-white/8'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs font-mono text-[#A8BFB3]">
              Showing {filteredEvents.length} persisted events (IndexedDB)
            </span>
          </div>

          <div className="bg-[#040E0A] border border-white/10 rounded-xl overflow-hidden">
            <div className="max-h-[480px] overflow-y-auto divide-y divide-white/6 font-mono text-xs">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-[#A8BFB3]">
                  No diagnostic events recorded for this filter yet.
                </div>
              ) : (
                filteredEvents.map((ev) => (
                  <div key={ev.id} className="p-3 hover:bg-white/[0.02] space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#6E887C]">{ev.iso.slice(11, 23)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#11382B] text-[#34C38F] text-[10px] uppercase">
                          {ev.category}
                        </span>
                        <strong className="text-[#F6F1E4]">{ev.event}</strong>
                        {ev.elementId && (
                          <span className="text-[#D4AF37]">[{ev.elementId}]</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#A8BFB3]">
                        {ev.readyState !== undefined && `rs=${ev.readyState} ns=${ev.networkState} `}
                        {ev.currentTime !== undefined && `pos=${ev.currentTime}s `}
                        {ev.status !== undefined && `HTTP=${ev.status} `}
                        vis={ev.visibilityState}
                      </div>
                    </div>
                    {ev.errorMessage && (
                      <div className="text-[#E5675B] text-[11px]">
                        Error: {ev.errorMessage}
                      </div>
                    )}
                    {ev.src && (
                      <div className="text-[#A8BFB3] text-[11px] truncate">
                        src: {ev.src}
                      </div>
                    )}
                    {ev.details && (
                      <div className="text-[#D1DFD8] text-[11px]">
                        {JSON.stringify(ev.details)}
                      </div>
                    )}
                    {ev.stack && (
                      <div className="text-[#6E887C] text-[10px] break-all">
                        stack: {ev.stack}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
