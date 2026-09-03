import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { Plus, Trash2, Upload, Settings as SettingsIcon, AlertCircle } from 'lucide-react';

export function SettingsView() {
  const { customReciters, setCustomReciters, customVideos, setCustomVideos } = usePlayer();
  const [newReciterName, setNewReciterName] = useState('');
  const [newReciterUrl, setNewReciterUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoName, setVideoName] = useState('');

  const [reciterError, setReciterError] = useState('');
  const [videoError, setVideoError] = useState('');

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
    if (!videoName.trim()) {
      setVideoError('Please enter a name for the video.');
      return;
    }
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
    const updated = [...customVideos, { id, name: videoName.trim() }];
    
    setCustomVideos(updated);
    await localforage.setItem('customVideos_list', updated);
    await localforage.setItem('customVideo_blob_' + id, blob);
    setVideoFile(null);
    setVideoName('');
  };

  const handleRemoveVideo = async (id: string) => {
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
          <h2 className="text-xl font-bold text-white mb-6">Custom Background Videos</h2>
          <div className="flex flex-col md:flex-row gap-4 mb-3">
            <input 
              type="text" 
              placeholder="Video Name (e.g. Makkah Live)" 
              value={videoName} 
              onChange={e => { setVideoName(e.target.value); setVideoError(''); }}
              className={`flex-1 bg-[#030712] border ${videoError && !videoName.trim() ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all`}
            />
            <div className="flex-1 relative">
              <input 
                type="file" 
                accept="video/mp4,video/webm"
                onChange={e => { setVideoFile(e.target.files?.[0] || null); setVideoError(''); }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`bg-[#030712] border ${videoError && !videoFile ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white flex items-center justify-between`}>
                <span className="truncate">{videoFile ? videoFile.name : 'Choose Video File...'}</span>
                <Upload className="w-5 h-5 text-slate-400" />
              </div>
            </div>
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

          <div className="space-y-3">
            {customVideos.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No custom videos uploaded yet.</p>
            ) : (
              customVideos.map(video => (
                <div key={video.id} className="flex items-center justify-between bg-[#030712]/50 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-slate-400" />
                    </div>
                    <h3 className="text-white font-medium">{video.name}</h3>
                  </div>
                  <button onClick={() => handleRemoveVideo(video.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
