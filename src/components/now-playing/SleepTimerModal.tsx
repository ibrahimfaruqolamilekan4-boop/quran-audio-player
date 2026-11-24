import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, X, Check, Lock, Sparkles } from 'lucide-react';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMinutes: number | null;
  onSelectMinutes: (minutes: number | null) => void;
  isPremium?: boolean;
  onRequireUpgrade?: (reason?: string) => void;
}

export function SleepTimerModal({
  isOpen,
  onClose,
  selectedMinutes,
  onSelectMinutes,
  isPremium = false,
  onRequireUpgrade,
}: SleepTimerModalProps) {
  if (!isOpen) return null;

  const handleOptionClick = (mins: number) => {
    if (!isPremium) {
      onClose();
      onRequireUpgrade?.(
        'Sleep Timer is an exclusive Nooraya Premium feature (₦500 / month). Upgrade to set custom timers and fall asleep peacefully to Quranic recitation.'
      );
      return;
    }
    onSelectMinutes(mins);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-[#0B0F19] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Moon size={18} className="text-teal-400" />
              <span>Sleep Timer</span>
            </h3>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white cursor-pointer"
              aria-label="Close sleep timer modal"
            >
              <X size={18} />
            </button>
          </div>

          {!isPremium && (
            <div className="p-3 mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200">
              <Sparkles size={16} className="text-amber-400 shrink-0" />
              <span>
                Sleep timer is a <strong>Premium feature (₦500)</strong>. Tap any option to unlock.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {[15, 30, 45, 60].map((mins) => {
              const isSelected = selectedMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleOptionClick(mins)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-white/[0.02] text-slate-300 border-white/[0.06] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{mins} minutes</span>
                    {!isPremium && <Lock size={12} className="text-amber-400" />}
                  </div>
                  {isSelected && <Check size={16} />}
                </button>
              );
            })}

            {selectedMinutes !== null && (
              <button
                type="button"
                onClick={() => onSelectMinutes(null)}
                className="w-full text-center px-4 py-2.5 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mt-2 cursor-pointer"
              >
                Turn off sleep timer
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
