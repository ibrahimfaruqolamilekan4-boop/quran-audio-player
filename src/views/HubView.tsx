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
      bgClass: 'bg-gradient-to-br from-teal-900/80 to-emerald-950',
      accentColor: 'text-emerald-400',
      ambientId: 'rain',
      defaultSurahId: 36 // Yaseen often used for focus
    },
    {
      id: 'work',
      title: 'Mindful Work Flow',
      description: 'Productivity flows with comforting fireplace crackles.',
      icon: Coffee,
      bgClass: 'bg-gradient-to-br from-orange-900/80 to-amber-950',
      accentColor: 'text-amber-400',
      ambientId: 'fire',
      defaultSurahId: 55 // Ar-Rahman
    },
    {
      id: 'sleep',
      title: 'Sleep & Relaxation',
      description: 'Soothing recitations paired with calming ocean waves.',
      icon: Moon,
      bgClass: 'bg-gradient-to-br from-indigo-900/80 to-blue-950',
      accentColor: 'text-blue-400',
      ambientId: 'waves',
      defaultSurahId: 67 // Al-Mulk
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-16">
      <header className="pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-white/10 text-slate-300 text-sm font-medium mb-6">
          <Headphones size={14} />
          Focus Engine
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">Elevate your focus.</h2>
        <p className="text-slate-400 text-xl max-w-2xl">Blend beautiful Quranic recitations with high-quality ambient environments designed for concentration, peace, and deep work.</p>
      </header>

      <section>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-semibold text-white">Daily Routines</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modes.map(mode => (
            <div 
              key={mode.id}
              className={`relative overflow-hidden rounded-[2rem] ${mode.bgClass} border border-white/5 p-8 flex flex-col justify-between min-h-[300px] group hover:border-white/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50`}
            >
              {/* Subtle grain/texture overlay could go here */}
              
              <div className={`w-14 h-14 rounded-2xl bg-black/20 backdrop-blur-md flex items-center justify-center shadow-inner ${mode.accentColor} border border-white/10`}>
                <mode.icon size={26} strokeWidth={1.5} />
              </div>
              
              <div className="mt-12 space-y-3 relative z-10 w-full">
                <h4 className="text-2xl font-bold text-white tracking-tight">{mode.title}</h4>
                <p className="text-base text-slate-300 leading-relaxed opacity-90">{mode.description}</p>
                
                <button 
                  onClick={() => handleStartMode(mode.ambientId, mode.defaultSurahId)}
                  className="mt-6 w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black font-semibold backdrop-blur-md transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
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
          <h3 className="text-2xl font-semibold text-white">Ambient Soundscapes</h3>
          <p className="text-sm text-slate-400">Toggle active background</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {AMBIENT_TRACKS.map(track => {
            const isActive = currentAmbient?.id === track.id;
            return (
              <button
                key={track.id}
                onClick={() => setAmbientTrack(isActive ? null : track)}
                className={`p-6 rounded-[1.5rem] flex flex-col items-center justify-center gap-4 transition-all duration-300 ${
                  isActive 
                    ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.15)]' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                } border`}
              >
                <track.icon size={32} strokeWidth={1.2} />
                <span className="text-sm font-medium text-center">{track.name}</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  );
}
