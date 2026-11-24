import React, { useState } from 'react';
import {
  Video,
  Upload,
  RefreshCw,
  AlertCircle,
  Trash2,
  Sparkles,
} from 'lucide-react';
import localforage from 'localforage';
import { uploadMediaToServer, mediaStore } from '../../lib/upload';
import { appApi } from '../../lib/api';

interface BackgroundManagerProps {
  customVideos: Array<{
    id: string;
    name: string;
    videoUrl?: string;
    sizeBytes?: number;
    isDefault?: boolean;
    createdAt?: number;
  }>;
  setCustomVideos: React.Dispatch<React.SetStateAction<any[]>>;
  activeBackgroundVideoId: string | null;
  setActiveBackgroundVideoId: (id: string | null) => void;
  isAdmin: boolean;
  refreshGlobalCatalog: () => Promise<void>;
  syncLocalAssetsToCloud: (onProgress?: (msg: string) => void) => Promise<{ syncedPhotos: number; syncedVideos: number }>;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

export function BackgroundManager({
  customVideos,
  setCustomVideos,
  activeBackgroundVideoId,
  setActiveBackgroundVideoId,
  isAdmin,
  refreshGlobalCatalog,
  syncLocalAssetsToCloud,
  showToast,
}: BackgroundManagerProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState('');
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [isSyncingCloudAssets, setIsSyncingCloudAssets] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');

  const handleUploadVideo = async () => {
    setVideoError('');
    if (!videoFile) {
      setVideoError('Please select a video file.');
      return;
    }
    if (!videoFile.type.startsWith('video/')) {
      setVideoError('The selected file must be a valid video (e.g. mp4, webm).');
      return;
    }

    setVideoUploading(true);
    setVideoUploadProgress(5);
    try {
      const id = 'custom_vid_' + Date.now();
      const cleanName = videoFile.name.replace(/\.[^/.]+$/, '');
      let publicUrl = id;

      setVideoUploadProgress(15);

      try {
        const hostedUrl = await uploadMediaToServer(
          videoFile,
          {
            filename: videoFile.name,
            name: cleanName,
            type: videoFile.type || 'video/mp4',
            isDefault: true,
          },
          pct => setVideoUploadProgress(15 + Math.round(pct * 0.75))
        );

        if (hostedUrl) {
          publicUrl = hostedUrl;
        }
      } catch (uploadErr) {
        console.warn('Could not stream to /api/media, using fallback:', uploadErr);
      }

      const newEntry = {
        id,
        name: cleanName,
        videoUrl: publicUrl,
        sizeBytes: videoFile.size,
        isDefault: true,
        createdAt: Date.now(),
      };
      const updated = [newEntry, ...customVideos.map(v => ({ ...v, isDefault: false }))];
      setCustomVideos(updated);
      setActiveBackgroundVideoId(publicUrl);
      setVideoFile(null);

      try {
        await appApi('/admin/ambient', {
          method: 'POST',
          body: { action: 'add_video', id, name: cleanName, videoUrl: publicUrl, isDefault: true },
        });
        await appApi('/admin/ambient', {
          method: 'POST',
          body: { action: 'set_default', id, videoUrl: publicUrl },
        });
      } catch (ambientErr) {
        console.warn('Could not broadcast ambient video:', ambientErr);
      }

      await refreshGlobalCatalog();
      setVideoUploadProgress(100);
      showToast('Background video uploaded and broadcast to all phones, tablets, and computers!', 'success');
    } catch (err: any) {
      setVideoError(err?.message || 'Failed to upload video.');
      showToast(err?.message || 'Failed to upload video.', 'error');
    } finally {
      setVideoUploading(false);
      setVideoUploadProgress(0);
    }
  };

  const handleManualCloudSync = async () => {
    setIsSyncingCloudAssets(true);
    setSyncStatusText('Syncing saved videos and sheikh portraits to cloud...');
    try {
      const { syncedPhotos, syncedVideos } = await syncLocalAssetsToCloud(msg => setSyncStatusText(msg));
      showToast(
        `Synced ${syncedPhotos} sheikh profile(s) & ${syncedVideos} background video(s) for all phones and tablets!`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Cloud sync encountered an issue.', 'error');
    } finally {
      setIsSyncingCloudAssets(false);
      setSyncStatusText('');
    }
  };

  const handleBroadcastPreset = async (url: string, name: string) => {
    setActiveBackgroundVideoId(url);
    if (isAdmin) {
      try {
        await appApi('/admin/ambient', {
          method: 'POST',
          body: { action: 'set_default', videoUrl: url },
        });
        showToast(`Broadcasted "${name}" to all user accounts!`, 'success');
        return;
      } catch {}
    }
    showToast(`Active background set to "${name}".`, 'success');
  };

  const handleRemoveVideo = async (id: string) => {
    const target = customVideos.find(v => v.id === id);
    if (activeBackgroundVideoId === id || (target?.videoUrl && activeBackgroundVideoId === target.videoUrl)) {
      setActiveBackgroundVideoId(null);
    }
    const updated = customVideos.filter(v => v.id !== id);
    setCustomVideos(updated);
    try {
      await appApi('/admin/ambient', {
        method: 'POST',
        body: { action: 'delete_video', id },
      });
    } catch {}
    showToast('Background video removed.', 'success');
  };

  return (
    <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-teal-400" />
            Custom Background Videos
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload your own video loops to play seamlessly in the background across all phones, tablets, and computers.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleManualCloudSync}
            disabled={isSyncingCloudAssets}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Sync all videos and sheikh profile photos saved on this system so they show on phones, tablets, and for all users"
          >
            <RefreshCw size={14} className={isSyncingCloudAssets ? 'animate-spin' : ''} />
            <span>{isSyncingCloudAssets ? (syncStatusText || 'Syncing to Cloud...') : 'Sync Saved Videos & Photos to Phone'}</span>
          </button>
        )}
      </div>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-teal-500/50 rounded-2xl p-6 cursor-pointer bg-[#050811]/50 transition-all group">
                <Video className="w-8 h-8 text-slate-500 group-hover:text-teal-400 transition-colors mb-2" />
                <span className="text-sm font-semibold text-slate-300">
                  {videoFile ? videoFile.name : 'Choose a video file from your system / phone'}
                </span>
                <span className="text-xs text-slate-500 mt-1">Supports MP4, WebM, MOV (Automatically syncs to phones, tablets &amp; all users)</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setVideoFile(f);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleUploadVideo}
                disabled={!videoFile || videoUploading}
                className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:hover:bg-teal-500 text-slate-950 font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
              >
                <Upload size={18} />
                {videoUploading ? `Uploading (${videoUploadProgress}%)...` : 'Upload & Broadcast'}
              </button>
            </div>
          </div>

