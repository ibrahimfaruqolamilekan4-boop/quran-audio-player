import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, AlertCircle } from 'lucide-react';

export function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 selection:bg-teal-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-900/10 via-[#030712] to-[#030712] -z-10" />
      
      <div className="w-full max-w-md bg-[#131722]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.2)] mb-4">
            <BookOpen size={24} className="text-[#020617]" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to Nooraya</h2>
          <p className="text-slate-400 mt-2 text-sm text-center">Sign in to access your dashboard, track your progress, and manage your focus space.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3 mb-6 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                placeholder="John Doe"
                required={!isLogin}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
              placeholder="••••••••"
              required
              minLength={isLogin ? undefined : 8}
            />
            {!isLogin && <p className="text-xs text-slate-500 mt-1.5">At least 8 characters.</p>}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-900 font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] hover:shadow-[0_0_25px_rgba(20,184,166,0.5)]"
          >
            {submitting ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-2 text-center text-sm text-slate-400">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
