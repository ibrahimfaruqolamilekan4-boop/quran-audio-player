import React from 'react';
import { BookOpen, Headphones, Disc3, Compass, BarChart2 } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Compass },
    { id: 'hub', label: 'Focus Hub', icon: Headphones },
    { id: 'library', label: 'Surahs', icon: BookOpen },
    { id: 'reciters', label: 'Qaris', icon: Disc3 },
    { id: 'insights', label: 'Insights', icon: BarChart2 },
  ];

  return (
    <>
      <div className="hidden md:flex flex-col w-64 bg-[#050608]/90 backdrop-blur-md border-r border-white/5 h-screen fixed top-0 left-0 pt-10 pb-24 z-40">
        <div className="px-8 mb-14">
          <h1 className="text-2xl font-serif text-white tracking-wide flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-[0_0_20px_rgba(226,183,83,0.3)]">
              <BookOpen size={20} className="text-[#050608]" />
            </div>
            Quranify
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <p className="px-5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-4 mt-2">Menu</p>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 font-medium ${
                currentTab === tab.id 
                  ? 'bg-white/10 text-gold-400 shadow-inner border border-white/10' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <tab.icon size={22} strokeWidth={currentTab === tab.id ? 2 : 1.5} />
              <span className="tracking-wide">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="md:hidden fixed bottom-[90px] left-4 right-4 bg-[#0A0C10]/95 backdrop-blur-2xl border border-white/10 rounded-2xl z-40 p-2 shadow-2xl">
        <div className="flex items-center justify-between">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center gap-1.5 py-2 px-3 rounded-xl min-w-[60px] transition-all ${
                currentTab === tab.id ? 'bg-[#151921] text-gold-400' : 'text-slate-500'
              }`}
            >
              <tab.icon size={20} />
              <span className="text-[9px] font-medium tracking-wide">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
