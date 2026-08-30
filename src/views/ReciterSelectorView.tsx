import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { CURATED_RECITERS } from '../lib/constants';
import { Check, Mic2, MapPin } from 'lucide-react';

export function ReciterSelectorView() {
  const { currentReciter, setReciter } = usePlayer();

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-12 space-y-3">
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Qaris & Imams</h2>
        <p className="text-slate-400 text-lg max-w-xl">
          Listen to world-renowned reciters from the Grand Mosques and across the globe. Seamlessly switch reciters without losing your focus.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CURATED_RECITERS.map((reciter) => {
          const isSelected = currentReciter?.id === reciter.id;
          const isMecca = reciter.location?.includes('Mecca');
          const isMedina = reciter.location?.includes('Medina');
          
          return (
            <button
              key={reciter.id}
              onClick={() => setReciter(reciter)}
              className={`relative text-left rounded-2xl p-6 transition-all duration-300 group border overflow-hidden ${
                isSelected 
                  ? 'bg-gradient-to-br from-emerald-900/40 to-slate-900/60 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 p-4">
                  <div className="bg-emerald-500 text-black p-1 rounded-full shadow-lg">
                    <Check size={16} strokeWidth={3} />
                  </div>
                </div>
              )}
              
              <div className="flex flex-col h-full justify-between gap-6">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                }`}>
                  <Mic2 size={24} strokeWidth={1.5} />
                </div>
                
                <div>
                  <h4 className={`text-xl font-semibold mb-2 transition-colors ${
                    isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                  }`}>
                    {reciter.name}
                  </h4>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 font-medium border border-white/5">
                      {reciter.style}
                    </span>
                    
                    {reciter.location && (
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                        isMecca 
                          ? 'bg-amber-900/20 text-amber-400 border-amber-500/20' 
                          : isMedina
                            ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-800/50 text-slate-400 border-white/5'
                      }`}>
                        <MapPin size={12} />
                        {reciter.location.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
