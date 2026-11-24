import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ShieldCheck, Pencil, RefreshCw } from 'lucide-react';
import { appApi } from '../../lib/api';
import { DownloadManager } from '../../components/DownloadManager';
import { APP_BUILD_VERSION } from '../../lib/featureFlags';

interface ProfileSectionProps {
  user: any;
  isAdmin: boolean;
  onSignOut: () => void;
  onRefreshUser: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

export function ProfileSection({
  user,
  isAdmin,
  onSignOut,
  onRefreshUser,
  showToast,
}: ProfileSectionProps) {
  const navigate = useNavigate();
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');

  return (
    <div className="space-y-8">
      {/* Appearance & Quranic Typography Settings */}
      <section className="bg-[#0C2A20] backdrop-blur-xl border border-white/8 rounded-3xl p-6 lg:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-white/8">
          <div className="w-9 h-9 rounded-xl bg-[#1F8A6A]/20 text-[#34C38F] flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-[#F6F1E4]">Appearance & Quran Typography</h2>
            <p className="text-xs text-[#A8BFB3]">Customize Quranic Arabic ayah font sizing and visual theme.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quran Ayah Font Scale */}
          <div className="space-y-2.5">
            <label className="text-sm font-semibold text-[#F6F1E4] block">
              Quran Ayah Font Size
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: 'S', label: 'Small (24px)' },
                { id: 'M', label: 'Medium (28px)' },
                { id: 'L', label: 'Large (32px)' },
                { id: 'XL', label: 'Extra (38px)' },
              ].map(size => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => {
                    document.documentElement.setAttribute('data-quran-size', size.id);
                    localStorage.setItem('nooraya_quran_size', size.id);
                  }}
                  className="flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all bg-[#11382B] hover:bg-[#176B53] text-[#F6F1E4] border border-white/8 active:scale-95 cursor-pointer text-center"
                >
                  {size.id}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#A8BFB3]">
              Preview: <span className="font-quran text-[#34C38F] ml-1">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
            </p>
          </div>

          {/* App Visual Identity */}
          <div className="space-y-2.5">
            <label className="text-sm font-semibold text-[#F6F1E4] block">
              Visual Sanctuary Theme
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: 'dark', label: 'Medina Emerald (Dark)' },
                { id: 'light', label: 'Desert Pearl (Light)' },
              ].map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    const nextMode = theme.id === 'light' ? 'light' : 'dark';
                    if (nextMode === 'light') {
                      document.documentElement.classList.add('light');
                      document.documentElement.setAttribute('data-theme', 'light');
                    } else {
                      document.documentElement.classList.remove('light');
                      document.documentElement.setAttribute('data-theme', 'dark');
                    }
                    const metaTheme = document.querySelector('meta[name="theme-color"]');
                    if (metaTheme) {
                      metaTheme.setAttribute('content', nextMode === 'light' ? '#F4EFE6' : '#06150F');
                    }
                    try {
                      localStorage.setItem('nooraya_theme', nextMode);
                      localStorage.setItem('nooraya_color_theme', nextMode);
                    } catch {}
                    window.dispatchEvent(new CustomEvent('nooraya-theme-changed', { detail: nextMode }));
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all bg-[#11382B] hover:bg-[#176B53] text-[#F6F1E4] border border-white/8 active:scale-95 cursor-pointer text-center"
                >
                  {theme.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#A8BFB3]">Default is Medina Emerald with deep gold highlights.</p>
          </div>
        </div>
      </section>

      {/* Account Status Card */}
      <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Account Status</h2>
              {isAdmin && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Administrator
                </span>
              )}
            </div>
            <p className="text-slate-400 mt-1 text-sm">
              {user ? `Logged in as ${user.email}` : 'Sign in to sync recitations, manage offline tracks, and save preferences.'}
            </p>
          </div>

          {user ? (
            <div className="flex items-center gap-3 bg-[#050811] border border-slate-800 rounded-2xl p-2.5 pl-4">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'A'}
                  </div>
                )}
                <div className="flex flex-col">
                  {editingDisplayName ? (
                    <form
                      className="flex items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = displayNameInput.trim();
                        if (next) {
                          appApi('/me/preferences', { method: 'PUT', body: { full_name: next } })
                            .then(() => {
                              void onRefreshUser();
                              showToast('Display name updated.', 'success');
                            })
                            .catch(() => showToast('Could not update display name.', 'error'));
                        }
                        setEditingDisplayName(false);
                      }}
                    >
                      <input
                        type="text"
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        className="bg-[#0D121F] border border-emerald-500/40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none w-36"
                        autoFocus
                      />
                      <button type="submit" className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold cursor-pointer px-1.5">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingDisplayName(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white">{user.displayName || user.email?.split('@')[0]}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayNameInput(user.displayName || user.email?.split('@')[0] || '');
                          setEditingDisplayName(true);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 text-xs cursor-pointer p-0.5"
                        title="Edit Full Name"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-slate-400 truncate max-w-[180px]">{user.email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="px-4 py-2 ml-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-2xl font-bold transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </section>

      {/* Offline Surahs & Storage Manager */}
      <section>
        <DownloadManager />
      </section>

      {/* Production Build Stamp & Diagnostics Console */}
      <section className="bg-[#0C2A20] border border-white/10 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
            Build Version &amp; Production Diagnostics
          </div>
          <p className="text-xs font-mono text-[#D1DFD8] mt-1">
            Build: {APP_BUILD_VERSION}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/diag"
            className="px-4 py-2 rounded-xl bg-[#11382B] hover:bg-[#176B53] text-[#F6F1E4] border border-white/10 text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} />
            <span>Diagnostics Log</span>
          </a>
          <a
            href="/control-audio-test.html"
            className="px-4 py-2 rounded-xl bg-[#06150F] hover:bg-white/5 text-[#A8BFB3] border border-white/10 text-xs font-semibold transition-colors"
          >
            Control Audio Test
          </a>
        </div>
      </section>

      {/* Privacy Policy — On-Device Location & Push Notification Data */}
      <section className="bg-[#0B0F17]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Privacy Policy — Location & Prayer Notifications</h3>
            <p className="text-xs text-slate-400">How Nooraya handles your geographic coordinates and prayer alerts</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-4 rounded-2xl bg-[#050811]/70 border border-slate-800/80">
            <h4 className="font-semibold text-emerald-300 mb-1">1. On-Device Location by Default</h4>
            <p className="text-slate-400">
              Your GPS coordinates or manually selected city stay strictly on your device in local storage. All astronomical prayer times (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha, Duha, and Tahajjud) and Qibla compass bearings are computed locally on your phone or computer so they work offline without sending your location to any server.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[#050811]/70 border border-slate-800/80">
            <h4 className="font-semibold text-emerald-300 mb-1">2. Server Storage Only on Push Opt-In</h4>
            <p className="text-slate-400">
              Coordinates, timezone, and calculation method are only stored on our server if you explicitly opt in to closed-app Web Push Notifications (required so our scheduler can send your prayer alert at the right minute). Turning off Push Notifications immediately deletes your stored push subscription from the server.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
