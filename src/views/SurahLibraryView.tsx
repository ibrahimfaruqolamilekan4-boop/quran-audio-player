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
      <header className="mb-12 space-y-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">Surah Library</h2>
          <p className="text-slate-400 text-lg">Browse the complete Noble Quran. Search by name or chapter number.</p>
        </div>
        
        <div className="relative group max-w-2xl">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search e.g. Al-Kahf or 18" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl py-4 pl-14 pr-6 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all text-lg shadow-inner"
          />
        </div>
      </header>

      <div className="bg-slate-900/20 rounded-3xl border border-white/5 overflow-hidden">
        {filteredChapters.map((chapter, index) => {
          const isCurrent = currentChapter?.id === chapter.id;
          
          return (
            <div 
              key={chapter.id}
              onClick={() => isCurrent ? togglePlayPause() : playChapter(chapter)}
              className={`flex items-center gap-6 p-5 cursor-pointer transition-all group ${
                index !== filteredChapters.length - 1 ? 'border-b border-slate-800/50' : ''
              } ${
                isCurrent 
                  ? 'bg-emerald-900/10' 
                  : 'hover:bg-slate-800/40'
              }`}
            >
              <div className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all shadow-inner ${
                isCurrent ? 'bg-emerald-500 text-black shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
              }`}>
                {isCurrent && isPlaying ? (
                  <Pause size={22} className="fill-current" />
                ) : isCurrent && !isPlaying ? (
                  <Play size={22} className="fill-current ml-1" />
                ) : (
                  <span className="font-semibold text-lg">{chapter.id}</span>
                )}
              </div>
              
              <div className="flex-1 flex justify-between items-center">
                <div className="space-y-1">
                  <h4 className={`text-xl font-semibold tracking-tight ${isCurrent ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'}`}>
                    {chapter.name_simple}
                  </h4>
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                    <span>{chapter.translated_name.name}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span className="flex items-center gap-1.5"><AlignLeft size={14}/> {chapter.verses_count} Verses</span>
                  </div>
                </div>
                
                <div className="text-right pl-4">
                  <span className={`text-3xl leading-relaxed ${isCurrent ? 'text-emerald-500' : 'text-slate-300'}`} style={{ fontFamily: 'sans-serif' }}>
                    {chapter.name_arabic}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredChapters.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-500">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-medium text-slate-300 mb-2">No results found</h3>
            <p className="text-slate-500">Try searching for a different surah name or number.</p>
          </div>
        )}
      </div>
    </div>
  );
}
