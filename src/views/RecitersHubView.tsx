import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { CURATED_RECITERS } from '../lib/constants';
import { Check, Search, MapPin, Play, Mic2, Settings } from 'lucide-react';

export function RecitersHubView() {
  const { currentReciter, setReciter, chapters, playChapter, customReciters } = usePlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReciter, setSelectedReciter] = useState<string | null>(null);

  const allReciters = [...CURATED_RECITERS, ...customReciters];

  const filteredReciters = allReciters.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.region?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.style.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const regions = Array.from(new Set(filteredReciters.map(r => r.region || 'Custom/Global')));

  if (selectedReciter) {
    const reciter = allReciters.find(r => r.id === selectedReciter);
    if (!reciter) return null;

    return (
      <div className="animate-in slide-in-from-right-8 duration-500 pb-20">
        <button 
          onClick={() => setSelectedReciter(null)}
          className="text-slate-400 hover:text-white mb-8 text-sm flex items-center gap-2 transition-colors"
        >
          &larr; Back to Reciters
        </button>

        <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-[2rem] bg-gradient-to-br from-[#0F172A] to-[#020617] border border-teal-900/30 flex items-center justify-center shrink-0 overflow-hidden shadow-2xl relative group">
            <Mic2 size={48} className="text-slate-700 opacity-50" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  setReciter(reciter);
                  if (chapters[0]) playChapter(chapters[0]);
                }}
                className="w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(20,184,166,0.4)] transform scale-90 group-hover:scale-100 transition-all"
              >
                <Play size={24} className="fill-current ml-1" />
              </button>
            </div>
          </div>
          <div>
            <div className="flex gap-2 mb-4">
              <span className="px-3 py-1 bg-teal-500/10 text-teal-400 rounded-full text-xs font-medium border border-teal-500/20 tracking-wide">
                {reciter.style}
              </span>
              <span className="px-3 py-1 bg-slate-800/50 text-slate-300 rounded-full text-xs font-medium border border-slate-700 tracking-wide">
                {reciter.region || 'Custom'}
              </span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-3">{reciter.name}</h2>
            {reciter.location && (
              <p className="text-slate-400 font-light flex items-center gap-2">
                <MapPin size={16} /> {reciter.location}
              </p>
            )}

            <div className="mt-8">
              <button 
                onClick={() => setReciter(reciter)}
                className={`px-8 py-3 rounded-2xl font-medium transition-all shadow-lg ${
                  currentReciter?.id === reciter.id 
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-teal-500/10' 
                    : 'bg-white text-black hover:bg-slate-200'
                }`}
              >
                {currentReciter?.id === reciter.id ? 'Currently Selected' : 'Set as Active Reciter'}
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
                className="group flex items-center justify-between p-4 rounded-2xl bg-[#0F172A]/40 border border-slate-800/50 hover:bg-[#1E293B]/60 hover:border-slate-700 transition-all cursor-pointer text-slate-300"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono opacity-40 group-hover:opacity-100 transition-opacity">{String(chapter.id).padStart(3, '0')}</span>
                  <div className="flex flex-col">
                    <span className="font-serif text-base group-hover:text-teal-400 transition-colors">{chapter.name_simple}</span>
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
      <header className="mb-12 space-y-8 sticky top-0 bg-[#030712]/80 backdrop-blur-3xl pt-6 pb-6 z-20 border-b border-slate-800/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Reciters</h2>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text"
              placeholder="Search by name, region..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0F172A]/50 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors"
            />
          </div>
        </div>
      </header>

      {regions.map(region => {
        const regionReciters = filteredReciters.filter(r => (r.region || 'Custom/Global') === region);
        if (regionReciters.length === 0) return null;

        return (
          <div key={region} className="mb-14">
            <h3 className="text-sm font-semibold text-slate-500 mb-6 uppercase tracking-[0.2em] pl-2 flex items-center gap-3">
              {region}
              <div className="h-px bg-slate-800 flex-1 ml-4" />
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {regionReciters.map((reciter) => {
                const isSelected = currentReciter?.id === reciter.id;
                
                return (
                  <button
                    key={reciter.id}
                    onClick={() => setSelectedReciter(reciter.id)}
                    className="flex flex-col items-center group text-center"
                  >
                    <div className={`relative w-28 h-28 md:w-32 md:h-32 rounded-full mb-5 flex items-center justify-center transition-all duration-500 ${
                      isSelected 
                        ? 'bg-teal-500/10 border-2 border-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.15)] scale-105'
                        : 'bg-[#0F172A] border border-slate-800 group-hover:border-slate-600 group-hover:scale-105'
                    }`}>
                      <Mic2 size={32} className={isSelected ? 'text-teal-400' : 'text-slate-600'} />
                      
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 bg-teal-500 text-black p-1.5 rounded-full shadow-lg">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    
                    <h4 className={`text-base font-serif tracking-wide transition-colors leading-snug ${
                      isSelected ? 'text-teal-400 font-semibold' : 'text-slate-300 group-hover:text-white'
                    }`}>
                      {reciter.name}
                    </h4>
                    <span className="text-xs text-slate-500 mt-1 opacity-80">{reciter.style}</span>
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
