import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { Plus, Trash2, Upload, Settings as SettingsIcon, AlertCircle, Play, X, Video } from 'lucide-react';

export function SettingsView() {
  const { customReciters, setCustomReciters, customVideos, setCustomVideos, activeBackgroundVideoId, setActiveBackgroundVideoId } = usePlayer();
  const { user, signInWithGoogle, logOut } = useAuth();
  
  const [newReciterName, setNewReciterName] = useState('');
  const [newReciterUrl, setNewReciterUrl] = useState('');
  const [reciterError, setReciterError] = useState('');
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState('');
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    
    // Load object URLs for thumbnails
    async function loadThumbnails() {
      const urls: Record<string, string> = {};
      for (const video of customVideos) {
        try {
          const blob = await localforage.getItem<Blob>('customVideo_blob_' + video.id);
          if (blob) {
            urls[video.id] = URL.createObjectURL(blob);
          }
        } catch (e) {
          console.error("Error loading thumbnail", e);
        }
      }
      if (isMounted) setVideoUrls(urls);
    }
    
    loadThumbnails();
    
    return () => {
      isMounted = false;
      Object.values(videoUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [customVideos]);

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
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
    const reciter = {
      id: 'custom_' + Date.now(),
      name: newReciterName.trim(),
      style: 'Custom',
      serverUrl: newReciterUrl.trim().endsWith('/') ? newReciterUrl.trim() : newReciterUrl.trim() + '/',
    };
    
    const updated = [...customReciters, reciter];
    setCustomReciters(updated);
    await localforage.setItem('customReciters', updated);
    
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'customReciters', reciter.id), {
          ...reciter,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Failed to sync reciter", e);
      }
    }
    
    setNewReciterName('');
    setNewReciterUrl('');
  };

  const handleRemoveReciter = async (id: string) => {
    const updated = customReciters.filter(r => r.id !== id);
    setCustomReciters(updated);
    await localforage.setItem('customReciters', updated);
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'customReciters', id));
      } catch (e) {
        console.error("Failed to delete reciter", e);
      }
    }
  };

  const updateActiveBackgroundVideo = async (id: string | null) => {
    setActiveBackgroundVideoId(id);
    if (user) {
      try {
         await updateDoc(doc(db, 'users', user.uid, 'preferences', 'default'), {
           activeBackgroundVideoId: id,
           updatedAt: serverTimestamp()
         });
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
                onClick={signInWithGoogle}
                className="px-6 py-3 bg-white hover:bg-slate-200 text-slate-900 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-white/5"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  <path fill="none" d="M1 1h22v22H1z" />
                </svg>
                Sign in with Google
              </button>
            )}
          </div>
        </section>

        {/* Custom Reciters */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <h2 className="text-xl font-bold text-white mb-6">Custom Reciters</h2>
          <div className="flex flex-col md:flex-row gap-4 mb-3">
            <input 
               type="text" 
               placeholder="Sheikh Name (e.g. Mishary)" 
               value={newReciterName} 
               onChange={e => { setNewReciterName(e.target.value); setReciterError(''); }}
              className={`flex-1 bg-[#030712] border ${reciterError && !newReciterName.trim() ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all`}
            />
            <input 
               type="text" 
               placeholder="Server URL (e.g. https://server.net/)" 
               value={newReciterUrl} 
               onChange={e => { setNewReciterUrl(e.target.value); setReciterError(''); }}
              className={`flex-1 bg-[#030712] border ${reciterError && (!newReciterUrl.trim() || !validateUrl(newReciterUrl)) ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all`}
            />
            <button 
               onClick={handleAddReciter}
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-5 h-5" /> Add
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
                <div key={reciter.id} className="flex items-center justify-between bg-[#030712]/50 border border-slate-800 rounded-xl p-4">
                  <div>
                    <h3 className="text-white font-medium">{reciter.name}</h3>
                    <p className="text-sm text-slate-500 truncate max-w-xs sm:max-w-md">{reciter.serverUrl}</p>
                  </div>
                  <button onClick={() => handleRemoveReciter(reciter.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Custom Videos */}
        <section className="bg-[#131722]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 lg:p-8">
          <h2 className="text-xl font-bold text-white mb-2">Custom Background Videos</h2>
          <p className="text-slate-400 mb-6 text-sm">Upload videos directly from your device/gallery. Tap the play icon next to an uploaded video to set it as your active background.</p>
          
          <div className="flex flex-col md:flex-row gap-4 mb-3">
            <div className="flex-1 relative">
              <input 
                type="file" 
                accept="video/mp4,video/webm,video/*"
                onChange={e => { setVideoFile(e.target.files?.[0] || null); setVideoError(''); }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Upload from Gallery / Device"
              />
              <div className={`bg-[#030712] border ${videoError && !videoFile ? 'border-red-500' : 'border-slate-700'} hover:border-teal-500/50 rounded-xl px-4 py-3 text-white flex items-center justify-between transition-all`}>
                <span className="truncate">{videoFile ? videoFile.name : 'Choose Video from Gallery/Device...'}</span>
                <Upload className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            {videoFile && (
              <div className="w-16 h-12 bg-black rounded-lg overflow-hidden border border-slate-700 relative flex-shrink-0">
                 <video src={URL.createObjectURL(videoFile)} className="w-full h-full object-cover opacity-70" />
                 <div className="absolute inset-0 flex items-center justify-center">
                   <Video className="w-5 h-5 text-white/80" />
                 </div>
              </div>
            )}
            <button 
               onClick={handleUploadVideo}
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all relative z-20"
            >
              <Plus className="w-5 h-5" /> Upload
            </button>
          </div>
          <AnimatePresence>
            {videoError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-red-400 text-sm mb-4">
                <AlertCircle size={16} />
                <span>{videoError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3 mt-6">
            {customVideos.length === 0 ? (
              <p className="text-slate-500 text-center py-8 bg-[#030712]/30 rounded-xl border border-slate-800/50 border-dashed">No custom background videos uploaded yet.</p>
            ) : (
              customVideos.map(video => {
                const isActive = activeBackgroundVideoId === video.id;
                const thumbUrl = videoUrls[video.id];
                return (
                  <div key={video.id} className={`flex items-center justify-between ${isActive ? 'bg-teal-500/10 border-teal-500/50' : 'bg-[#030712]/50 border-slate-800'} border rounded-xl p-4 transition-all group`}>
                    <div className="flex items-center gap-4">
                      
                      {/* Thumbnail & Preview Button */}
                      <button 
                        onClick={() => thumbUrl && setPreviewVideoUrl(thumbUrl)}
                        className="w-16 h-12 bg-black rounded-lg overflow-hidden border border-slate-700 relative flex-shrink-0 group-hover:border-teal-500/50 transition-colors"
                        title="Preview Video"
                      >
                         {thumbUrl ? (
                           <>
                             <video src={thumbUrl} className="w-full h-full object-cover opacity-60" />
                             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                               <Play className="w-5 h-5 text-white fill-current" />
                             </div>
                           </>
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-slate-800">
                             <Video className="w-5 h-5 text-slate-500" />
                           </div>
                         )}
                      </button>

                      <div className="flex flex-col">
                        <h3 className={`font-medium truncate max-w-[120px] sm:max-w-xs ${isActive ? 'text-teal-400' : 'text-white'}`}>{video.name}</h3>
                        {isActive && <span className="text-[10px] uppercase tracking-wider text-teal-500/80 font-semibold">Active Background</span>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateActiveBackgroundVideo(isActive ? null : video.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-teal-500 text-slate-900' : 'bg-slate-800 text-teal-400 hover:bg-slate-700'}`}
                      >
                        {isActive ? 'Active' : 'Set Active'}
                      </button>
                      <button 
                        onClick={() => handleRemoveVideo(video.id)} 
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors ml-2"
                        title="Delete Video"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
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
