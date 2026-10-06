import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Sunset, 
  Moon, 
  Clock, 
  Sparkles, 
  RotateCcw, 
  Check, 
  Copy, 
  Volume2, 
  BookOpen, 
  Heart,
  ChevronRight,
  Info
} from 'lucide-react';
import { AZKAR_CATEGORIES, AZKAR_ITEMS, type AzkarItem, type AzkarCategory } from '../lib/azkar';

export function AzkarView() {
  // Automatically choose default category based on time of day
  const defaultCategory = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 20) return 'evening';
    return 'sleep';
  };

  const [activeCategory, setActiveCategory] = useState<AzkarCategory['id']>(defaultCategory);
  
  // Track counts for each zikr: { [zikrId]: currentCount }
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('nooraya:azkar_counts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);

  // Persist counts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nooraya:azkar_counts', JSON.stringify(counts));
    } catch {
      /* ignore */
    }
  }, [counts]);

  const items = AZKAR_ITEMS.filter(item => item.category === activeCategory);
  const currentCategoryMeta = AZKAR_CATEGORIES.find(c => c.id === activeCategory) || AZKAR_CATEGORIES[0];

  const handleTap = (item: AzkarItem) => {
    const current = counts[item.id] || 0;
    if (current >= item.repeat) return; // already completed
    
    // Haptic feedback for mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(25); } catch {}
    }

    setCounts(prev => ({
      ...prev,
      [item.id]: (prev[item.id] || 0) + 1,
    }));
  };

  const handleResetItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCounts(prev => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
  };

  const handleResetCategory = () => {
    setCounts(prev => {
      const updated = { ...prev };
      items.forEach(it => {
        delete updated[it.id];
      });
      return updated;
    });
  };

  const handleCopy = (item: AzkarItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${item.arabic}\n\n${item.transliteration}\n\n${item.translation}\n\n[${item.reference || 'Daily Azkar'}]`;
    navigator.clipboard?.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (arabicText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(arabicText);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Completion calculation for current category
  const completedCount = items.filter(it => (counts[it.id] || 0) >= it.repeat).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-28">
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-widest mb-1.5">
            <Sparkles size={14} />
            <span>Remembrance of Allah • أذكار المسلم</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-white tracking-wide flex items-baseline gap-3">
            <span>Daily Azkar</span>
            <span className="text-2xl md:text-3xl font-arabic text-teal-300 font-normal">الأذكار اليومية</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl font-light">
            “Verily, in the remembrance of Allah do hearts find rest.” (Surah Ar-Ra'd 13:28).
            Nourish your soul with authentic morning, evening, prayer, and bedtime supplications.
          </p>
        </div>

        {/* View Options Toggle */}
        <div className="flex items-center gap-2 bg-[#0A0F1C] border border-slate-800 rounded-2xl p-1.5 self-start md:self-auto">
          <button
            onClick={() => setShowTransliteration(!showTransliteration)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              showTransliteration ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Phonetics
          </button>
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              showTranslation ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            English
          </button>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {AZKAR_CATEGORIES.map(category => {
          const isSelected = activeCategory === category.id;
          const catItems = AZKAR_ITEMS.filter(it => it.category === category.id);
          const catCompleted = catItems.filter(it => (counts[it.id] || 0) >= it.repeat).length;
          const isAllDone = catItems.length > 0 && catCompleted === catItems.length;

          const getCategoryIcon = () => {
            switch (category.id) {
              case 'morning': return <Sun size={20} className={isSelected ? 'text-amber-400' : 'text-slate-400'} />;
              case 'evening': return <Sunset size={20} className={isSelected ? 'text-orange-400' : 'text-slate-400'} />;
              case 'after-prayer': return <Clock size={20} className={isSelected ? 'text-teal-400' : 'text-slate-400'} />;
              case 'sleep': return <Moon size={20} className={isSelected ? 'text-indigo-400' : 'text-slate-400'} />;
              default: return <Sparkles size={20} className={isSelected ? 'text-emerald-400' : 'text-slate-400'} />;
            }
          };

          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex flex-col text-left p-4 rounded-2xl border transition-all relative overflow-hidden group cursor-pointer ${
                isSelected 
                  ? 'bg-[#0E1528] border-teal-500/50 shadow-xl shadow-teal-500/10' 
                  : 'bg-[#0A0F1C]/70 border-slate-800/80 hover:border-slate-700 hover:bg-[#0D1424]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`p-2 rounded-xl ${isSelected ? 'bg-teal-500/15' : 'bg-slate-800/50'}`}>
                  {getCategoryIcon()}
                </div>
                {isAllDone && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/40">
                    <Check size={10} /> Done
                  </span>
                )}
              </div>
              <h3 className={`font-semibold text-sm truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                {category.name}
              </h3>
              <p className="text-[11px] text-teal-400/90 font-arabic mt-0.5">{category.nameArabic}</p>
              <span className="text-[10px] text-slate-500 mt-2">
                {catCompleted}/{catItems.length} completed
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress & Quick Controls Bar */}
      <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              {currentCategoryMeta.name} Progress
            </span>
            <span className="text-teal-400 font-bold">{completedCount} of {items.length} completed ({progressPercent}%)</span>
          </div>
          <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 pt-0.5">{currentCategoryMeta.description}</p>
        </div>

        {completedCount > 0 && (
          <button
            onClick={handleResetCategory}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 transition-colors self-start sm:self-auto shrink-0"
          >
            <RotateCcw size={13} />
            <span>Reset {currentCategoryMeta.name}</span>
          </button>
        )}
      </section>

      {/* Azkar Items List */}
      <div className="space-y-5">
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => {
            const count = counts[item.id] || 0;
            const isCompleted = count >= item.repeat;
            const remaining = Math.max(0, item.repeat - count);

            return (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
                onClick={() => handleTap(item)}
                className={`p-6 rounded-3xl border transition-all duration-300 select-none cursor-pointer relative overflow-hidden ${
                  isCompleted
                    ? 'bg-[#081216]/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                    : 'bg-[#0A0F1C]/90 hover:bg-[#0E1528] border-slate-800/80 hover:border-slate-700 shadow-md'
                }`}
              >
                {/* Top Bar inside Card */}
                <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-bold flex items-center justify-center border border-teal-500/20">
                      {index + 1}
                    </span>
                    {item.reference && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        {item.reference}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Pronounce audio button */}
                    <button
                      onClick={(e) => handleSpeak(item.arabic, e)}
                      title="Listen to Arabic recitation"
                      className="p-2 rounded-xl text-slate-400 hover:text-teal-300 hover:bg-slate-800/60 transition-colors"
                    >
                      <Volume2 size={16} />
                    </button>

                    {/* Copy text button */}
                    <button
                      onClick={(e) => handleCopy(item, e)}
                      title="Copy Arabic & English translation"
                      className="p-2 rounded-xl text-slate-400 hover:text-teal-300 hover:bg-slate-800/60 transition-colors"
                    >
                      {copiedId === item.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>

                    {/* Reset single zikr button if started */}
                    {count > 0 && (
                      <button
                        onClick={(e) => handleResetItem(item.id, e)}
                        title="Reset count"
                        className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 transition-colors"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Arabic Text */}
                <div className="my-4 text-right">
                  <p 
                    className="text-2xl sm:text-3xl lg:text-4xl leading-[1.8] sm:leading-[2.1] font-serif text-white font-normal tracking-wide text-right"
                    dir="rtl"
                  >
                    {item.arabic}
                  </p>
                </div>

                {/* Transliteration */}
                {showTransliteration && (
                  <div className="mt-4 pt-3 border-t border-slate-800/40">
                    <p className="text-xs sm:text-sm text-teal-300/90 font-light italic leading-relaxed">
                      {item.transliteration}
                    </p>
                  </div>
                )}

                {/* English Translation */}
                {showTranslation && (
                  <div className="mt-3">
                    <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
                      {item.translation}
                    </p>
                  </div>
                )}

                {/* Virtue Box if available */}
                {item.virtue && (
                  <div className="mt-4 bg-teal-500/5 border border-teal-500/15 rounded-2xl p-3 flex items-start gap-2.5">
                    <Info size={15} className="text-teal-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-teal-200/90 leading-relaxed">
                      <span className="font-semibold text-teal-300">Virtue: </span>
                      {item.virtue}
                    </p>
                  </div>
                )}

                {/* Action Counter Bottom Bar */}
                <div className="mt-6 pt-4 border-t border-slate-800/70 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Target: <strong className="text-white">{item.repeat}x</strong>
                  </span>

                  {/* Tap Button with Counter State */}
                  <div className="flex items-center gap-3">
                    {isCompleted ? (
                      <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs shadow-lg shadow-emerald-500/10">
                        <Check size={16} className="text-emerald-400" />
                        <span>Completed ({item.repeat}/{item.repeat})</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTap(item);
                        }}
                        className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-xl shadow-teal-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <span>Tap to Count</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-950/20 text-slate-900 font-black text-xs">
                          {count} / {item.repeat}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AzkarView;
