import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { Plus, Trash2, Upload, Settings as SettingsIcon, AlertCircle, Play, X, Video } from 'lucide-react';

export function SettingsView() {
  const { customReciters, setCustomReciters, customVideos, setCustomVideos, activeBackgroundVideoId, setActiveBackgroundVideoId } = usePlayer();
  
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
    setNewReciterName('');
    setNewReciterUrl('');
  };

  const handleRemoveReciter = async (id: string) => {
    const updated = customReciters.filter(r => r.id !== id);
    setCustomReciters(updated);
    await localforage.setItem('customReciters', updated);
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
      setActiveBackgroundVideoId(null);
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
                        onClick={() => setActiveBackgroundVideoId(isActive ? null : video.id)}
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
