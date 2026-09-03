import React from 'react';
import { BookOpen, Headphones, Disc3, Compass, BarChart2, Settings } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const tabs = [
    { id: 'home', label: 'Explore', icon: Compass },
    { id: 'hub', label: 'Focus Space', icon: Headphones },
    { id: 'library', label: 'Surahs', icon: BookOpen },
    { id: 'reciters', label: 'Reciters', icon: Disc3 },
    { id: 'insights', label: 'Activity', icon: BarChart2 },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-72 bg-[#020617]/70 backdrop-blur-3xl border-r border-slate-800/60 h-screen fixed top-0 left-0 pt-10 pb-24 z-40">
        <div className="px-8 mb-12">
          <h1 className="text-2xl font-serif text-white tracking-wide flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.2)]">
              <BookOpen size={20} className="text-[#020617]" />
            </div>
            Quran Audio
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <p className="px-5 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 mt-2">Menu</p>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-medium ${
                currentTab === tab.id 
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <tab.icon size={22} strokeWidth={currentTab === tab.id ? 2 : 1.5} />
              <span className="tracking-wide">{tab.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="px-4 mt-auto">
           <button
             onClick={() => setCurrentTab('settings')}
             className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-medium ${
               currentTab === 'settings' 
                 ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' 
                 : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
             }`}
           >
             <Settings size={22} strokeWidth={currentTab === 'settings' ? 2 : 1.5} />
             <span className="tracking-wide">Settings</span>
           </button>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-[90px] left-4 right-4 bg-[#0A0F1C]/95 backdrop-blur-2xl border border-slate-800/80 rounded-2xl z-40 p-2 shadow-2xl">
        <div className="flex items-center justify-between">
          {[...tabs, { id: 'settings', label: 'Admin', icon: Settings }].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center gap-1.5 py-2 px-2 rounded-xl min-w-[50px] transition-all ${
                currentTab === tab.id ? 'bg-teal-500/10 text-teal-400' : 'text-slate-500'
              }`}
            >
              <tab.icon size={18} />
              <span className="text-[9px] font-medium tracking-wide">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
