import React, { useState, useEffect } from 'react';
import {
  getDiagnosticEvents,
  clearDiagnosticEvents,
  exportDiagnosticsJson,
  type DiagnosticEvent,
} from '../lib/diagnostics';
import { Download, Trash2, RefreshCw, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

export function DiagnosticsView() {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    const data = await getDiagnosticEvents();
    setEvents([...data].reverse());
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    if (confirm('Clear all diagnostics events?')) {
      await clearDiagnosticEvents();
      setEvents([]);
    }
  };

  const handleDownload = async () => {
    const json = await exportDiagnosticsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nooraya-diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const json = await exportDiagnosticsJson();
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = events.filter((e) => (filter === 'all' ? true : e.category === filter));

  const freezeCount = events.filter((e) => e.category === 'freeze').length;
  const errorCount = events.filter((e) => e.category === 'error').length;

  return (
    <div className="min-h-screen bg-[#06150F] text-[#F6F1E4] p-4 md:p-8 font-sans pb-32">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1B4D3E]/40 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="text-[#10B981]" size={24} />
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#D4AF37]">
                Production Diagnostics
              </h1>
            </div>
            <p className="text-xs text-[#8FA89B] mt-1">
              Live background playback telemetry, WebKit freeze detection, and audio pipeline events.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadEvents}
              className="px-3 py-1.5 rounded-lg bg-[#0C231B] border border-[#1B4D3E] text-xs font-medium hover:bg-[#18382B] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-[#1F8A6A] text-white text-xs font-semibold hover:bg-[#27A37E] flex items-center gap-1.5 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-[#0C231B] border border-[#1B4D3E] text-xs font-medium hover:bg-[#18382B] flex items-center gap-1.5 transition-colors"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800/40 text-red-300 text-xs font-medium hover:bg-red-900/60 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} />
              Clear
            </button>
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#0C231B] border border-[#1B4D3E]/50 rounded-xl p-3">
            <span className="text-[11px] text-[#8FA89B] block">Total Events</span>
            <span className="text-lg font-bold text-[#F6F1E4]">{events.length}</span>
          </div>
          <div className="bg-[#0C231B] border border-[#1B4D3E]/50 rounded-xl p-3">
            <span className="text-[11px] text-[#8FA89B] block">JS Freezes</span>
            <span className={`text-lg font-bold ${freezeCount > 0 ? 'text-pink-400' : 'text-[#10B981]'}`}>
              {freezeCount}
            </span>
          </div>
          <div className="bg-[#0C231B] border border-[#1B4D3E]/50 rounded-xl p-3">
            <span className="text-[11px] text-[#8FA89B] block">Errors Logged</span>
            <span className={`text-lg font-bold ${errorCount > 0 ? 'text-red-400' : 'text-[#10B981]'}`}>
              {errorCount}
            </span>
          </div>
          <div className="bg-[#0C231B] border border-[#1B4D3E]/50 rounded-xl p-3">
            <span className="text-[11px] text-[#8FA89B] block">Mode</span>
            <span className="text-lg font-bold text-[#D4AF37]">
              {typeof window !== 'undefined' &&
              (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone)
                ? 'PWA Standalone'
                : 'Browser Tab'}
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
          {['all', 'audio', 'mediasession', 'lifecycle', 'freeze', 'error'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full capitalize font-medium transition-colors ${
                filter === f
                  ? 'bg-[#1F8A6A] text-white'
                  : 'bg-[#0C231B] text-[#8FA89B] border border-[#1B4D3E]/40 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Log Viewer */}
        <div className="bg-[#020805] border border-[#0F2D22] rounded-xl overflow-hidden shadow-2xl">
          <div className="max-h-[550px] overflow-y-auto divide-y divide-white/5 font-mono text-xs">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-[#8FA89B]">No diagnostic events recorded yet.</div>
            ) : (
              filtered.map((e) => (
                <div key={e.id} className="p-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          e.category === 'error'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : e.category === 'freeze'
                            ? 'bg-pink-950 text-pink-300 border border-pink-800'
                            : e.category === 'audio'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : e.category === 'mediasession'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-900 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {e.category}
                      </span>
                      <span className="font-semibold text-white/90">{e.name}</span>
                    </div>
                    <span className="text-[11px] text-[#8FA89B]">
                      {new Date(e.timestamp).toTimeString().split(' ')[0]}.
                      {('00' + new Date(e.timestamp).getMilliseconds()).slice(-3)}
                    </span>
                  </div>

                  {e.details && Object.keys(e.details).length > 0 && (
                    <div className="text-[11px] text-[#A8BFB3] pl-2 border-l-2 border-[#1B4D3E]/50 my-1 overflow-x-auto">
                      {JSON.stringify(e.details)}
                    </div>
                  )}

                  {e.stackTrace && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-amber-400 cursor-pointer hover:underline">
                        View Stack Trace
                      </summary>
                      <pre className="text-[9px] text-[#8FA89B] bg-black/40 p-2 rounded mt-1 overflow-x-auto">
                        {e.stackTrace}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
