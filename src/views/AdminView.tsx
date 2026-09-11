import React, { useState, useEffect } from 'react';
import { appApi } from '../lib/api';
import { Shield, Users, Video, ImagePlus, Save } from 'lucide-react';
import { AMBIENT_TRACKS, CURATED_RECITERS } from '../lib/constants';
import { ReciterAvatar } from '../components/ReciterAvatar';

export function AdminView() {
  const [users, setUsers] = useState<any[]>([]);
  const [globalReciters, setGlobalReciters] = useState<any[]>([]);
  const [newReciterName, setNewReciterName] = useState('');
  const [newReciterUrl, setNewReciterUrl] = useState('');
  const [newReciterImage, setNewReciterImage] = useState('');
  const [reciterError, setReciterError] = useState('');
  /** Photo URL drafts keyed by reciter id, for the portrait editor below. */
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, string>>({});
  const [photoSaving, setPhotoSaving] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState('');
  const [ambientSettings, setAmbientSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const data = await appApi<{
        users: any[];
        globalReciters: any[];
        ambientSounds: Record<string, string>;
      }>('/admin/overview');
      setUsers(data.users);
      setGlobalReciters(data.globalReciters);
      setAmbientSettings(data.ambientSounds);
    } catch (e) {
      console.error("Failed to fetch admin data", e);
    }
    setLoading(false);
  };


  const handleAddGlobalReciter = async () => {
    if (!newReciterName || !newReciterUrl) return;
    setReciterError('');
    try {
      const { reciter } = await appApi<{ reciter: any }>('/admin/reciters', {
        method: 'POST',
        body: {
          name: newReciterName,
          serverUrl: newReciterUrl,
          ...(newReciterImage.trim() ? { imageUrl: newReciterImage.trim() } : {}),
        },
      });
      setGlobalReciters([reciter, ...globalReciters]);
      setNewReciterName('');
      setNewReciterUrl('');
      setNewReciterImage('');
    } catch (e: any) {
      console.error(e);
      setReciterError(e?.message || 'Could not save the global reciter.');
    }
  };

  /**
   * Publish or replace the portrait of any sheikh in the built-in list. It is stored as a global
   * reciter row keyed by the same id, which resolveReciters() then applies for every user.
   * Sending an empty URL removes the override and falls back to the built-in picture.
   */
  const handleSavePhoto = async (
    reciter: { id: string; name: string; serverUrl: string },
    value: string
  ) => {
    const imageUrl = value.trim();
    setPhotoSaving(reciter.id);
    setPhotoMessage('');
    try {
      const { reciter: saved } = await appApi<{ reciter: any }>('/admin/reciters', {
        method: 'POST',
        body: { id: reciter.id, name: reciter.name, serverUrl: reciter.serverUrl, imageUrl },
      });
      setGlobalReciters(prev => [saved, ...prev.filter(r => r.id !== reciter.id)]);
      if (imageUrl && !saved?.imageUrl) {
        setPhotoMessage(
          `${reciter.name}: details saved, but the photo was dropped — the image_url column does not exist yet. Run "node scripts/apply-schema.mjs" once, then save again.`
        );
      } else {
        setPhotoMessage(
          imageUrl ? `${reciter.name}'s portrait is live for everyone.` : `${reciter.name}'s portrait override was removed.`
        );
      }
    } catch (e: any) {
      setPhotoMessage(e?.message || 'Could not save the portrait.');
    }
    setPhotoSaving(null);
  };

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await appApi('/admin/role', { method: 'PUT', body: { userId, role: newRole } });
      setUsers(users.map(u => u.userId === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      console.error("Failed to update role", e);
    }
  };

  const handleSaveAmbient = async () => {
    setSaving(true);
    try {
      await appApi('/admin/ambient', { method: 'PUT', body: { sounds: ambientSettings } });
      alert('Global ambient settings saved successfully.');
    } catch (e) {
      console.error("Failed to save ambient settings", e);
      alert('Failed to save settings.');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-teal-500">Loading admin panel...</div>;

  return (
    <div className="max-w-7xl mx-auto h-full">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
          <Shield className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-400 mt-1">Manage global application settings and users.</p>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Ambient Settings */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Video className="w-5 h-5 text-teal-500" />
              Global Background Media Manager
            </h2>
            <button 
              onClick={handleSaveAmbient}
              disabled={saving}
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-4 py-2 rounded-xl font-medium flex items-center gap-2"
            >
              <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-6">Set global video URLs (e.g., hosted MP4s or Pixabay URLs) for ambient sounds. These will be used for all users.</p>
          
          <div className="grid gap-4">
            {AMBIENT_TRACKS.map(track => (
              <div key={track.id} className="flex items-center gap-4 bg-[#030712]/50 p-4 rounded-xl border border-slate-800">
                <track.icon className="w-6 h-6 text-teal-500 flex-shrink-0" />
                <div className="flex-1">
                  <label className="text-xs text-slate-500 font-medium mb-1 block">{track.name} Video URL</label>
                  <input 
                    type="text"
                    value={ambientSettings[track.id] || ''}
                    onChange={e => setAmbientSettings({ ...ambientSettings, [track.id]: e.target.value })}
                    placeholder="https://example.com/video.mp4"
                    className="w-full bg-[#0A0F1C] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-teal-500 outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        
        {/* Sheikh Portraits */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
            <ImagePlus className="w-5 h-5 text-teal-500" />
            Sheikh Profile Pictures
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Add or change the portrait of any reciter, including the built-in ones. Paste a direct
            image link (it must end in .jpg, .png or similar). Save applies it for every user; clear
            the box and save to fall back to the picture we ship with, or their initials.
          </p>
          {photoMessage && (
            <p className={`text-sm mb-5 ${photoMessage.includes('dropped') || photoMessage.includes('Could not') ? 'text-red-400' : 'text-teal-400'}`}>
              {photoMessage}
            </p>
          )}
          <div className="grid gap-2">
            {CURATED_RECITERS.map(r => {
              const override = globalReciters.find(g => g.id === r.id)?.imageUrl || '';
              const draft = photoDrafts[r.id] ?? override ?? r.imageUrl ?? '';
              const dirty = draft.trim() !== (override || r.imageUrl || '').trim();
              return (
                <div key={r.id} className="flex flex-col md:flex-row md:items-center gap-3 bg-[#030712]/50 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-4 min-w-0 md:w-64 shrink-0">
                    <div className="w-11 h-11 shrink-0">
                      <ReciterAvatar
                        reciter={{ name: r.name, imageUrl: draft.trim() || undefined }}
                        contentClassName="text-xs"
                        shape="circle"
                        iconSize={16}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white truncate">{r.name}</h3>
                      <p className="text-xs text-slate-500 truncate">
                        {r.region || '—'}
                        {override ? <span className="text-teal-500"> · custom photo</span> : null}
                      </p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={draft}
                    onChange={e => setPhotoDrafts({ ...photoDrafts, [r.id]: e.target.value })}
                    placeholder="https://example.com/sheikh.jpg"
                    className="flex-1 bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:border-teal-500 outline-none"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSavePhoto(r, draft)}
                      disabled={photoSaving === r.id || !dirty}
                      className="bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:hover:bg-teal-500 text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap"
                    >
                      {photoSaving === r.id ? 'Saving…' : 'Save'}
                    </button>
                    {dirty && (
                      <button
                        onClick={() => setPhotoDrafts({ ...photoDrafts, [r.id]: override || r.imageUrl || '' })}
                        className="text-slate-500 hover:text-white text-xs"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Reciters & Content Control */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <h2 className="text-xl font-bold text-white mb-2">Global Reciters Manager</h2>
          <p className="text-sm text-slate-500 mb-6">
            Global reciters are shared by every account. A photo link is optional — without one we show their initials.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_auto] gap-4 mb-3">
            <input 
              type="text" placeholder="Reciter Name" value={newReciterName} onChange={e => setNewReciterName(e.target.value)}
              className="bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-teal-500 outline-none"
            />
            <input 
              type="text" placeholder="Server URL (https://server.mp3quran.net/name/)" value={newReciterUrl} onChange={e => setNewReciterUrl(e.target.value)}
              className="bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-teal-500 outline-none"
            />
            <button onClick={handleAddGlobalReciter} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-3 rounded-xl font-bold">Add</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 mb-6">
            <input
              type="text"
              placeholder="Photo URL (optional — https://site.net/sheikh.jpg)"
              value={newReciterImage}
              onChange={e => setNewReciterImage(e.target.value)}
              className="bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:border-teal-500 outline-none"
            />
            <div className="w-12 h-12 shrink-0">
              <ReciterAvatar
                reciter={{ name: newReciterName || 'New', imageUrl: newReciterImage.trim() || undefined }}
                contentClassName="text-sm"
                shape="circle"
                iconSize={18}
              />
            </div>
          </div>
          {reciterError && <p className="text-red-400 text-sm mb-4">{reciterError}</p>}
          <div className="grid gap-2">
            {globalReciters.length === 0 ? (
              <p className="text-slate-500 text-center py-4 text-sm">No global reciters yet.</p>
            ) : (
              globalReciters.map(r => (
                <div key={r.id} className="flex justify-between items-center gap-4 bg-[#030712]/50 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 shrink-0">
                      <ReciterAvatar reciter={r} contentClassName="text-xs" shape="circle" iconSize={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white truncate">{r.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{r.serverUrl}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* User Management */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <Users className="w-5 h-5 text-teal-500" />
            User Management ({users.length})
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-3 px-4">User</th>
                  <th className="pb-3 px-4">Email</th>
                  <th className="pb-3 px-4">Role</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {users.map(u => (
                  <tr key={u.userId} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">U</div>
                        )}
                        <span className="font-medium text-white">{u.displayName || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button 
                        onClick={() => handleRoleToggle(u.userId, u.role || 'user')}
                        className="text-teal-400 hover:text-teal-300 text-xs font-medium"
                      >
                        Toggle Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
