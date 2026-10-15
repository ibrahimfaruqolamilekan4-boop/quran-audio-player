import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Heart,
  Compass
} from 'lucide-react';

export function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { user, login, signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, name || email.split('@')[0]);
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020612]/30 via-[#020612]/15 to-[#020612]/45 backdrop-blur-[1px] text-slate-100 flex flex-col justify-between selection:bg-teal-500/30 selection:text-teal-200 relative overflow-hidden">
      {/* Background celestial glows */}
      <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-teal-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[700px] h-[700px] bg-emerald-950/20 blur-[160px] rounded-full pointer-events-none" />

      {/* Top Header */}
      <header className="px-6 lg:px-16 py-6 z-20 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-teal-300 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Sanctuary</span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.3)]">
            <BookOpen size={16} className="text-[#020612]" />
          </div>
          <span className="font-serif text-white tracking-widest text-sm font-semibold">NOORAYA</span>
        </div>
      </header>

      {/* Main Sanctuary Card Container */}
      <main className="z-10 max-w-5xl w-full mx-auto px-4 py-8 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 bg-[#080D1A]/90 border border-white/[0.08] rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-3xl">
          
          {/* Left Hero Panel (Desktop) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-10 bg-gradient-to-br from-[#0C1425] via-[#070D18] to-[#040810] border-r border-white/[0.06] relative">
            <div className="absolute top-0 right-0 w-60 h-60 bg-amber-500/5 blur-[80px] pointer-events-none" />
            
            <div>
              <div className="inline-flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-widest mb-6">
                <Sparkles size={14} />
                <span>Sacred Portal</span>
              </div>

              <div className="space-y-4 my-6">
                <span className="text-3xl font-arabic text-amber-300/95 leading-relaxed block text-right font-normal">
                  أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ
                </span>
                <p className="text-xs text-slate-300 font-light italic leading-relaxed">
                  “Unquestionably, by the remembrance of Allah hearts are assured.”
                </p>
                <span className="text-[11px] text-teal-400 font-medium block">
                  — Surah Ar-Ra’d (13:28)
                </span>
              </div>
            </div>

            <div className="space-y-4 pt-8 border-t border-white/[0.06]">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                  ✓
                </div>
                <span>Access all 20+ master Sheikhs & reciters</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                  ✓
                </div>
                <span>Sync listening streaks & daily goals across devices</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                  ✓
                </div>
                <span>Continuous lock-screen MediaSession playback</span>
              </div>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-7 p-8 md:p-12 flex flex-col justify-center">
            {/* Tab Switcher */}
            <div className="flex items-center gap-2 p-1.5 bg-[#030610] border border-white/[0.06] rounded-2xl mb-8 self-start w-full sm:w-auto">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  isLogin 
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  !isLogin 
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl md:text-3xl font-serif text-white font-medium">
                {isLogin ? 'Welcome Back to Nooraya' : 'Join the Quranic Sanctuary'}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-1 font-light">
                {isLogin 
                  ? 'Enter your credentials to resume your spiritual journey.'
                  : 'Create your free account to track your Quran habits and save favorites.'}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-2xl flex items-start gap-3 mb-6 text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#030610] border border-white/[0.1] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all"
                    placeholder="e.g. Ibrahim Faruq"
                    required={!isLogin}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#030610] border border-white/[0.1] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#030610] border border-white/[0.1] rounded-2xl px-4 py-3.5 pr-11 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all"
                    placeholder="••••••••"
                    required
                    minLength={isLogin ? undefined : 8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!isLogin && (
                  <p className="text-[11px] text-slate-500 mt-1.5">Must be at least 8 characters.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-4 rounded-2xl transition-all shadow-[0_0_25px_rgba(20,184,166,0.3)] hover:shadow-[0_0_35px_rgba(20,184,166,0.5)] flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {submitting ? (
                  <span>Opening Sanctuary…</span>
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In to Studio' : 'Create My Account'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Quick Guest Entrance */}
            <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <span className="text-slate-500">Want to test without signing in?</span>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-teal-400 hover:text-teal-300 font-semibold transition-colors flex items-center gap-1"
              >
                <span>Continue as Guest</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Note */}
      <footer className="py-6 text-center text-xs text-slate-500 z-10">
        Nooraya • Sacred Sanctuary for Quranic Reflection
      </footer>
    </div>
  );
}
