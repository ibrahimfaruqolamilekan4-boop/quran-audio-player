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
import { getChapters } from './lib/api';
import { CURATED_RECITERS, DEFAULT_RECITER_ID } from './lib/constants';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('home');
  const { setChapters, setReciter } = usePlayer();

  useEffect(() => {
    let isMounted = true;
    async function initApp() {
      const chaptersData = await getChapters();
      if (!isMounted) return;
      setChapters(chaptersData);
      
      const defaultReciter = CURATED_RECITERS.find(r => r.id === DEFAULT_RECITER_ID) || CURATED_RECITERS[0];
      setReciter(defaultReciter);
    }
    
    initApp();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen flex bg-[#0A0C10] text-slate-300 font-sans selection:bg-gold-500/30">
      <BackgroundMedia />
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-64 pb-40 overflow-y-auto h-screen relative z-10">
        <div className="p-6 md:p-12 md:max-w-7xl mx-auto h-full">
          {currentTab === 'home' && <HomeView />}
          {currentTab === 'hub' && <HubView />}
          {currentTab === 'library' && <SurahLibraryView />}
          {currentTab === 'reciters' && <RecitersHubView />}
          {currentTab === 'insights' && <InsightsView />}
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
