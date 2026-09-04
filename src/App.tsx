import React, { useState, useEffect } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { BottomPlayer } from './components/BottomPlayer';
import { Sidebar } from './components/Sidebar';
import { QuranicPremiumBackground, THEME_LIBRARY } from './components/QuranicPremiumBackground';
import { HomeView } from './views/HomeView';
import { HubView } from './views/HubView';
import { SurahLibraryView } from './views/SurahLibraryView';
import { RecitersHubView } from './views/RecitersHubView';
import { InsightsView } from './views/InsightsView';
import { SettingsView } from './views/SettingsView';
import { getChapters } from './lib/api';
import { CURATED_RECITERS, DEFAULT_RECITER_ID } from './lib/constants';
import { Palette } from 'lucide-react';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('home');
  const [currentTheme, setCurrentTheme] = useState('midnight-scholar');
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);
  const { setChapters, setReciter, customReciters, ambientVolume } = usePlayer();
  const themes = Object.keys(THEME_LIBRARY);

  useEffect(() => {
    let isMounted = true;
    async function initApp() {
      const chaptersData = await getChapters();
      if (!isMounted) return;
      setChapters(chaptersData);
      
      const allReciters = [...CURATED_RECITERS, ...customReciters];
      const defaultReciter = allReciters.find(r => r.id === DEFAULT_RECITER_ID) || allReciters[0];
      setReciter(defaultReciter);
    }
    
    initApp();
    return () => { isMounted = false; };
  }, [customReciters]); // Re-evaluate default if custom reciters load

  return (
    <div className="min-h-screen flex bg-[#030712] text-slate-200 font-sans selection:bg-teal-500/30">
      <QuranicPremiumBackground 
        themeName={currentTheme}
        ambientVolume={ambientVolume}
      />
      
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-72 pb-40 overflow-y-auto h-screen relative z-10 transition-all">
        <div className="p-4 md:p-10 md:max-w-7xl mx-auto h-full">
          {currentTab === 'home' && <HomeView />}
          {currentTab === 'hub' && <HubView />}
          {currentTab === 'library' && <SurahLibraryView />}
          {currentTab === 'reciters' && <RecitersHubView />}
          {currentTab === 'insights' && <InsightsView />}
          {currentTab === 'settings' && <SettingsView />}
        </div>
      </main>
      <BottomPlayer />

      {/* Theme Switcher Toggle */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        <button 
          onClick={() => setShowThemeSwitcher(!showThemeSwitcher)}
          className="w-12 h-12 bg-[#0F172A]/80 hover:bg-[#1E293B] backdrop-blur-xl border border-teal-900/30 rounded-full flex items-center justify-center text-teal-400 shadow-lg transition-all"
        >
          <Palette size={20} />
        </button>

        {showThemeSwitcher && (
          <div className="bg-[#0F172A]/90 backdrop-blur-xl p-4 rounded-2xl border border-teal-900/30 shadow-2xl animate-in fade-in slide-in-from-top-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Premium Themes</h3>
            <div className="flex flex-col gap-2 min-w-[200px]">
              {themes.map((themeName) => (
                <button
                  key={themeName}
                  onClick={() => {
                    setCurrentTheme(themeName);
                    setShowThemeSwitcher(false);
                  }}
                  className={`px-4 py-3 text-xs font-medium rounded-xl transition-all text-left flex items-center justify-between ${
                    currentTheme === themeName
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'hover:bg-slate-800 text-slate-300 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span 
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: THEME_LIBRARY[themeName].colors.primary }}
                    />
                    {THEME_LIBRARY[themeName].name}
                  </span>
                  {currentTheme === themeName && (
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
