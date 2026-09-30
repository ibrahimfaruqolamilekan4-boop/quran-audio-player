import React, { useState } from 'react';
import { Smartphone, Download, Share2, PlusSquare, X, CheckCircle2, ChevronRight, Apple } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallHeader: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running inside installed standalone PWA, no need to show install banner
  if (isInstalled) {
    return null;
  }

  if (isDismissed) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <button
          onClick={() => setIsDismissed(false)}
          className="flex items-center gap-2 bg-[#022c22]/90 hover:bg-[#044e3f] text-teal-300 border border-teal-500/40 text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md transition-all hover:scale-105"
          title="Open Install Menu"
        >
          <Download size={14} className="animate-bounce" />
          <span className="font-semibold">Install App</span>
        </button>
      </div>
    );
  }

  const handleAndroidInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 4000);
      }
    } else {
      setShowAndroidModal(true);
    }
  };

  return (
    <>
      {/* Top Banner / Bar */}
      <aside aria-label="Install App" className="sticky top-0 z-50 w-full bg-gradient-to-r from-[#031518]/95 via-[#022c22]/95 to-[#0b1b2b]/95 border-b border-teal-500/30 backdrop-blur-xl shadow-md text-slate-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Left: App Identity & PWA Perk */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <img 
                src="/pwa-192x192.png" 
                alt="Nooraya Icon" 
                className="w-8 h-8 rounded-lg shadow-md border border-teal-400/40 object-cover" 
              />
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold text-white text-xs sm:text-sm tracking-wide">Nooraya</span>
                <span className="bg-teal-500/20 text-teal-300 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-teal-500/30">
                  Real PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-300 hidden md:block truncate">
                Install on your home screen for full-screen audio, offline listening & prayer reminders
              </p>
            </div>
          </div>

          {/* Right: The requested Android & iPhone symbols & actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap ml-auto">
            
            {/* Symbol 1: Android Phone Install */}
            <button
              onClick={handleAndroidInstallClick}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
                isAndroid
                  ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold ring-2 ring-teal-300/40 animate-pulse'
                  : 'bg-emerald-600/30 hover:bg-emerald-600/45 text-emerald-200 border border-emerald-500/40'
              }`}
              title="Install app on Android phone or Chrome"
            >
              <Smartphone size={15} className="text-current" />
              <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
              <span>Install for Android</span>
            </button>

            {/* Symbol 2: iPhone Add to Screen */}
            <button
              onClick={() => setShowIOSModal(true)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
                isIOS
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold ring-2 ring-sky-300/40 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-sky-200 border border-sky-500/30'
              }`}
              title="Add app to home screen on iPhone / iPad"
            >
              <Apple size={15} className="text-current" />
              <PlusSquare size={14} className="group-hover:scale-110 transition-transform text-sky-300" />
              <span>iPhone Add to Screen</span>
            </button>

            {/* Dismiss banner */}
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title="Hide banner"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Success Banner when installed */}
      {installSuccess && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 text-sm font-medium">
          <CheckCircle2 size={18} />
          <span>Nooraya installed successfully! You can now launch it from your home screen.</span>
        </div>
      )}

      {/* iPhone "Add to Screen" Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[#090d16] border border-teal-500/30 p-6 shadow-2xl text-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-teal-500 p-0.5 shadow-lg flex items-center justify-center">
                  <img src="/apple-touch-icon.png" alt="Nooraya" className="w-full h-full rounded-[14px] object-cover" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Apple size={18} className="text-slate-100" />
                    Install on iPhone / iPad
                  </h3>
                  <p className="text-xs text-teal-300">Add to Home Screen via Safari</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Apple requires installing PWAs through Safari in just 2 simple taps:
            </p>

            <div className="space-y-3.5 mb-6">
              {/* Step 1 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-teal-500/40">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white mb-0.5 flex items-center gap-1.5">
                    Tap the Share button
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/30">
                      <Share2 size={13} />
                    </span>
                  </p>
                  <p className="text-slate-400">
                    Located in the bottom Safari toolbar (or top right on iPad).
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-teal-500/40">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white mb-0.5 flex items-center gap-1.5">
                    Select "Add to Home Screen"
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-teal-500/20 text-teal-400 border border-teal-500/30">
                      <PlusSquare size={13} />
                    </span>
                  </p>
                  <p className="text-slate-400">
                    Scroll down the share sheet and tap <span className="text-white font-medium">Add to Home Screen</span>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-teal-500/40">
                  3
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white mb-0.5">
                    Tap "Add" in Top Right
                  </p>
                  <p className="text-slate-400">
                    Nooraya will install right on your iOS home screen with no Safari browser bars!
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/30 text-[11px] text-teal-200/90 mb-5 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-teal-400 flex-shrink-0" />
              <span>Full audio background playback, offline caching, and instant launch.</span>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all"
            >
              Got it, let's do it!
            </button>
          </div>
        </div>
      )}

      {/* Android / Chrome Manual Guide Modal (if prompt is deferred or suppressed by browser) */}
      {showAndroidModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[#090d16] border border-teal-500/30 p-6 shadow-2xl text-slate-200 relative overflow-hidden">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-lg flex items-center justify-center">
                  <img src="/pwa-192x192.png" alt="Nooraya" className="w-full h-full rounded-[14px] object-cover" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Smartphone size={18} className="text-emerald-400" />
                    Install on Android / Chrome
                  </h3>
                  <p className="text-xs text-teal-300">Quick 1-step install</p>
                </div>
              </div>
              <button
                onClick={() => setShowAndroidModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 mb-6">
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-teal-500/40">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white mb-0.5">
                    Tap the 3 dots menu <span className="font-mono text-slate-300">⋮</span> in Chrome / Samsung Internet
                  </p>
                  <p className="text-slate-400">
                    Located in the top-right or bottom toolbar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-teal-500/40">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white mb-0.5 flex items-center gap-1.5">
                    Select "Install App" or "Add to Home screen"
                    <Download size={13} className="text-teal-400" />
                  </p>
                  <p className="text-slate-400">
                    Tap Install and Nooraya will be added to your app drawer and home screen.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAndroidModal(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
