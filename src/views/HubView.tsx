import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { AMBIENT_TRACKS } from '../lib/constants';
import { BookOpen, Coffee, Moon, Play, Headphones } from 'lucide-react';

export function HubView() {
  const { currentAmbient, setAmbientTrack, playChapter, chapters, currentChapter } = usePlayer();

  const handleStartMode = (ambientId: string, surahId: number) => {
    const ambient = AMBIENT_TRACKS.find(t => t.id === ambientId) || null;
    const chapter = chapters.find(c => c.id === surahId);
    
    setAmbientTrack(ambient);
    if (chapter) {
      playChapter(chapter);
    }
  };

  const modes = [
    {
      id: 'study',
      title: 'Deep Focus & Study',
      description: 'Steady recitation combined with light rain to aid retention.',
      icon: BookOpen,
      bgClass: 'bg-gradient-to-br from-[#1C1710] to-[#0A0C10]',
      accentColor: 'text-teal-400',
      ambientId: 'rain',
      defaultSurahId: 36
    },
    {
      id: 'work',
      title: 'Mindful Work Flow',
      description: 'Productivity flows with comforting fireplace crackles.',
      icon: Coffee,
      bgClass: 'bg-gradient-to-br from-[#1A110D] to-[#0A0C10]',
      accentColor: 'text-amber-500',
      ambientId: 'fire',
      defaultSurahId: 55
    },
    {
      id: 'sleep',
      title: 'Sleep & Relaxation',
      description: 'Soothing recitations paired with calming ocean waves.',
      icon: Moon,
      bgClass: 'bg-gradient-to-br from-[#0F141F] to-[#0A0C10]',
      accentColor: 'text-blue-400',
      ambientId: 'waves',
      defaultSurahId: 67
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-20">
      <header className="pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0F172A] border border-white/5 text-teal-500 text-sm font-medium mb-6 uppercase tracking-widest">
          <Headphones size={14} />
          Focus Engine
        </div>
        <h2 className="text-5xl md:text-6xl font-serif text-white tracking-tight mb-6">Elevate your focus.</h2>
        <p className="text-slate-400 text-xl md:text-2xl font-light max-w-3xl leading-relaxed">Blend beautiful Quranic recitations with high-quality ambient environments designed for concentration, peace, and deep work.</p>
      </header>

      <section>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-serif text-white tracking-wide">Daily Routines</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modes.map(mode => (
            <div 
              key={mode.id}
              className={`relative overflow-hidden rounded-[2rem] ${mode.bgClass} border border-white/5 p-8 flex flex-col justify-between min-h-[320px] group hover:border-teal-500/30 transition-all duration-700 hover:-translate-y-1 shadow-2xl`}
            >
              <div className={`w-14 h-14 rounded-2xl bg-black/40 backdrop-blur-md flex items-center justify-center shadow-inner ${mode.accentColor} border border-white/5 group-hover:scale-110 transition-transform duration-500`}>
                <mode.icon size={24} strokeWidth={1.5} />
              </div>
              
              <div className="mt-12 space-y-3 relative z-10 w-full">
                <h4 className="text-2xl font-serif text-white tracking-wide group-hover:text-teal-400 transition-colors">{mode.title}</h4>
                <p className="text-base text-slate-400 font-light leading-relaxed">{mode.description}</p>
                
                <button 
                  onClick={() => handleStartMode(mode.ambientId, mode.defaultSurahId)}
                  className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-white/5 hover:bg-teal-500 text-slate-300 hover:text-black font-medium transition-all duration-500"
                >
                  <Play size={18} className="fill-current" />
                  Start Session
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-12">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-serif text-white tracking-wide">Ambient Soundscapes</h3>
          <p className="text-sm font-light text-slate-500 uppercase tracking-widest">Toggle Background</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {AMBIENT_TRACKS.map(track => {
            const isActive = currentAmbient?.id === track.id;
            return (
              <button
                key={track.id}
                onClick={() => setAmbientTrack(isActive ? null : track)}
                className={`p-6 rounded-[1.5rem] flex flex-col items-center justify-center gap-4 transition-all duration-500 ${
                  isActive 
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-400 shadow-[0_0_30px_rgba(226,183,83,0.15)] scale-105' 
                    : 'bg-[#0F172A] border-white/5 text-slate-500 hover:bg-[#0F172A] hover:text-slate-300 hover:border-white/10'
                } border`}
              >
                <track.icon size={32} strokeWidth={1} />
                <span className="text-sm font-medium tracking-wide">{track.name}</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  );
}
