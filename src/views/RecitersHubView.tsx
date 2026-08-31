import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { CURATED_RECITERS } from '../lib/constants';
import { Check, Search, MapPin, Play, Mic2 } from 'lucide-react';

export function RecitersHubView() {
  const { currentReciter, setReciter, chapters, playChapter } = usePlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReciter, setSelectedReciter] = useState<string | null>(null);

  const filteredReciters = CURATED_RECITERS.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.region?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const regions = Array.from(new Set(filteredReciters.map(r => r.region || 'Global')));

  if (selectedReciter) {
    const reciter = CURATED_RECITERS.find(r => r.id === selectedReciter);
    if (!reciter) return null;

    return (
      <div className="animate-in slide-in-from-right-8 duration-500 pb-20">
        <button 
          onClick={() => setSelectedReciter(null)}
          className="text-slate-400 hover:text-white mb-8 text-sm flex items-center gap-2"
        >
          &larr; Back to Reciters
        </button>

        <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-[#1A1F29] to-[#0A0C10] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-2xl relative group">
            <Mic2 size={48} className="text-slate-600 opacity-50" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  setReciter(reciter);
                  if (chapters[0]) playChapter(chapters[0]);
                }}
                className="w-14 h-14 bg-gold-500 rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(226,183,83,0.5)] transform scale-90 group-hover:scale-100 transition-all"
              >
                <Play size={24} className="fill-current ml-1" />
              </button>
            </div>
          </div>
          <div>
            <span className="px-3 py-1 bg-[#1A1F29] text-slate-300 rounded-full text-xs font-medium border border-white/5 mb-4 inline-block tracking-wide">
              {reciter.region}
            </span>
            <h2 className="text-4xl md:text-6xl font-serif text-white tracking-tight mb-4">{reciter.name}</h2>
            <p className="text-slate-400 font-light flex items-center gap-2">
              <MapPin size={16} /> {reciter.location}
            </p>
            <div className="mt-6">
              <button 
                onClick={() => setReciter(reciter)}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                  currentReciter?.id === reciter.id 
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30' 
                    : 'bg-white text-black hover:bg-slate-200'
                }`}
              >
                {currentReciter?.id === reciter.id ? 'Currently Selected' : 'Set as Active Qari'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-medium text-white mb-6 tracking-wide">114 Surahs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {chapters.map(chapter => (
              <div 
                key={chapter.id}
                onClick={() => {
                  setReciter(reciter);
                  playChapter(chapter);
                }}
                className="group flex items-center justify-between p-4 rounded-2xl bg-[#11141A]/50 border border-white/5 hover:bg-[#151921] hover:border-white/10 transition-all cursor-pointer text-slate-300"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono opacity-50">{chapter.id}.</span>
                  <div className="flex flex-col">
                    <span className="font-serif text-base group-hover:text-white transition-colors">{chapter.name_simple}</span>
                    <span className="text-xs text-slate-500">{chapter.translated_name.name}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play size={14} className="text-white fill-current ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-700">
      <header className="mb-14 space-y-8 sticky top-0 bg-[#0A0C10]/90 backdrop-blur-3xl pt-6 pb-6 z-20 border-b border-white/5">
        <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Qaris & Imams</h2>
        
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Search reciters by name, country, or style..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#11141A] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50 transition-colors"
          />
        </div>
      </header>

      {regions.map(region => {
        const regionReciters = filteredReciters.filter(r => (r.region || 'Global') === region);
        if (regionReciters.length === 0) return null;

        return (
          <div key={region} className="mb-12">
            <h3 className="text-lg font-medium text-slate-400 mb-6 uppercase tracking-widest pl-2">From {region}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {regionReciters.map((reciter) => {
                const isSelected = currentReciter?.id === reciter.id;
                
                return (
                  <button
                    key={reciter.id}
                    onClick={() => setSelectedReciter(reciter.id)}
                    className="flex flex-col items-center group text-center"
                  >
                    <div className={`relative w-28 h-28 md:w-32 md:h-32 rounded-full mb-4 flex items-center justify-center transition-all duration-500 ${
                      isSelected 
                        ? 'bg-gold-500/20 border-2 border-gold-400 shadow-[0_0_30px_rgba(226,183,83,0.2)] scale-105'
                        : 'bg-[#151921] border border-white/5 group-hover:border-white/20 group-hover:scale-105'
                    }`}>
                      <Mic2 size={32} className={isSelected ? 'text-gold-400' : 'text-slate-600'} />
                      
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 bg-gold-500 text-black p-1.5 rounded-full shadow-lg">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    
                    <h4 className={`text-base font-serif tracking-wide transition-colors ${
                      isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'
                    }`}>
                      {reciter.name}
                    </h4>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
