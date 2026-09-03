import React, { useState, useEffect } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { BottomPlayer } from './components/BottomPlayer';
import { Sidebar } from './components/Sidebar';
import { BackgroundMedia } from './components/BackgroundMedia';
import { HomeView } from './views/HomeView';
import { HubView } from './views/HubView';
import { SurahLibraryView } from './views/SurahLibraryView';
import { RecitersHubView } from './views/RecitersHubView';
import { InsightsView } from './views/InsightsView';
import { SettingsView } from './views/SettingsView';
import { getChapters } from './lib/api';
import { CURATED_RECITERS, DEFAULT_RECITER_ID } from './lib/constants';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('home');
  const { setChapters, setReciter, customReciters } = usePlayer();

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
      <BackgroundMedia />
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
