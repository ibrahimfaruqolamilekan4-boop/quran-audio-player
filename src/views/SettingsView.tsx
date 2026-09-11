import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { appApi } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { Plus, Trash2, Upload, Settings as SettingsIcon, AlertCircle, Play, X, Video, Check } from 'lucide-react';
import { ReciterAvatar } from '../components/ReciterAvatar';
import { AMBIENT_TRACKS } from '../lib/constants';

export function SettingsView() {
  const { customReciters, setCustomReciters, customVideos, setCustomVideos, activeBackgroundVideoId, setActiveBackgroundVideoId, ambientVideoMapping, setAmbientVideoMapping, currentReciter } = usePlayer();
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  
  const [newReciterName, setNewReciterName] = useState('');
  const [newReciterUrl, setNewReciterUrl] = useState('');
  const [newReciterImage, setNewReciterImage] = useState('');
  const [reciterError, setReciterError] = useState('');
  const [savingReciter, setSavingReciter] = useState(false);
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState('');
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

    useEffect(() => {
    let isMounted = true;
    async function loadThumbnails() {
      const urls: Record<string, string> = {};
      
      const mappedIds = Object.values(ambientVideoMapping) as string[];
      for (const vId of mappedIds) {
        if (!vId) continue;
        try {
          const blob = await localforage.getItem<Blob>(vId);
          if (blob) {
            urls[vId] = URL.createObjectURL(blob);
          }
        } catch (e) {
          console.error("Error loading ambient thumbnail", e);
        }
      }
      
      if (isMounted) setVideoUrls(urls);
    }
    
    loadThumbnails();
    
    return () => {
      isMounted = false;
      Object.values(videoUrls).forEach(url => URL.revokeObjectURL(url as string));
    };
  }, [ambientVideoMapping]);

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };


  const handleUploadAmbientVideo = async (trackId: string, file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file.');
      return;
    }
    const blob = new Blob([file], { type: file.type });
    const videoId = 'ambient_vid_' + trackId;
    
    await localforage.setItem(videoId, blob);
    const newMapping = { ...ambientVideoMapping, [trackId]: videoId };
    setAmbientVideoMapping(newMapping);
    await localforage.setItem('ambientVideoMapping', newMapping);
    
    if (user) {
      try {
         await appApi('/me/preferences', { method: 'PUT', body: { ambientVideoMapping: newMapping } });
      } catch (e) {
         console.error("Failed to sync video preferences", e);
      }
    }
  };

  const handleRemoveAmbientVideo = async (trackId: string) => {
    const videoId = ambientVideoMapping[trackId];
    if (videoId) {
      await localforage.removeItem(videoId);
    }
    const newMapping = { ...ambientVideoMapping };
    delete newMapping[trackId];
    
    setAmbientVideoMapping(newMapping);
    await localforage.setItem('ambientVideoMapping', newMapping);
    
    if (user) {
      try {
         await appApi('/me/preferences', { method: 'PUT', body: { ambientVideoMapping: newMapping } });
      } catch (e) {
         console.error("Failed to sync video preferences", e);
      }
    }
  };

  const handleAddReciter = async () => {
    setReciterError('');
    if (!newReciterName.trim()) {
      setReciterError('Please enter a name for the reciter.');
      return;
    }
    if (!newReciterUrl.trim() || !validateUrl(newReciterUrl)) {
      setReciterError('Please enter a valid server URL (e.g., https://server.net/).');
      return;
    }
    const trimmedImage = newReciterImage.trim();
    if (trimmedImage && !validateUrl(trimmedImage)) {
      setReciterError('That photo link does not look valid. Use a full URL, e.g. https://site.net/sheikh.jpg');
      return;
    }
    const reciter = {
      id: 'custom_' + Date.now(),
      name: newReciterName.trim(),
      style: 'Custom',
      serverUrl: newReciterUrl.trim().endsWith('/') ? newReciterUrl.trim() : newReciterUrl.trim() + '/',
      ...(trimmedImage ? { imageUrl: trimmedImage } : {}),
    };
    
    const updated = [...customReciters, reciter];
    setCustomReciters(updated);
    await localforage.setItem('customReciters', updated);
    
    if (user) {
      setSavingReciter(true);
      try {
        await appApi('/me/reciters', { method: 'POST', body: reciter });
      } catch (e: any) {
        // Saved on this device, but not synced — say so instead of failing silently.
        console.error("Failed to sync reciter", e);
        setReciterError(`Added on this device, but not synced to your account: ${e?.message || 'unknown error'}`);
      } finally {
        setSavingReciter(false);
      }
    }
    
    setNewReciterName('');
    setNewReciterUrl('');
    setNewReciterImage('');
  };

  const handleRemoveReciter = async (id: string) => {
    const updated = customReciters.filter(r => r.id !== id);
    setCustomReciters(updated);
    await localforage.setItem('customReciters', updated);
    if (user) {
      try {
        await appApi(`/me/reciters/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (e) {
        console.error("Failed to delete reciter", e);
      }
    }
  };

  const updateActiveBackgroundVideo = async (id: string | null) => {
    setActiveBackgroundVideoId(id);
    if (user) {
      try {
         await appApi('/me/preferences', { method: 'PUT', body: { activeBackgroundVideoId: id } });
      } catch (e) {
         console.error("Failed to sync video preferences", e);
      }
    }
  };

  const handleUploadVideo = async () => {
    setVideoError('');
    if (!videoFile) {
      setVideoError('Please select a video file.');
      return;
    }
    if (!videoFile.type.startsWith('video/')) {
      setVideoError('The selected file must be a valid video (e.g., mp4, webm).');
      return;
    }

    const blob = new Blob([videoFile], { type: videoFile.type });
    const id = 'custom_vid_' + Date.now();
    const updated = [...customVideos, { id, name: videoFile.name }];
    
    setCustomVideos(updated);
    await localforage.setItem('customVideos_list', updated);
    await localforage.setItem('customVideo_blob_' + id, blob);
    
    setVideoFile(null);
  };

  const handleRemoveVideo = async (id: string) => {
    if (activeBackgroundVideoId === id) {
      updateActiveBackgroundVideo(null);
    }
    const updated = customVideos.filter(v => v.id !== id);
    setCustomVideos(updated);
    await localforage.setItem('customVideos_list', updated);
    await localforage.removeItem('customVideo_blob_' + id);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
          <SettingsIcon className="w-6 h-6 text-teal-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin & Settings</h1>
          <p className="text-slate-400 mt-1">Manage custom reciters and background videos.</p>
        </div>
      </div>

      <div className="space-y-8">

        {/* Authentication Section */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Account Sync</h2>
              <p className="text-slate-400 mt-1 text-sm">Sign in to sync your custom reciters and preferences across devices.</p>
            </div>
            
            {user ? (
              <div className="flex items-center gap-4 bg-[#030712]/50 border border-slate-800 rounded-xl p-2 pl-4">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-500 flex items-center justify-center font-bold">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">{user.displayName || 'User'}</span>
                    <span className="text-xs text-slate-500">{user.email}</span>
                  </div>
                </div>
                <button 
                  onClick={logOut}
                  className="px-4 py-2 ml-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => navigate('/auth')}
                className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-xl font-semibold transition-all shadow-lg shadow-teal-500/10"
              >
                Sign In
              </button>
            )}
          </div>
        </section>

        {/* Custom Reciters */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Custom Reciters</h2>
              <p className="text-slate-500 text-sm mt-1">
                Add any sheikh hosted on a full-surah mp3 server. The photo link is optional — without one we show their initials.
              </p>
            </div>
            <div className="w-12 h-12 shrink-0">
              <ReciterAvatar
                reciter={{ name: newReciterName || 'New', imageUrl: newReciterImage.trim() || undefined }}
                contentClassName="text-sm"
                shape="circle"
                iconSize={18}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <input 
               type="text" 
               placeholder="Sheikh Name (e.g. Mishary)" 
               value={newReciterName} 
               onChange={e => { setNewReciterName(e.target.value); setReciterError(''); }}
              className={`bg-[#030712] border ${reciterError && !newReciterName.trim() ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all`}
            />
            <input 
               type="text" 
               placeholder="Server URL (e.g. https://server.net/)" 
               value={newReciterUrl} 
               onChange={e => { setNewReciterUrl(e.target.value); setReciterError(''); }}
              className={`bg-[#030712] border ${reciterError && (!newReciterUrl.trim() || !validateUrl(newReciterUrl)) ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all`}
            />
            <input
              type="text"
              placeholder="Photo URL (optional — e.g. https://site.net/sheikh.jpg)"
              value={newReciterImage}
              onChange={e => { setNewReciterImage(e.target.value); setReciterError(''); }}
              className={`bg-[#030712] border ${reciterError && newReciterImage.trim() && !validateUrl(newReciterImage) ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all md:col-span-2`}
            />
            <button 
               onClick={handleAddReciter}
               disabled={savingReciter}
              className="bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-900 font-semibold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all md:justify-self-end"
            >
              <Plus className="w-5 h-5" /> {savingReciter ? 'Saving…' : 'Add reciter'}
            </button>
          </div>
          <AnimatePresence>
            {reciterError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-red-400 text-sm mb-4">
                <AlertCircle size={16} />
                <span>{reciterError}</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="space-y-3">
            {customReciters.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No custom reciters added yet.</p>
            ) : (
              customReciters.map(reciter => (
                <div key={reciter.id} className="flex items-center justify-between gap-4 bg-[#030712]/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 shrink-0">
                      <ReciterAvatar reciter={reciter} contentClassName="text-sm" shape="circle" iconSize={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-medium truncate">{reciter.name}</h3>
                      <p className="text-sm text-slate-500 truncate max-w-xs sm:max-w-md">{reciter.serverUrl}</p>
                    </div>
                    {currentReciter?.id === reciter.id && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] uppercase tracking-wider shrink-0">
                        <Check size={11} strokeWidth={3} /> Active
                      </span>
                    )}
                  </div>
                  <button onClick={() => handleRemoveReciter(reciter.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        
        {/* Background Media Settings */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <h2 className="text-xl font-bold text-white mb-2">Background Media Settings</h2>
          <p className="text-slate-400 mb-6 text-sm">Upload custom background videos for each ambient sound category. These will play automatically when the ambient sound is active.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AMBIENT_TRACKS.map(track => {
              const videoId = ambientVideoMapping[track.id];
              const thumbUrl = videoId ? videoUrls[videoId] : null;
              
              return (
                <div key={track.id} className="flex items-center justify-between bg-[#030712]/50 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                      <track.icon className="w-6 h-6 text-teal-500" />
                    </div>
                    
                    {/* Thumbnail / Upload Trigger */}
                    {thumbUrl ? (
                      <button 
                         onClick={() => setPreviewVideoUrl(thumbUrl)}
                         className="w-20 h-14 bg-black rounded-lg overflow-hidden border border-slate-700 relative flex-shrink-0 group hover:border-teal-500/50 transition-colors"
                         title="Preview Video"
                      >
                         <video src={thumbUrl} className="w-full h-full object-cover opacity-60" />
                         <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                           <Play className="w-5 h-5 text-white fill-current" />
                         </div>
                      </button>
                    ) : (
                      <div className="relative w-20 h-14 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed flex items-center justify-center overflow-hidden hover:border-teal-500/50 transition-colors group cursor-pointer">
                        <input 
                           type="file" 
                           accept="video/mp4,video/webm,video/*"
                           onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) handleUploadAmbientVideo(track.id, file);
                           }}
                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                           title={`Upload video for ${track.name}`}
                        />
                        <Upload className="w-5 h-5 text-slate-500 group-hover:text-teal-400" />
                      </div>
                    )}
                    
                    <div className="flex flex-col">
                      <h3 className="font-medium text-white text-sm">{track.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                        {thumbUrl ? 'Custom Video' : 'Default'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {thumbUrl && (
                      <button 
                         onClick={() => handleRemoveAmbientVideo(track.id)}
                         className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                         title="Remove Video"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>


        {/* Video Preview Modal */}
        <AnimatePresence>
          {previewVideoUrl && (
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
              onClick={() => setPreviewVideoUrl(null)}
            >
              <div 
                className="bg-[#0F172A] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl max-w-4xl w-full"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                  <h3 className="text-white font-medium">Video Preview</h3>
                  <button 
                    onClick={() => setPreviewVideoUrl(null)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="aspect-video bg-black relative">
                  <video 
                     src={previewVideoUrl} 
                     autoPlay 
                     loop 
                     muted 
                     controls
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
