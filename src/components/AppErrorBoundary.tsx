import React from 'react';
import { AlertTriangle, RefreshCw, Activity } from 'lucide-react';
import { recordDiagEvent, uploadDiagReportToSupport } from '../lib/prodDiagnostics';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  reportedId: string | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  declare setState: (partial: Partial<State> | ((prevState: State) => Partial<State>)) => void;

  state: State = {
    hasError: false,
    errorMessage: '',
    reportedId: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    recordDiagEvent({
      category: 'error',
      event: 'REACT_ERROR_BOUNDARY_CAUGHT',
      elementId: 'system',
      errorMessage: error?.message || String(error),
      stack: `${(error?.stack || '').slice(0, 400)} | componentStack: ${(info?.componentStack || '').slice(0, 300)}`,
    });

    void uploadDiagReportToSupport(`Auto-crash report: ${error?.message || 'unknown'}`).then(
      (res) => {
        if (res.ok && res.reportId) {
          this.setState({ reportedId: res.reportId });
        }
      }
    );
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#06150F] text-[#F6F1E4] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#0C2A20] border border-[#E5675B]/40 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E5675B]/15 border border-[#E5675B]/40 flex items-center justify-center text-[#E5675B]">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-xl font-serif font-bold text-[#F6F1E4]">
            Something interrupted the player
          </h1>
          <p className="text-xs text-[#D1DFD8] leading-relaxed">
            A diagnostics snapshot was saved locally. You can reload safely or inspect the diagnostic log.
          </p>
          <div className="bg-[#06150F] border border-white/10 rounded-xl p-3 text-xs font-mono text-[#E5675B] break-words">
            {this.state.errorMessage}
          </div>
          {this.state.reportedId && (
            <p className="text-[11px] font-mono text-[#34C38F]">
              Crash report ID: {this.state.reportedId}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const r of regs) {
                      await r.unregister();
                    }
                  }
                  if (typeof window !== 'undefined' && 'caches' in window) {
                    const keys = await caches.keys();
                    for (const k of keys) {
                      await caches.delete(k);
                    }
                  }
                } catch {}
                const target = window.location.origin + window.location.pathname + '?reload=' + Date.now();
                window.location.replace(target);
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#1F8A6A] hover:bg-[#27A37E] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Reload App</span>
            </button>
            <a
              href="/diag"
              className="py-2.5 px-4 rounded-xl bg-[#11382B] hover:bg-[#176B53] text-[#F6F1E4] border border-white/10 text-xs font-bold flex items-center justify-center gap-2"
            >
              <Activity size={14} />
              <span>Open /diag</span>
            </a>
          </div>
        </div>
      </div>
    );
  }
}
