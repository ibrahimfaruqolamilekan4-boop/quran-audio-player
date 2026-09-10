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
import { readStoredTheme, storeTheme } from './lib/theme';
import { Khatam } from './components/ui';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 bg-obsidian">
        <span className="text-gold spin-slow"><Khatam size={38} /></span>
        <p className="eyebrow">Preparing your space</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

/** Gilded theme picker used across the dashboard chrome. */
function ThemeSwitcher({ currentTheme, setCurrentTheme }: { currentTheme: string; setCurrentTheme: (t: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-5 top-5 z-[60] flex flex-col items-end gap-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change ambience theme"
        className="group grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-ink-950/70 text-gold backdrop-blur-xl transition-all duration-500 hover:border-gold/40 hover:bg-ink-900"
        style={{ boxShadow: '0 14px 40px -18px rgba(0,0,0,.9)' }}
      >
        <Khatam size={19} className={open ? 'rotate-90 transition-transform duration-500' : 'transition-transform duration-500 group-hover:rotate-45'} />
      </button>

      {open && (
        <div className="surface w-[248px] animate-in scale-in duration-200 rounded-3xl p-3">
          <p className="eyebrow px-3 pb-2.5 pt-2">Ambience</p>
          <div className="flex flex-col gap-1">
            {Object.entries(THEME_LIBRARY).map(([key, theme]) => {
              const active = currentTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => { setCurrentTheme(key); setOpen(false); }}
                  className={
                    'flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-[13px] transition-all duration-300 ' +
                    (active ? 'bg-gold/[0.09] text-gold-100' : 'text-mist hover:bg-white/[0.04] hover:text-white')
                  }
                >
                  <span className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.colors.primary, boxShadow: `0 0 12px ${theme.colors.primary}66` }} />
                    {theme.name}
                  </span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_10px_var(--accent-glow)]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = location.pathname.split('/')[2] || 'home';
  const setCurrentTab = (tab: string) => navigate(`/dashboard/${tab}`);
  const [currentTheme, setCurrentTheme] = useState<string>(() => readStoredTheme());

  const { setChapters, setReciter, customReciters, ambientVolume, isPlaying } = usePlayer();

  useEffect(() => { storeTheme(currentTheme); }, [currentTheme]);

  useEffect(() => {
    let isMounted = true;
    async function initApp() {
      try {
        const chaptersData = await getChapters();
        if (!isMounted) return;
        setChapters(chaptersData);

        const allReciters = [...CURATED_RECITERS, ...customReciters];
        const defaultReciter = allReciters.find((r) => r.id === DEFAULT_RECITER_ID) || allReciters[0];
        setReciter(defaultReciter);
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    }
    initApp();
    return () => { isMounted = false; };
    // Chapters only need hydrating once; reciter list follows custom reciters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customReciters, setChapters, setReciter]);

  return (
    <div className="flex min-h-screen bg-obsidian font-sans text-mist selection:bg-gold/25">
      <QuranicPremiumBackground themeName={currentTheme} ambientVolume={ambientVolume} isPlaying={isPlaying} />

      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="relative z-10 h-screen flex-1 overflow-y-auto pb-44 md:ml-[276px]">
        <div className="mx-auto h-full max-w-[1240px] px-4 pt-6 md:px-10">
          <Routes>
            <Route path="/" element={<Navigate to="home" replace />} />
            <Route path="home" element={<HomeView />} />
            <Route path="hub" element={<HubView />} />
            <Route path="library" element={<SurahLibraryView />} />
            <Route path="reciters" element={<RecitersHubView />} />
            <Route path="reciters/:id" element={<RecitersHubView />} />
            <Route path="insights" element={<InsightsView />} />
            <Route path="settings" element={<SettingsView />} />
          </Routes>
        </div>
      </main>

      <BottomPlayer />
      <ThemeSwitcher currentTheme={currentTheme} setCurrentTheme={setCurrentTheme} />
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
