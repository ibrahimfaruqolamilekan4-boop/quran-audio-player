import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X } from 'lucide-react';
import type { Chapter, Reciter } from '../../types';

interface AyahReaderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  reciter: Reciter | null;
}

export function AyahReaderSheet({
  isOpen,
  onClose,
  chapter,
  reciter,
}: AyahReaderSheetProps) {
  if (!isOpen || !chapter) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed inset-x-0 bottom-0 z-[100] bg-[#06150F] border-t border-white/15 rounded-t-[2.5rem] p-6 max-h-[70vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen size={16} className="text-teal-400" />
            <span>
              Surah {chapter.name_simple} • {chapter.name_arabic}
            </span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Close reader"
            className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-center py-6 space-y-4">
          <span className="font-arabic text-4xl text-amber-300 leading-[2.2] block dir-rtl">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </span>
          <p className="text-sm text-slate-300 font-light italic max-w-md mx-auto">
            In the name of Allah, the Entirely Merciful, the Especially Merciful.
          </p>
          <p className="text-xs text-slate-500 pt-4">
            Recited by {reciter?.name} ({reciter?.style})
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
