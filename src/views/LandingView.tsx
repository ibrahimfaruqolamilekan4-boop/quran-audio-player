import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Compass, 
  Clock, 
  Headphones, 
  BookOpen, 
  ArrowRight, 
  Sun, 
  Moon, 
  CheckCircle2, 
  ShieldCheck, 
  Heart,
  ChevronRight,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CURATED_RECITERS } from '../lib/constants';
import { ReciterAvatar } from '../components/ReciterAvatar';

export function LandingView() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Interactive Live Sample Player on Landing Page
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [activeSoundscape, setActiveSoundscape] = useState<'rain' | 'birds' | 'mecca'>('rain');
  const [isMuted, setIsMuted] = useState(false);
  
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);

  const soundscapes = [
    { id: 'rain', label: 'Medina Rain', url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_73229bbf78.mp3?filename=rain-and-thunder-nature-sounds-7803.mp3' },
    { id: 'birds', label: 'Dawn Garden', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=birds-in-the-forest-24187.mp3' },
    { id: 'mecca', label: 'Haram Waves', url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db6591201e.mp3?filename=ocean-waves-ambient-110255.mp3' },
  ];

  const handleTogglePlay = () => {
    if (!sampleAudioRef.current) {
      // Surah Al-Fatihah by Sheikh Mishary Alafasy
      sampleAudioRef.current = new Audio('https://server8.mp3quran.net/afs/001.mp3');
      sampleAudioRef.current.onended = () => setIsPlayingSample(false);
    }
    if (!ambientAudioRef.current) {
      const selected = soundscapes.find(s => s.id === activeSoundscape);
      if (selected) {
        ambientAudioRef.current = new Audio(selected.url);
        ambientAudioRef.current.loop = true;
        ambientAudioRef.current.volume = 0.35;
      }
    }

    if (isPlayingSample) {
      sampleAudioRef.current.pause();
      ambientAudioRef.current?.pause();
      setIsPlayingSample(false);
    } else {
      sampleAudioRef.current.play().catch(() => {});
      ambientAudioRef.current?.play().catch(() => {});
      setIsPlayingSample(true);
    }
  };

  useEffect(() => {
    return () => {
      sampleAudioRef.current?.pause();
      ambientAudioRef.current?.pause();
    };
  }, []);

  // Filter 6 highlight reciters for the showcase
  const highlightReciters = CURATED_RECITERS.filter(r => 
    ['ghamdi', 'qatami', 'rifai', 'husary', 'ayyub', 'afs'].includes(r.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020612]/35 via-[#020612]/15 to-[#020612]/50 backdrop-blur-[1px] text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200 overflow-x-hidden relative">
      {/* Sacred Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-teal-500/10 via-emerald-600/5 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-amber-500/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[10%] left-[-10%] w-[700px] h-[700px] bg-teal-900/10 blur-[160px] rounded-full" />
      </div>

      {/* =========================================================================
          NAVBAR: Refined Sanctuary Navigation
         ========================================================================= */}
      <header className="sticky top-0 z-50 px-6 lg:px-16 py-5 bg-[#020612]/80 backdrop-blur-2xl border-b border-white/[0.06] transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-600 p-[1px] shadow-[0_0_25px_rgba(45,212,191,0.25)] group-hover:shadow-[0_0_35px_rgba(45,212,191,0.4)] transition-all">
              <div className="w-full h-full bg-[#020612] rounded-[15px] flex items-center justify-center">
                <BookOpen size={20} className="text-teal-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-serif text-white tracking-widest font-semibold">NOORAYA</span>
                <span className="text-xs font-arabic text-teal-400/80 font-normal">نُورَايَا</span>
              </div>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">Sacred Quranic Sanctuary</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#reciters" className="hover:text-teal-300 transition-colors">Master Reciters</a>
            <a href="#soundscapes" className="hover:text-teal-300 transition-colors">Soundscapes</a>
            <a href="#azkar" className="hover:text-teal-300 transition-colors">Daily Azkar</a>
            <a href="#prayer-qibla" className="hover:text-teal-300 transition-colors">Prayer & Qibla</a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {user ? (
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold tracking-wide transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:scale-[1.02]"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="hidden sm:inline-block text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Explore as Guest
                </button>
                <button 
                  onClick={() => navigate('/auth')}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-bold tracking-wide transition-all shadow-[0_0_25px_rgba(20,184,166,0.35)] hover:shadow-[0_0_35px_rgba(20,184,166,0.5)] hover:scale-[1.02]"
                >
                  Enter Sanctuary
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          HERO SECTION: Monumental Transcendent Welcome
         ========================================================================= */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-16 pt-20 pb-24 md:pt-28 md:pb-36 flex flex-col items-center text-center">
        {/* Sacred Basmalah Ornament */}
        <div className="flex flex-col items-center gap-3 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="text-2xl md:text-3xl font-arabic text-amber-300/90 tracking-wide font-normal drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </span>
          <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif text-white tracking-tight max-w-5xl leading-[1.15] mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          Where Sacred Tartil Meets <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-400 to-amber-300 drop-shadow-[0_0_30px_rgba(45,212,191,0.2)]">
            Ethereal Peace & Focus
          </span>
        </h1>

        {/* Rich Editorial Subtitle */}
        <p className="text-lg md:text-xl text-slate-300/90 max-w-3xl font-light leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          Crafted for nocturnal reflection, deep focus, and timeless remembrance. Experience the complete Holy Quran 
          chanted by canonical master reciters, seamlessly interwoven with living ambient soundscapes, verified daily adhkar, 
          and distraction-free sacred typography.
        </p>

        {/* Primary Interactive CTA Cluster */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-16 animate-in fade-in slide-in-from-bottom-10 duration-700">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto px-9 py-4 rounded-full bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 font-bold text-base flex items-center justify-center gap-3 transition-all hover:scale-[1.03] shadow-[0_0_40px_rgba(20,184,166,0.4)]"
          >
            <span>Begin Listening Now</span>
            <ArrowRight size={18} />
          </button>

          <a 
            href="#reciters"
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 hover:border-teal-500/40 font-medium text-base flex items-center justify-center gap-2.5 transition-all"
          >
            <BookOpen size={18} className="text-teal-400" />
            <span>Explore 114 Surahs</span>
          </a>
        </div>

        {/* =========================================================================
            LIVE ATMOSPHERIC PREVIEW DOCK: Listen Sample Directly On Landing Page
           ========================================================================= */}
        <div className="w-full max-w-4xl bg-gradient-to-b from-[#0F172A]/80 to-[#070B14]/90 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 blur-[90px] pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-4">
              <button
                onClick={handleTogglePlay}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 flex items-center justify-center shadow-[0_0_25px_rgba(45,212,191,0.4)] hover:scale-105 transition-all shrink-0 cursor-pointer"
              >
                {isPlayingSample ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-0.5" />}
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest text-teal-400 font-semibold">Live Sanctuary Sample</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <h3 className="text-xl font-serif text-white font-medium">Surah Al-Fatihah (The Opening)</h3>
                <p className="text-xs text-slate-400">Recited by Sheikh Mishary Rashid Alafasy • Murattal Benchmark</p>
              </div>
            </div>

            {/* Soundscape Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">Layer Soundscape:</span>
              {soundscapes.map(sc => (
                <button
                  key={sc.id}
                  onClick={() => {
                    setActiveSoundscape(sc.id as any);
                    if (ambientAudioRef.current) {
                      ambientAudioRef.current.src = sc.url;
                      if (isPlayingSample) ambientAudioRef.current.play().catch(() => {});
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    activeSoundscape === sc.id
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                      : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 size={15} className="text-teal-400" /> Lossless Audio Streaming
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 size={15} className="text-teal-400" /> Background Video Loop
              </span>
              <span className="hidden md:flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 size={15} className="text-teal-400" /> Zero Commercial Ads
              </span>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold transition-colors"
            >
              Open Full Studio Player <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURED RECITERS SECTION: Canonical Masters Showcase
         ========================================================================= */}
      <section id="reciters" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-16 py-20 border-t border-white/[0.06]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-widest mb-2">
              <Sparkles size={14} />
              <span>Voices of Sanctity</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-serif text-white tracking-wide">
              Master Quranic Reciters
            </h2>
            <p className="text-slate-400 mt-2 text-sm max-w-2xl font-light">
              Listen to the sublime cadences of the Islamic world's greatest scholars and imams. 
              Authentic high-bitrate Murattal and Mujawwad recitations delivered straight to your soul.
            </p>
          </div>

          <button
            onClick={() => navigate('/dashboard/reciters')}
            className="self-start md:self-auto px-5 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.08] text-teal-300 border border-teal-500/20 text-xs font-medium flex items-center gap-2 transition-all"
          >
            <span>View All 20+ Reciters</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 6 Reciter Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlightReciters.map(reciter => (
            <div 
              key={reciter.id}
              onClick={() => navigate('/dashboard')}
              className="group bg-[#0A0F1C]/70 hover:bg-[#0E1528] border border-white/[0.07] hover:border-teal-500/40 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between cursor-pointer shadow-lg hover:shadow-[0_10px_35px_rgba(20,184,166,0.1)] relative overflow-hidden"
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-300">
                  <ReciterAvatar reciter={reciter} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-lg font-serif text-white font-medium truncate group-hover:text-teal-300 transition-colors">
                      {reciter.name}
                    </h4>
                  </div>
                  <p className="text-xs font-arabic text-teal-400/90 font-normal mt-0.5">{reciter.nameArabic}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{reciter.location}, {reciter.region} • {reciter.style}</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 font-light line-clamp-3 leading-relaxed mb-6">
                {reciter.bio}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] text-xs font-medium">
                <span className="text-slate-500 group-hover:text-slate-300 transition-colors">114 Surahs Complete</span>
                <span className="text-teal-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Listen <ChevronRight size={13} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          THE FOUR SANCTUARY PILLARS: Deep Work, Adhkar, Prayer, Offline
         ========================================================================= */}
      <section id="soundscapes" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-16 py-20 border-t border-white/[0.06]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-widest mb-3">
            <Sparkles size={14} />
            <span>Architecture of Peace</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-serif text-white tracking-wide">
            Designed to Transcend the Ordinary
          </h2>
          <p className="text-slate-400 mt-3 text-sm md:text-base font-light">
            Every feature has been meticulously crafted to cultivate spiritual presence, eliminate digital friction, and nurture consistency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Pillar 1: Ambient Soundscape Alchemy */}
          <div className="bg-[#0A0F1C]/70 border border-white/[0.07] rounded-3xl p-8 flex flex-col justify-between hover:border-teal-500/30 transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-6 border border-teal-500/20">
                <Headphones size={24} />
              </div>
              <h3 className="text-2xl font-serif text-white mb-3">Ambient Soundscape Alchemy</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light mb-6">
                Dual-audio engine that harmonizes sacred recitations with high-fidelity environmental soundscapes. 
                Blend Medina rainfall, night wind, ocean ripples, or forest birds with individual volume faders.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-300 flex items-center justify-between">
              <span>Dynamic Fader Mixer</span>
              <span className="text-teal-400 font-medium">Independent Dual Gain</span>
            </div>
          </div>

          {/* Pillar 2: Daily Azkar & Sunnah Counter */}
          <div id="azkar" className="bg-[#0A0F1C]/70 border border-white/[0.07] rounded-3xl p-8 flex flex-col justify-between hover:border-amber-500/30 transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6 border border-amber-500/20">
                <Sun size={24} />
              </div>
              <h3 className="text-2xl font-serif text-white mb-3">Authentic Daily Adhkar Counter</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light mb-6">
                Curated morning, evening, after-prayer, and bedtime supplications from authentic Sahih collections. 
                Featuring interactive tap counter, haptic feedback, Arabic with tashkeel, phonetics, and translation.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-300 flex items-center justify-between">
              <span>Tap Progress Persistence</span>
              <span className="text-amber-400 font-medium">Sahih References</span>
            </div>
          </div>

          {/* Pillar 3: Precision Prayer Times & Qibla Compass */}
          <div id="prayer-qibla" className="bg-[#0A0F1C]/70 border border-white/[0.07] rounded-3xl p-8 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-500/20">
                <Compass size={24} />
              </div>
              <h3 className="text-2xl font-serif text-white mb-3">Astronomical Prayer Times & Qibla</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light mb-6">
                Live micro-accurate prayer schedules calculated with solar angles according to major Islamic calculation methods. 
                Includes real-time Kaaba compass orientation with GPS precision.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-300 flex items-center justify-between">
              <span>Automatic Location Sync</span>
              <span className="text-emerald-400 font-medium">Next Salah Countdown</span>
            </div>
          </div>

          {/* Pillar 4: Continuous Background Play & Lock Screen Controls */}
          <div className="bg-[#0A0F1C]/70 border border-white/[0.07] rounded-3xl p-8 flex flex-col justify-between hover:border-indigo-500/30 transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6 border border-indigo-500/20">
                <Radio size={24} />
              </div>
              <h3 className="text-2xl font-serif text-white mb-3">Lock-Screen MediaSession & PWA</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light mb-6">
                Enjoy continuous uninterrupted listening on your smartphone. Native lock-screen metadata displays current surah, 
                reciter artwork, and remote controls. Automatically advances to the next chapter without touching your phone.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-300 flex items-center justify-between">
              <span>Mobile PWA Installable</span>
              <span className="text-indigo-400 font-medium">Continuous Auto-Advance</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          DIVINE INVITATION CALL TO ACTION
         ========================================================================= */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 lg:px-16 py-24 text-center">
        <div className="relative rounded-3xl p-10 md:p-16 bg-gradient-to-b from-[#0F172A] to-[#050811] border border-teal-500/30 shadow-[0_0_80px_rgba(20,184,166,0.15)] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/15 via-transparent to-transparent pointer-events-none" />

          <span className="text-xs uppercase tracking-widest text-teal-400 font-bold mb-4 inline-block">
            Step Into Divine Tranquility
          </span>
          <h2 className="text-3xl md:text-5xl font-serif text-white tracking-wide max-w-2xl mx-auto mb-6">
            Elevate Your Daily Connection With The Noble Quran
          </h2>
          <p className="text-slate-300 text-sm md:text-base max-w-xl mx-auto font-light leading-relaxed mb-10">
            Join a global sanctuary designed for quiet minds, honest reflection, and uncompromised focus. Completely free, distraction-free, and always ad-free.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate(user ? '/dashboard' : '/auth')}
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 font-bold text-base transition-all shadow-xl shadow-teal-500/25 hover:scale-[1.03]"
            >
              {user ? 'Enter Dashboard' : 'Create Free Account'}
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 font-medium text-base transition-all"
            >
              Explore Without Account
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER: Respectful Attribution & Sacred Credits
         ========================================================================= */}
      <footer className="relative z-10 border-t border-white/[0.06] py-12 px-6 lg:px-16 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400 font-bold">
              ن
            </div>
            <div>
              <p className="font-serif text-white text-sm">NOORAYA</p>
              <p className="text-[11px] text-slate-400">Sacred Quranic Audio Sanctuary</p>
            </div>
          </div>

          <p className="text-center md:text-right text-slate-400 max-w-md font-light leading-relaxed">
            Quranic audio streamed via Mp3Quran.net and EveryAyah. Text verified against canonical Uthmani script standards. 
            May Allah accept this humble endeavor and grant peace to all listeners.
          </p>
        </div>
      </footer>
    </div>
  );
}
