import React from 'react';
import { BookOpen, Headphones, Library, Settings, Disc3 } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const tabs = [
    { id: 'hub', label: 'Focus Hub', icon: Headphones },
    { id: 'library', label: 'Surah Library', icon: BookOpen },
    { id: 'playlists', label: 'Reciters', icon: Disc3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-black border-r border-white/5 h-screen fixed top-0 left-0 pt-10 pb-24 z-40">
        <div className="px-8 mb-14">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.3)]">
              <BookOpen size={20} className="text-black" />
            </div>
            Quranify
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <p className="px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 mt-2">Menu</p>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 font-medium ${
                currentTab === tab.id 
                  ? 'bg-white/10 text-white shadow-inner border border-white/5' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
              }`}
            >
              <tab.icon size={22} className={currentTab === tab.id ? 'text-emerald-400' : ''} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-24 left-4 right-4 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl z-40 p-2 shadow-2xl">
        <div className="flex items-center justify-between">
          {tabs.slice(0, 4).map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center gap-1.5 py-2 px-3 rounded-xl min-w-[70px] transition-all ${
                currentTab === tab.id ? 'bg-white/10 text-emerald-400' : 'text-slate-400'
              }`}
            >
              <tab.icon size={22} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
