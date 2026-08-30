import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Search, Play, Pause, AlignLeft } from 'lucide-react';

export function SurahLibraryView() {
  const { chapters, playChapter, currentChapter, isPlaying, togglePlayPause } = usePlayer();
  const [search, setSearch] = useState('');

  const filteredChapters = chapters.filter(c => 
    c.name_simple.toLowerCase().includes(search.toLowerCase()) || 
    c.translated_name.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toString() === search
  );

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-14 space-y-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-4">Surah Library</h2>
          <p className="text-slate-400 text-lg font-light max-w-2xl">Browse the complete Noble Quran. Search by name or chapter number.</p>
        </div>
        
        <div className="relative group max-w-2xl">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search e.g. Al-Kahf or 18" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#11141A] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/30 focus:bg-[#161A22] transition-all text-lg shadow-inner"
          />
        </div>
      </header>

      <div className="bg-[#0D1017] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        {filteredChapters.map((chapter, index) => {
          const isCurrent = currentChapter?.id === chapter.id;
          
          return (
            <div 
              key={chapter.id}
              onClick={() => isCurrent ? togglePlayPause() : playChapter(chapter)}
              className={`flex items-center gap-6 p-6 cursor-pointer transition-all group ${
                index !== filteredChapters.length - 1 ? 'border-b border-white/5' : ''
              } ${
                isCurrent 
                  ? 'bg-amber-500/5' 
                  : 'hover:bg-white/[0.02]'
              }`}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all shadow-inner ${
                isCurrent ? 'bg-amber-500 text-[#0A0C10] shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'bg-[#151921] text-slate-400 group-hover:bg-[#1A1F29]'
              }`}>
                {isCurrent && isPlaying ? (
                  <Pause size={20} className="fill-current" />
                ) : isCurrent && !isPlaying ? (
                  <Play size={20} className="fill-current ml-1" />
                ) : (
                  <span className="font-medium text-sm">{chapter.id}</span>
                )}
              </div>
              
              <div className="flex-1 flex justify-between items-center">
                <div className="space-y-1">
                  <h4 className={`text-xl font-serif tracking-wide ${isCurrent ? 'text-amber-400' : 'text-slate-200 group-hover:text-white'}`}>
                    {chapter.name_simple}
                  </h4>
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-light">
                    <span>{chapter.translated_name.name}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span className="flex items-center gap-1.5"><AlignLeft size={14}/> {chapter.verses_count} Verses</span>
                  </div>
                </div>
                
                <div className="text-right pl-4">
                  <span className={`text-3xl font-arabic leading-relaxed ${isCurrent ? 'text-amber-500' : 'text-amber-500/80'}`}>
                    {chapter.name_arabic}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredChapters.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-[#151921] rounded-full flex items-center justify-center mx-auto mb-6 text-slate-600">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-medium text-slate-300 mb-2 font-serif">No results found</h3>
            <p className="text-slate-500 font-light">Try searching for a different surah name or number.</p>
          </div>
        )}
      </div>
    </div>
  );
}
