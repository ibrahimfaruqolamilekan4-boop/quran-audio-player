import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Headphones, Disc3, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LandingView() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 font-sans selection:bg-teal-500/30 overflow-x-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-[#030712] to-[#030712] -z-10" />
      
      {/* Navbar */}
      <header className="px-6 py-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.2)]">
            <BookOpen size={20} className="text-[#020617]" />
          </div>
          <span className="text-xl font-serif text-white tracking-wide font-bold">Nooraya</span>
        </div>
        <div>
          {user ? (
            <button onClick={() => navigate('/dashboard')} className="text-sm font-medium hover:text-white transition-colors">Go to Dashboard</button>
          ) : (
            <button onClick={() => navigate('/auth')} className="text-sm font-medium hover:text-white transition-colors">Sign In</button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 pt-20 pb-32 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-8">
          <ShieldCheck size={14} /> Distraction-Free Focus
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6 max-w-4xl">
          Deep work meets <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-500">divine peace.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12">
          Immerse yourself in a beautifully crafted environment combining ambient soundscapes, curated Quranic recitation, and habit tracking to elevate your focus.
        </p>

        <button 
          onClick={() => navigate(user ? '/dashboard' : '/auth')}
          className="bg-white hover:bg-slate-200 text-slate-900 px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-all hover:scale-105 shadow-xl shadow-white/10"
        >
          {user ? 'Enter Nooraya' : 'Get Started Free'} <ArrowRight size={20} />
        </button>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 text-left w-full">
          <div className="bg-[#131722]/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
            <div className="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center text-teal-400 mb-6">
              <Headphones size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Ambient Audio Mixing</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Blend rain, wind, fire, and more with your favorite recitations for the perfect studying or deep work soundscape.
            </p>
          </div>
          <div className="bg-[#131722]/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-6">
              <BookOpen size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Curated Recitations</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Access the complete Surah library with beautiful, distraction-free typography and seamless audio playback.
            </p>
          </div>
          <div className="bg-[#131722]/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 mb-6">
              <Disc3 size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Global Community</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Join thousands of users tracking their habits and maintaining consistency in their daily connections.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
