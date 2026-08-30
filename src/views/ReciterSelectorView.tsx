import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { CURATED_RECITERS } from '../lib/constants';
import { Check, Mic2, MapPin } from 'lucide-react';

export function ReciterSelectorView() {
  const { currentReciter, setReciter } = usePlayer();

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-14 space-y-4">
        <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Qaris & Imams</h2>
        <p className="text-slate-400 text-lg font-light max-w-2xl">
          Listen to world-renowned reciters from the Grand Mosques and across the globe. Seamlessly switch reciters without losing your focus.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CURATED_RECITERS.map((reciter) => {
          const isSelected = currentReciter?.id === reciter.id;
          const isMecca = reciter.location?.includes('Mecca');
          const isMedina = reciter.location?.includes('Medina');
          
          return (
            <button
              key={reciter.id}
              onClick={() => setReciter(reciter)}
              className={`relative text-left rounded-3xl p-8 transition-all duration-500 group border overflow-hidden shadow-xl ${
                isSelected 
                  ? 'bg-[#15120B] border-gold-500/40 shadow-[0_0_40px_rgba(226,183,83,0.1)] scale-[1.02]' 
                  : 'bg-[#11141A] border-white/5 hover:border-white/10 hover:bg-[#151921]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 p-6">
                  <div className="bg-gold-500 text-black p-1.5 rounded-full shadow-lg">
                    <Check size={16} strokeWidth={3} />
                  </div>
                </div>
              )}
              
              <div className="flex flex-col h-full justify-between gap-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  isSelected ? 'bg-gold-500/10 text-gold-400 shadow-inner' : 'bg-black/30 text-slate-500 group-hover:text-slate-300'
                }`}>
                  <Mic2 size={24} strokeWidth={1.5} />
                </div>
                
                <div>
                  <h4 className={`text-2xl font-serif tracking-wide mb-4 transition-colors ${
                    isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'
                  }`}>
                    {reciter.name}
                  </h4>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-3 py-1.5 rounded-lg bg-black/40 text-slate-300 font-medium border border-white/5 tracking-wide">
                      {reciter.style}
                    </span>
                    
                    {reciter.location && (
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium border tracking-wide ${
                        isMecca || isMedina
                          ? 'bg-gold-500/10 text-gold-400 border-gold-500/20'
                          : 'bg-black/40 text-slate-400 border-white/5'
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
