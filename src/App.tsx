import React, { useState, useEffect } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { AuthProvider } from './context/AuthContext';
import { BottomPlayer } from './components/BottomPlayer';
import { Sidebar } from './components/Sidebar';
import { QuranicPremiumBackground, THEME_LIBRARY } from './components/QuranicPremiumBackground';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { HomeView } from './views/HomeView';
import { LandingView } from './views/LandingView';
import { AuthView } from './views/AuthView';
import { AdminView } from './views/AdminView';
import { useAuth } from './context/AuthContext';
import { HubView } from './views/HubView';
import { SurahLibraryView } from './views/SurahLibraryView';
import { RecitersHubView } from './views/RecitersHubView';
import { InsightsView } from './views/InsightsView';
import { SettingsView } from './views/SettingsView';
import { getChapters } from './lib/api';
import { CURATED_RECITERS, DEFAULT_RECITER_ID } from './lib/constants';
import { Palette } from 'lucide-react';


function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center text-teal-500">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;
  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function DashboardLayout() {
  const location = useLocation();
  const currentTab = location.pathname.split('/').pop() || 'home';
  const navigate = useNavigate();
  const setCurrentTab = (tab: string) => navigate(`/dashboard/${tab}`);
  const [currentTheme, setCurrentTheme] = useState('midnight-scholar');
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);
  
  const { 
    setChapters, 
    setReciter, 
    customReciters, 
    ambientVolume,
    isPlaying
  } = usePlayer();
  
  const themes = Object.keys(THEME_LIBRARY);

  useEffect(() => {
    let isMounted = true;
    async function initApp() {
      try {
        const chaptersData = await getChapters();
        if (!isMounted) return;
        setChapters(chaptersData);
        
        const allReciters = [...CURATED_RECITERS, ...customReciters];
        const defaultReciter = allReciters.find(r => r.id === DEFAULT_RECITER_ID) || allReciters[0];
        setReciter(defaultReciter);
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    }
    
    initApp();
    return () => { isMounted = false; };
  }, [customReciters, setChapters, setReciter]);

  return (
    <div className="min-h-screen flex bg-[#030712] text-slate-200 font-sans selection:bg-teal-500/30">
      <QuranicPremiumBackground 
        themeName={currentTheme}
        ambientVolume={ambientVolume}
        isPlaying={isPlaying}
      />
      
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-72 pb-40 overflow-y-auto h-screen relative z-10 transition-all">
        <div className="p-4 md:p-10 md:max-w-7xl mx-auto h-full">
          <Routes>
            <Route path="/" element={<Navigate to="home" />} />
            <Route path="home" element={<HomeView />} />
            <Route path="hub" element={<HubView />} />
            <Route path="library" element={<SurahLibraryView />} />
            <Route path="reciters" element={<RecitersHubView />} />
            <Route path="insights" element={<InsightsView />} />
            <Route path="settings" element={<SettingsView />} />
          </Routes>
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
    <BrowserRouter>
      <AuthProvider>
        <PlayerProvider>
          <Routes>
            <Route path="/" element={<LandingView />} />
            <Route path="/auth" element={<AuthView />} />
            <Route path="/dashboard/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminView /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </PlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
