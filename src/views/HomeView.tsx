import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { AMBIENT_TRACKS, CURATED_RECITERS } from '../lib/constants';
import { ReciterAvatar } from '../components/ReciterAvatar';
import { getUserData, getListeningLogs } from '../lib/storage';
import { Play, Heart, Clock, MoreVertical, Flame, Trophy, Check, ArrowRight } from 'lucide-react';

export function HomeView() {
  const { chapters, playChapter, currentChapter, currentReciter, setReciter, setAmbientTrack, currentAmbient } = usePlayer();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userData = getUserData();
  const logs = getListeningLogs();

  const firstName = (user?.displayName || user?.email?.split('@')[0] || '').trim().split(/\s+/)[0];

  // Calculate today's listening time
  const today = new Date().toDateString();
  const todaysLogs = logs.filter(l => new Date(l.loggedAt).toDateString() === today);
  const todaysSeconds = todaysLogs.reduce((acc, log) => acc + log.durationSeconds, 0);
  const todaysMinutes = Math.floor(todaysSeconds / 60);

  const goalPercent = Math.min((todaysMinutes / userData.goalMinutes) * 100, 100);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20 relative z-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-serif text-white tracking-wide">
            As-salamu alaykum{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-slate-400 mt-2 font-light text-lg">
            {currentReciter ? (
              <>
                Reciting by <span className="text-teal-400">{currentReciter.name}</span> — continue your spiritual journey.
              </>
            ) : (
              'Continue your spiritual journey.'
            )}
          </p>
        </div>
        
        {/* Recitation Goals Widget */}
        <div className="bg-[#0F172A]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 flex flex-col gap-3 min-w-[280px]">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400 font-medium tracking-wide">Daily Goal</span>
            <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-full text-xs font-bold">
              <Flame size={14} className="fill-current" />
              {userData.currentStreak} Day Streak
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-serif text-white">{todaysMinutes}</span>
            <span className="text-sm text-slate-500 mb-1">/ {userData.goalMinutes} min</span>
          </div>
          <div className="h-2 w-full bg-[#1E293B] rounded-full overflow-hidden">
            <div 
              className="h-full bg-teal-500 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Made For You Modules */}
      <section>
        <h3 className="text-xl font-medium text-white mb-6 tracking-wide">Made For You</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            onClick={() => {
              if (chapters[0]) playChapter(chapters[0]); // Fatihah
            }}
            className="group cursor-pointer relative overflow-hidden rounded-3xl aspect-[2/1] bg-gradient-to-br from-blue-900/40 to-blue-900/10 border border-blue-500/20 p-6 flex flex-col justify-end transition-all hover:border-blue-500/40"
          >
            <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0">
              <Play size={18} className="text-white fill-current ml-1" />
            </div>
            <Heart size={24} className="text-blue-400 mb-3" />
            <h4 className="text-xl font-serif text-white">Your Favorites</h4>
            <p className="text-sm text-blue-200/60 font-light mt-1">Alafasy, Sudais</p>
          </div>

          <div 
            onClick={() => {
              const ambient = AMBIENT_TRACKS.find(t => t.id === 'rain');
              if (ambient) setAmbientTrack(ambient);
              if (chapters[17]) playChapter(chapters[17]); // Kahf
            }}
            className="group cursor-pointer relative overflow-hidden rounded-3xl aspect-[2/1] bg-gradient-to-br from-teal-900/40 to-teal-900/10 border border-teal-500/20 p-6 flex flex-col justify-end transition-all hover:border-teal-500/40"
          >
            <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0">
              <Play size={18} className="text-white fill-current ml-1" />
            </div>
            <Trophy size={24} className="text-teal-400 mb-3" />
            <h4 className="text-xl font-serif text-white">For Focus Mix</h4>
            <p className="text-sm text-teal-200/60 font-light mt-1">Rain & Al-Kahf</p>
          </div>

          <div className="group cursor-pointer relative overflow-hidden rounded-3xl aspect-[2/1] bg-[#0F172A]/80 border border-white/5 p-6 flex flex-col justify-end transition-all hover:border-white/10">
            <Clock size={24} className="text-slate-400 mb-3" />
            <h4 className="text-xl font-serif text-white">Recently Played</h4>
            <p className="text-sm text-slate-500 font-light mt-1">Al-Baqarah</p>
          </div>
        </div>
      </section>

      {/* Featured Reciters */}
      <section>
        <div className="flex items-end justify-between mb-6 gap-4">
          <h3 className="text-xl font-medium text-white tracking-wide">Featured Reciters</h3>
          <button
            onClick={() => navigate('/dashboard/reciters')}
            className="group flex items-center gap-2 text-sm text-slate-400 hover:text-teal-400 transition-colors"
          >
            Browse all
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-2 -mx-1 px-1 md:grid md:grid-cols-4 lg:grid-cols-6 md:overflow-visible md:mx-0 md:px-0">
          {CURATED_RECITERS.slice(0, 6).map(reciter => {
            const active = currentReciter?.id === reciter.id;
            return (
              <button
                key={reciter.id}
                onClick={() => setReciter(reciter)}
                title={active ? `${reciter.name} is active` : `Listen to ${reciter.name}`}
                className="group relative flex flex-col items-center text-center shrink-0 w-28 md:w-auto focus:outline-none"
              >
                <span
                  className={`block w-24 h-24 rounded-full transition-all duration-500 ${
                    active
                      ? 'ring-2 ring-teal-500 shadow-[0_0_28px_rgba(20,184,166,0.25)]'
                      : 'ring-1 ring-slate-800 group-hover:ring-slate-600 group-hover:scale-[1.03]'
                  }`}
                >
                  <ReciterAvatar reciter={reciter} shape="circle" className="rounded-full border-0" contentClassName="text-2xl" iconSize={26} />
                </span>
                {active && (
                  <span className="absolute top-0 right-3 bg-teal-500 text-black p-1.5 rounded-full shadow-lg">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
                <span
                  className={`mt-3 text-sm font-serif leading-snug line-clamp-2 transition-colors ${
                    active ? 'text-teal-300' : 'text-slate-300 group-hover:text-white'
                  }`}
                >
                  {reciter.name}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">{reciter.region}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick Browse */}
      <section>
        <h3 className="text-xl font-medium text-white mb-6 tracking-wide">Quick Browse</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {chapters.slice(0, 21).map(chapter => (
            <div 
              key={chapter.id}
              onClick={() => playChapter(chapter)}
              className={`group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                currentChapter?.id === chapter.id
                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                  : 'bg-[#0F172A]/50 border-white/5 hover:bg-[#0F172A] hover:border-white/10 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`text-sm font-mono opacity-50 ${currentChapter?.id === chapter.id ? 'text-teal-400' : ''}`}>
                  {chapter.id}.
                </span>
                <div className="flex flex-col">
                  <span className="font-serif text-base group-hover:text-white transition-colors">{chapter.name_simple}</span>
                  <span className="text-xs text-slate-500">{chapter.translated_name.name}</span>
                </div>
              </div>
              <button className="text-slate-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 px-2">
                <MoreVertical size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
