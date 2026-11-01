import React from 'react';
import {
  Sparkles,
  Sun,
  Headphones,
  Disc3,
  Compass,
  BarChart2,
  Crown,
  Shield,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface TopNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const TOP_NAV_TABS = [
  { id: 'home', label: 'Explore', icon: Sparkles },
  { id: 'azkar', label: 'Daily Azkar', icon: Sun },
  { id: 'hub', label: 'Focus Space', icon: Headphones },
  { id: 'reciters', label: 'Reciters', icon: Disc3 },
  { id: 'qibla', label: 'Qibla', icon: Compass },
  { id: 'insights', label: 'Activity', icon: BarChart2 },
  { id: 'premium', label: 'Premium', icon: Crown },
] as const;

/**
 * Top Navigation Bar ("Medina Emerald")
 * Fixed at the top of the screen, always visible.
 * Includes Explore, Daily Azkar, Focus Space, Reciters, Qibla, Activity, Premium,
 * plus Admin Console (when admin) and Sign Out so no "More" dropdown is needed on phones.
 */
export function TopNav({ currentTab, setCurrentTab }: TopNavProps) {
  const { role, logOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      role="navigation"
      aria-label="Top Navigation"
      className="fixed top-0 left-0 right-0 md:left-72 z-40 bg-[#06150F]/90 backdrop-blur-2xl border-b border-white/8 pt-[max(0.6rem,env(safe-area-inset-top,0px))] pb-2.5 px-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-all"
    >
      <div className="max-w-5xl mx-auto flex items-center justify-start overflow-x-auto no-scrollbar gap-2 px-1">
        {TOP_NAV_TABS.map(tab => {
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl min-h-[44px] shrink-0 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                active
                  ? 'bg-[#11382B] text-[#D4AF37] border border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.25)] font-bold'
                  : 'text-[#A8BFB3] hover:text-[#F6F1E4] hover:bg-white/5 border border-transparent'
              }`}
            >
              <tab.icon
                size={16}
                className={active ? 'text-[#D4AF37]' : 'text-[#A8BFB3]'}
                strokeWidth={active ? 2.4 : 1.7}
              />
              <span className="whitespace-nowrap tracking-wide">{tab.label}</span>
            </button>
          );
        })}

        {role === 'admin' && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl min-h-[44px] shrink-0 text-xs sm:text-sm font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all duration-200 cursor-pointer"
          >
            <Shield size={16} className="text-amber-400" strokeWidth={2} />
            <span className="whitespace-nowrap tracking-wide">Admin</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void logOut()}
          className="md:hidden flex items-center gap-1.5 px-3.5 py-2 rounded-2xl min-h-[44px] shrink-0 text-xs font-medium text-red-300 hover:bg-red-500/15 border border-red-500/20 transition-all duration-200 cursor-pointer"
        >
          <LogOut size={15} className="text-red-400" strokeWidth={1.8} />
          <span className="whitespace-nowrap tracking-wide">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
