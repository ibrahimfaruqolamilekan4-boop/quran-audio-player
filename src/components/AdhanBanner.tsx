import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Square, Sparkles } from 'lucide-react';
import { adhanAudio, AdhanVoice } from '../lib/adhanAudio';

export function AdhanBanner() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPrayer, setCurrentPrayer] = useState<string | null>(null);
  const [currentVoice, setCurrentVoice] = useState<AdhanVoice | null>(null);

  useEffect(() => {
    const handleStateChange = () => {
      const state = adhanAudio.getPlaybackState();
      setIsPlaying(state.isPlaying);
      setCurrentPrayer(state.currentPrayer);
      setCurrentVoice(state.currentVoice);
    };

    window.addEventListener('nooraya-adhan-state-changed', handleStateChange);
    window.addEventListener('nooraya-adhan-started', handleStateChange);
    window.addEventListener('nooraya-adhan-ended', handleStateChange);

    handleStateChange();

    return () => {
      window.removeEventListener('nooraya-adhan-state-changed', handleStateChange);
      window.removeEventListener('nooraya-adhan-started', handleStateChange);
      window.removeEventListener('nooraya-adhan-ended', handleStateChange);
    };
  }, []);

  if (!isPlaying) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-2xl mx-auto animate-in slide-in-from-top-4 duration-300">
      <div className="bg-gradient-to-r from-[#061C14] via-[#092D20] to-[#04120D] border-2 border-emerald-400 rounded-3xl p-4 sm:p-5 shadow-[0_10px_40px_rgba(16,185,129,0.35)] flex items-center justify-between gap-4">
        {/* Pulsing Audio Animation */}
        <div className="flex items-center gap-3.5">
          <div className="relative w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
            <Volume2 size={22} className="animate-pulse text-emerald-300" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950">
                Adhan in Progress
              </span>
              {currentPrayer && (
                <span className="text-xs font-bold text-white capitalize">
                  {currentPrayer} Prayer
                </span>
              )}
            </div>

            <div className="text-xs sm:text-sm font-semibold text-emerald-100 mt-0.5 truncate">
              {currentVoice?.muezzin || currentVoice?.name_en || 'Prophet’s Mosque Voice'}
            </div>

            {currentVoice?.mosque && (
              <div className="text-[10px] text-emerald-400/80 truncate">
                {currentVoice.mosque}
              </div>
            )}
          </div>
        </div>

        {/* Silence / Stop Button */}
        <button
          type="button"
          onClick={() => adhanAudio.stop()}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-950/50 transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
        >
          <Square size={14} className="fill-white" />
          <span>Silence Adhan</span>
        </button>
      </div>
    </div>
  );
}