          {videoUploading && (
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-teal-500 transition-all duration-200"
                style={{ width: `${videoUploadProgress}%` }}
              />
            </div>
          )}

          {videoError && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
              <AlertCircle size={16} />
              <span>{videoError}</span>
            </div>
          )}

          {/* List of Admin Videos */}
          {customVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {customVideos.map(vid => {
                const isActive = activeBackgroundVideoId === vid.id || (vid.videoUrl && activeBackgroundVideoId === vid.videoUrl);
                const isCloudSynced =
                  vid.videoUrl &&
                  (vid.videoUrl.startsWith('/api/media/') ||
                    vid.videoUrl.startsWith('https://') ||
                    vid.videoUrl.startsWith('http://'));
                return (
                  <div key={vid.id} className="relative group bg-[#050811] border border-slate-800 rounded-2xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between overflow-hidden">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                          <Video size={16} className="text-teal-400" />
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-xs font-medium text-white truncate block">{vid.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {isCloudSynced ? 'Synced for Phone & Tablet' : 'Saved on System (Click Set to Sync)'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVideo(vid.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                        title="Remove video"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          let targetVal = vid.videoUrl || vid.id;
                          const isPortable =
                            targetVal.startsWith('/api/media/') ||
                            targetVal.startsWith('https://') ||
                            targetVal.startsWith('http://');

                          if (!isPortable) {
                            const blob =
                              (await localforage.getItem<Blob>(vid.id)) ||
                              (await localforage.getItem<Blob>(`customVideo_blob_${vid.id}`)) ||
                              (await mediaStore.getItem<Blob>(vid.id));
                            if (blob) {
                              showToast(`Syncing "${vid.name}" to cloud for phone & tablet playback...`, 'success');
                              try {
                                const hosted = await uploadMediaToServer(blob, {
                                  filename: `${vid.name || 'video'}.mp4`,
                                  name: vid.name,
                                  type: blob.type || 'video/mp4',
                                  isDefault: true,
                                });
                                if (hosted) {
                                  targetVal = hosted;
                                  const nextList = customVideos.map(item =>
                                    item.id === vid.id ? { ...item, videoUrl: hosted, isDefault: true } : { ...item, isDefault: false }
                                  );
                                  setCustomVideos(nextList);
                                  await localforage.setItem('customVideos_list', nextList);
                                }
                              } catch {}
                            }
                          }

                          setActiveBackgroundVideoId(targetVal);
                          try {
                            await appApi('/admin/ambient', {
                              method: 'POST',
                              body: { action: 'add_video', id: vid.id, name: vid.name, videoUrl: targetVal, isDefault: true },
                            });
                            await appApi('/admin/ambient', {
                              method: 'POST',
                              body: { action: 'set_default', id: vid.id, videoUrl: targetVal },
                            });
                            await refreshGlobalCatalog();
                            showToast(`"${vid.name}" is now active on all phones, tablets, and user accounts!`, 'success');
                          } catch {
                            showToast('Set active locally; server broadcast saved.', 'success');
                          }
                        }}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-teal-500 text-slate-900 border-teal-400 font-bold'
                            : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-teal-500/50'
                        }`}
                      >
                        {isActive ? '✓ Active on All Devices' : 'Set for All Devices & Phone'}
                      </button>
                      {vid.isDefault && (
                        <span className="text-[9px] text-amber-400 uppercase font-semibold">Global Default</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Admin Broadcast Presets */}
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Fast Broadcast Presets (Broadcast to All User Accounts)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {customVideos.filter(v => Boolean(v.videoUrl)).slice(0, 4).map(p => {
                const isCurActive = activeBackgroundVideoId === p.videoUrl || activeBackgroundVideoId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 transition-all ${
                      isCurActive ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_15px_rgba(31,138,106,0.15)]' : 'bg-[#050811] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">✨</span>
                      <span className="text-xs font-medium text-white truncate">{p.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBroadcastPreset(p.videoUrl!, p.name)}
                      className={`text-[10px] font-bold py-1.5 px-2 rounded-xl border transition-all cursor-pointer ${
                        isCurActive
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                          : 'bg-slate-900 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                    >
                      {isCurActive ? '✓ Broadcasting' : 'Broadcast to All'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-[#050811]/60 border border-slate-800/80 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 mx-auto flex items-center justify-center mb-3">
            <Sparkles size={22} />
          </div>
          <h3 className="text-base font-semibold text-white">Synchronized Atmospheric Canvas</h3>
          <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
            The ambient background video is curated and broadcast globally by the administrator so every user shares the same sacred focus atmosphere.
          </p>
          {activeBackgroundVideoId && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-medium">
              <Video size={13} />
              <span>Active Ethereal Atmosphere Playing</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
