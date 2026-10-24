import React, { useState } from 'react';
import {
  BookOpen,
  Headphones,
  Disc3,
  Compass,
  BarChart2,
  Settings,
  Shield,
  LogOut,
  User as UserIcon,
  Clock,
  Sparkles,
  Sun,
  MoreHorizontal,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const { user, role, logOut } = useAuth();
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Desktop sidebar items (Offline removed)
  const desktopTabs = [
    { id: 'home', label: 'Explore', icon: Sparkles },
    { id: 'azkar', label: 'Daily Azkar', icon: Sun },
    { id: 'hub', label: 'Focus Space', icon: Headphones },
    { id: 'reciters', label: 'Reciters', icon: Disc3 },
    { id: 'library', label: 'Surahs', icon: BookOpen },
    { id: 'prayer-times', label: 'Prayer Times', icon: Clock },
    { id: 'qibla', label: 'Qibla', icon: Compass },
    { id: 'insights', label: 'Activity', icon: BarChart2 },
  ];

  // Mobile Bottom Navigation: exactly 4 buttons (Max 4 as required)
  // 1. Surahs
  // 2. Prayer Times
  // 3. Settings
  // 4. More (Qibla, Activity, Admin, Sign out)
  const bottomNavItems = [
    { id: 'library', label: 'Surahs', icon: BookOpen },
    { id: 'prayer-times', label: 'Prayers', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isMoreActive = currentTab === 'qibla' || currentTab === 'insights';

  return (
    <>
      {/* =========================================================================
          DESKTOP SIDEBAR (w-72 fixed on left, md:flex)
          ========================================================================= */}
      <div className="hidden md:flex flex-col w-72 bg-[#020617]/70 backdrop-blur-3xl border-r border-slate-800/60 h-screen fixed top-0 left-0 pt-8 pb-20 z-40">
        <div className="px-8 mb-8 cursor-pointer" onClick={() => navigate('/')}>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-600 flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.25)] shrink-0">
              <BookOpen size={20} className="text-[#020612]" />
            </div>
            <div>
              <h1 className="text-xl font-serif text-white tracking-widest font-semibold flex items-center gap-1.5">
                <span>NOORAYA</span>
              </h1>
              <p className="text-[10px] text-teal-400/90 font-arabic">نُورَايَا • Quran Sanctuary</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto no-scrollbar">
          <p className="px-5 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 mt-1">Menu</p>
          {desktopTabs.map(tab => {
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCurrentTab(tab.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-200 font-medium cursor-pointer ${
                  active
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                <tab.icon size={20} strokeWidth={active ? 2 : 1.5} className={active ? 'text-teal-400' : 'text-slate-400'} />
                <span className="tracking-wide text-sm">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 mt-auto pt-4 border-t border-slate-800/60 space-y-2">
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all font-medium text-amber-400 hover:bg-amber-500/10 border border-transparent cursor-pointer"
            >
              <Shield size={20} strokeWidth={1.5} />
              <span className="tracking-wide text-sm">Admin Panel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCurrentTab('settings')}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all font-medium cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Settings size={20} strokeWidth={currentTab === 'settings' ? 2 : 1.5} />
            <span className="tracking-wide text-sm">Settings</span>
          </button>

          <div className="relative group pt-1">
            <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#030712] border border-slate-800 cursor-pointer">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400">
                  <UserIcon size={16} />
                </div>
              )}
              <div className="flex flex-col flex-1 truncate">
                <span className="text-xs font-medium text-white truncate">
                  {user?.displayName || user?.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-500 truncate">{user?.email}</span>
              </div>
            </div>

            {/* Dropdown Menu */}
            <div className="absolute bottom-full left-0 w-full mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="bg-[#0A0F1C] border border-slate-800 rounded-xl p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={logOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-400/10 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE BOTTOM NAVIGATION BAR (md:hidden)
          Strictly max 4 buttons:
          [Surahs] [Prayers] [Settings] [More]
          ========================================================================= */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[#070B14]/95 backdrop-blur-2xl border-t border-slate-800/90 z-50 px-2 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] shadow-[0_-8px_30px_rgba(0,0,0,0.6)]"
      >
        <div className="grid grid-cols-4 items-center gap-1 max-w-md mx-auto">
          {bottomNavItems.map(item => {
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setCurrentTab(item.id);
                }}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl min-h-[48px] transition-all cursor-pointer ${
                  active ? 'text-teal-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-teal-500/15' : ''}`}>
                  <item.icon size={20} strokeWidth={active ? 2.3 : 1.7} />
                </div>
                <span className={`text-[11px] tracking-tight ${active ? 'text-teal-300 font-medium' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* 4th Button: More Menu */}
          <button
            type="button"
            onClick={() => setShowMoreMenu(prev => !prev)}
            aria-expanded={showMoreMenu}
            aria-label="More navigation options"
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl min-h-[48px] transition-all cursor-pointer ${
              showMoreMenu || isMoreActive ? 'text-teal-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${showMoreMenu || isMoreActive ? 'bg-teal-500/15' : ''}`}>
              <MoreHorizontal size={20} strokeWidth={showMoreMenu || isMoreActive ? 2.3 : 1.7} />
            </div>
            <span
              className={`text-[11px] tracking-tight ${
                showMoreMenu || isMoreActive ? 'text-teal-300 font-medium' : 'text-slate-400'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* =========================================================================
          MOBILE "MORE" MODAL / SHEET
          Displays remaining buttons: Qibla, Activity, Admin, and User actions
          ========================================================================= */}
      {showMoreMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowMoreMenu(false)}
          />

          {/* Sheet */}
          <div className="relative bg-[#0A0F1D]/95 backdrop-blur-2xl border-t border-slate-800 rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <h3 className="text-base font-serif font-semibold text-white tracking-wide">More Features</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setCurrentTab('qibla');
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer min-h-[48px] ${
                  currentTab === 'qibla'
                    ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center text-teal-400">
                    <Compass size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Qibla Compass</div>
                    <div className="text-xs text-slate-500">Live Kaaba direction & angle</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setCurrentTab('insights');
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer min-h-[48px] ${
                  currentTab === 'insights'
                    ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center text-teal-400">
                    <BarChart2 size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Activity & Insights</div>
                    <div className="text-xs text-slate-500">Listening stats & streak</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-600" />
              </button>

              {role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate('/admin');
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300 transition-all cursor-pointer min-h-[48px]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                      <Shield size={20} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">Admin Console</div>
                      <div className="text-xs text-amber-400/80">Manage reciters, videos & users</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-amber-500/60" />
                </button>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    void logOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold tracking-wide transition-all cursor-pointer min-h-[44px]"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
