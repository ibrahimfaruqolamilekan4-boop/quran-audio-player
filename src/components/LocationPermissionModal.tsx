import React from 'react';
import { MapPin, Compass, ShieldCheck, X } from 'lucide-react';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  onSelectManual: () => void;
}

export function LocationPermissionModal({
  isOpen,
  onConfirm,
  onDismiss,
  onSelectManual,
}: LocationPermissionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#091E16] via-[#05140F] to-[#030B08] border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(16,185,129,0.15)] text-left">
        {/* Close Button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-300 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/60 mb-4 inline-flex items-center justify-center">
          <div className="w-full h-full bg-[#05140F] rounded-[14px] flex items-center justify-center gap-1">
            <Compass size={22} className="text-emerald-400" />
            <MapPin size={18} className="text-teal-300 -ml-1.5" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-2">
          Astronomical Location Access
        </h3>
        
        {/* Description */}
        <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed mb-4">
          Nooraya needs your device location to compute precision solar coordinates for your 
          five daily prayer times and align the 3D Qibla needle accurately towards the Holy Kaaba.
        </p>

        {/* Privacy Callout */}
        <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-800/50 flex items-start gap-3 mb-6">
          <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200/90 leading-snug">
            <span className="font-semibold text-white block mb-0.5">Strict Device Privacy</span>
            Your GPS coordinates are calculated locally on this device. They are never sent to 
            or stored on our servers unless you opt in to Push Notifications.
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Compass size={17} />
            <span>Enable Automatic GPS Location</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDismiss();
              onSelectManual();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-emerald-950/40 text-emerald-300 text-xs font-semibold transition-all text-center cursor-pointer"
          >
            Select My City Manually Instead
          </button>
        </div>
      </div>
    </div>
  );
}
