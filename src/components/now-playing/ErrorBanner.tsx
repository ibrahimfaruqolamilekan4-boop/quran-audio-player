import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBannerProps {
  error: string | null;
  onTogglePlayPause: () => void;
  onSwitchSheikh: () => void;
}

export function ErrorBanner({
  error,
  onTogglePlayPause,
  onSwitchSheikh,
}: ErrorBannerProps) {
  if (!error) return null;

  const isGestureError = error.includes('browser needs a gesture');

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#2A1905] border border-amber-500/40 text-amber-200 text-xs shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle size={16} className="text-amber-400 shrink-0" />
        <span className="truncate">{error}</span>
      </div>

      {isGestureError ? (
        <button
          type="button"
          onClick={onTogglePlayPause}
          className="px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs shrink-0 cursor-pointer transition-colors shadow-sm"
        >
          Tap to Play
        </button>
      ) : (
        <button
          type="button"
          onClick={onSwitchSheikh}
          className="px-3 py-1 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs shrink-0 cursor-pointer transition-colors shadow-sm"
        >
          Try Another Sheikh
        </button>
      )}
    </div>
  );
}
