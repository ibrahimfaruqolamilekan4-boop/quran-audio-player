import React from 'react';
import { Sparkles, Sun, Headphones, Disc3 } from 'lucide-react';

interface TopNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const TOP_NAV_TABS = [
  { id: 'home', label: 'Explore', icon: Sparkles },
  { id: 'azkar', label: 'Daily Azkar', icon: Sun },
  { id: 'hub', label: 'Focus Space', icon: Headphones },
  { id: 'reciters', label: 'Reciters', icon: Disc3 },
] as const;

/**
 * Top Navigation Bar ("Medina Emerald")
 * Fixed at the top of the screen, always visible.
 * Features 4 primary tabs: Explore, Daily Azkar, Focus Space, Reciters.
 * Respects safe areas (iPhone notch) and provides comfortable 44px+ touch targets.
 * Active tab indicator is styled with Medina accent gold (#D4AF37).
 */
export function TopNav({ currentTab, setCurrentTab }: TopNavProps) {
  return (
    <header
      role="navigation"
      aria-label="Top Navigation"
      className="fixed top-0 left-0 right-0 md:left-72 z-40 bg-[#06150F]/90 backdrop-blur-2xl border-b border-white/8 pt-[max(0.6rem,env(safe-area-inset-top,0px))] pb-2.5 px-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-all"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-start sm:justify-center overflow-x-auto no-scrollbar gap-2 px-1">
        {TOP_NAV_TABS.map(tab => {
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl min-h-[44px] shrink-0 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                active
                  ? 'bg-[#11382B] text-[#D4AF37] border border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.25)] font-bold'
                  : 'text-[#A8BFB3] hover:text-[#F6F1E4] hover:bg-white/5 border border-transparent'
              }`}
            >
              <tab.icon
                size={17}
                className={active ? 'text-[#D4AF37]' : 'text-[#A8BFB3]'}
                strokeWidth={active ? 2.4 : 1.7}
              />
              <span className="whitespace-nowrap tracking-wide">{tab.label}</span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37] ml-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
