import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Shield, Users, Video, Settings as SettingsIcon, Save } from 'lucide-react';
import { AMBIENT_TRACKS } from '../lib/constants';

export function AdminView() {
  const [users, setUsers] = useState<any[]>([]);
  const [globalReciters, setGlobalReciters] = useState<any[]>([]);
  const [newReciterName, setNewReciterName] = useState('');
  const [newReciterUrl, setNewReciterUrl] = useState('');
  const [ambientSettings, setAmbientSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      
      // Fetch global reciters
      const recitersSnap = await getDocs(collection(db, 'global_reciters'));
      setGlobalReciters(recitersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      setUsers(usersSnap.docs.map(d => d.data()));
      
      // Fetch ambient settings
      const ambientSnap = await getDocs(collection(db, 'ambient_sounds'));
      const ambSettings: Record<string, string> = {};
      ambientSnap.docs.forEach(d => {
        ambSettings[d.id] = d.data().videoUrl || '';
      });
      setAmbientSettings(ambSettings);
      
    } catch (e) {
      console.error("Failed to fetch admin data", e);
    }
    setLoading(false);
  };


  const handleAddGlobalReciter = async () => {
    if (!newReciterName || !newReciterUrl) return;
    try {
      const id = 'global_' + Date.now();
      await setDoc(doc(db, 'global_reciters', id), {
        id,
        name: newReciterName,
        serverUrl: newReciterUrl,
        style: 'Custom Global',
        updatedAt: serverTimestamp()
      });
      setGlobalReciters([...globalReciters, { id, name: newReciterName, serverUrl: newReciterUrl, style: 'Custom Global' }]);
      setNewReciterName('');
      setNewReciterUrl('');
    } catch(e) {
      console.error(e);
    }
  };

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        lastLoginAt: serverTimestamp() // Ensure we don't break schema rules if it's required
      });
      setUsers(users.map(u => u.userId === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      console.error("Failed to update role", e);
    }
  };

  const handleSaveAmbient = async () => {
    setSaving(true);
    try {
      for (const [id, url] of Object.entries(ambientSettings)) {
        await setDoc(doc(db, 'ambient_sounds', id), {
          id,
          name: AMBIENT_TRACKS.find(t => t.id === id)?.name || id,
          videoUrl: url,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
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

        
        {/* Reciters & Content Control */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <h2 className="text-xl font-bold text-white mb-6">Global Reciters Manager</h2>
          <div className="flex gap-4 mb-6">
            <input 
              type="text" placeholder="Reciter Name" value={newReciterName} onChange={e => setNewReciterName(e.target.value)}
              className="flex-1 bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm"
            />
            <input 
              type="text" placeholder="Server URL" value={newReciterUrl} onChange={e => setNewReciterUrl(e.target.value)}
              className="flex-1 bg-[#0A0F1C] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm"
            />
            <button onClick={handleAddGlobalReciter} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-3 rounded-xl font-bold">Add</button>
          </div>
          <div className="grid gap-2">
            {globalReciters.map(r => (
              <div key={r.id} className="flex justify-between items-center bg-[#030712]/50 p-4 rounded-xl border border-slate-800">
                <div>
                  <h3 className="font-medium text-white">{r.name}</h3>
                  <p className="text-xs text-slate-500">{r.serverUrl}</p>
                </div>
              </div>
            ))}
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
