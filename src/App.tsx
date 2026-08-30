import React, { useState, useEffect } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { BottomPlayer } from './components/BottomPlayer';
import { Sidebar } from './components/Sidebar';
import { HubView } from './views/HubView';
import { SurahLibraryView } from './views/SurahLibraryView';
import { ReciterSelectorView } from './views/ReciterSelectorView';
import { getChapters } from './lib/api';
import { CURATED_RECITERS, DEFAULT_RECITER_ID } from './lib/constants';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('hub');
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
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-64 pb-40 overflow-y-auto h-screen relative">
        {/* Background ambient gradient glow */}
        <div className="fixed top-0 left-0 w-full h-96 bg-gold-900/5 blur-[120px] pointer-events-none -z-10" />
        
        <div className="p-6 md:p-12 md:max-w-7xl mx-auto h-full">
          {currentTab === 'hub' && <HubView />}
          {currentTab === 'library' && <SurahLibraryView />}
          {currentTab === 'playlists' && <ReciterSelectorView />}
          {currentTab === 'settings' && (
            <div className="max-w-4xl mx-auto text-center py-32 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#151921] border border-white/5 flex items-center justify-center mb-6">
                <span className="text-2xl">⚙️</span>
              </div>
              <h2 className="text-4xl font-serif text-white mb-4">Settings</h2>
              <p className="text-slate-400 font-light max-w-md leading-relaxed">Customize your listening experience, manage downloads, and adjust visual themes. Coming in a future update.</p>
            </div>
          )}
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
