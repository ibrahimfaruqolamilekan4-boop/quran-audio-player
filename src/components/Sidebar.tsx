import React from 'react';
import {
  BarChart2, BookOpen, Compass, Crown, Headphones, LogOut, Settings, Shield, Sparkles, User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { CURATED_RECITERS } from '../lib/constants';
import { cx, Equalizer, Khatam, ReciterAvatar } from './ui';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

const TABS = [
  { id: 'home', label: 'Explore', icon: Compass },
  { id: 'hub', label: 'Focus Space', icon: Headphones },
  { id: 'library', label: 'Surahs', icon: BookOpen },
  { id: 'reciters', label: 'Reciters', icon: Sparkles },
  { id: 'insights', label: 'Activity', icon: BarChart2 },
];

export function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const { user, role, logOut } = useAuth();
  const navigate = useNavigate();
  const { currentReciter, customReciters, isPlaying, currentChapter } = usePlayer();

  const allReciters = [...CURATED_RECITERS, ...customReciters];
  const activeReciter = allReciters.find((r) => r.id === currentReciter?.id) ?? currentReciter;

  return (
    <>
      {/* ---------- Desktop rail ---------- */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[276px] flex-col border-r border-white/[0.06] bg-ink-950/70 pb-8 pt-9 backdrop-blur-3xl md:flex">
        {/* Brand */}
        <div className="px-8">
          <button onClick={() => navigate('/')} className="group flex items-center gap-3.5 text-left">
            <span
              className="grid h-11 w-11 place-items-center rounded-2xl text-[#0A0C10] transition-transform duration-500 group-hover:rotate-[18deg]"
              style={{ background: 'linear-gradient(140deg,#F3E4BE,var(--accent) 55%,#9E7B39)', boxShadow: '0 10px 28px -12px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.6)' }}
            >
              <BookOpen size={19} strokeWidth={2.1} />
            </span>
            <span>
              <span className="display block text-[19px] leading-none tracking-[0.16em] text-white uppercase">Nooraya</span>
              <span className="mt-1.5 block text-[9px] uppercase tracking-[0.32em] text-mist-dim">Quran · Sound · Stillness</span>
            </span>
          </button>
        </div>

        <div className="mx-8 mt-8 hairline" />

        {/* Nav */}
        <nav className="mt-7 flex-1 space-y-1.5 overflow-y-auto px-4">
          <p className="eyebrow px-4 pb-3">Menu</p>
          {TABS.map((tab) => {
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={cx(
                  'group relative flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-[14px] transition-all duration-300',
                  active ? 'bg-gradient-to-r from-gold/[0.14] to-transparent text-gold-100' : 'text-mist hover:bg-white/[0.035] hover:text-white',
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gold shadow-[0_0_14px_var(--accent-glow)]" />}
                <tab.icon size={19} strokeWidth={active ? 1.9 : 1.4} className={active ? 'text-gold' : 'text-mist-dim group-hover:text-sandstone'} />
                <span className="tracking-wide">{tab.label}</span>
                {active && <Khatam size={12} className="ml-auto text-gold/60" />}
              </button>
            );
          })}
        </nav>

        {/* Active reciter card */}
        {activeReciter && (
          <button
            onClick={() => navigate(`/dashboard/reciters/${activeReciter.id}`)}
            className="surface edge-lit mx-4 mt-5 flex items-center gap-3.5 rounded-[22px] p-3.5 text-left transition-all duration-500 hover:border-gold/25"
          >
            <ReciterAvatar reciter={activeReciter} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-mist-dim">
                {currentChapter ? (isPlaying ? <span className="inline-flex items-center gap-1.5"><Equalizer playing className="mr-1" />Now reciting</span> : 'Paused') : 'Active reciter'}
              </span>
              <span className="display mt-1 block truncate text-[13px] text-white">{activeReciter.name}</span>
              <span className="block truncate text-[11px] text-mist-dim">{activeReciter.style} · {activeReciter.location || activeReciter.region}</span>
            </span>
          </button>
        )}

        {/* Account */}
        <div className="mt-4 space-y-2 px-4">
          {role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-[13px] font-medium text-gold/90 transition-colors hover:bg-gold/[0.07] hover:text-gold-100"
            >
              <Shield size={18} strokeWidth={1.5} /> <span className="tracking-wide">Admin Panel</span>
            </button>
          )}

          <div className="group relative">
            <div className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-gold/25" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/20">
                  {user ? <UserIcon size={15} /> : <Crown size={15} />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-white">{user?.displayName || user?.email?.split('@')[0] || 'Guest'}</span>
                <span className="block truncate text-[10px] text-mist-dim">{user?.email || 'Not signed in'}</span>
              </span>
            </div>

            <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-full translate-y-1 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
              <div className="surface rounded-2xl p-1.5">
                <button
                  onClick={() => { logOut(); navigate('/'); }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12px] font-medium text-red-300 transition-colors hover:bg-red-400/10"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setCurrentTab('settings')}
            className={cx(
              'flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-[13px] transition-all duration-300',
              currentTab === 'settings' ? 'bg-gold/[0.1] text-gold-100' : 'text-mist-dim hover:bg-white/[0.035] hover:text-white',
            )}
          >
            <Settings size={18} strokeWidth={currentTab === 'settings' ? 1.9 : 1.4} /> <span className="tracking-wide">Settings</span>
          </button>
        </div>
      </aside>

      {/* ---------- Mobile nav ---------- */}
      <div className="fixed bottom-[96px] left-4 right-4 z-40 md:hidden">
        <div className="surface flex items-center justify-between rounded-[26px] p-2">
          {TABS.map((tab) => {
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={cx(
                  'flex min-w-[54px] flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 transition-all duration-300',
                  active ? 'bg-gold/[0.12] text-gold' : 'text-mist-dim',
                )}
              >
                <tab.icon size={17} strokeWidth={active ? 2 : 1.4} />
                <span className="text-[9px] font-semibold tracking-wide">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setCurrentTab('settings')}
            className={cx('flex min-w-[54px] flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 transition-all', currentTab === 'settings' ? 'bg-gold/[0.12] text-gold' : 'text-mist-dim')}
          >
            <Settings size={17} strokeWidth={currentTab === 'settings' ? 2 : 1.4} />
            <span className="text-[9px] font-semibold tracking-wide">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
}
