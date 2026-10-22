import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Video, Upload, Trash2, Save, RefreshCw, Play, X, Film, Globe, Star, Check } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useBackgroundVideoSrc } from '../../lib/backgrounds';
import { validateFile, uploadMediaToServer, mediaStore } from '../../lib/upload';
import { AMBIENT_TRACKS } from '../../lib/constants';
import { formatBytes } from '../../lib/recitations';
import { appApi } from '../../lib/api';
import localforage from 'localforage';
import type { CustomVideo } from '../../types';

type Toast = (message: string, type?: 'success' | 'error') => void;
type AskConfirm = (title: string, message: string, onConfirm: () => Promise<void> | void) => void;

interface Props {
  showToast: Toast;
  askConfirm: AskConfirm;
  ambientSettings: Record<string, string>;
  setAmbientSettings: (mapping: Record<string, string>) => void;
  onSaveAmbient: () => void;
  savingAmbient: boolean;
}

/**
 * Ambient background management: upload looping videos from the device or
 * add hosted video URLs (e.g. MP4/WebM from Cloudinary, Google Drive, Archive.org,
 * YouTube direct, or any CDN). Videos saved here sync across all devices,
 * including mobile PWAs, and play behind the recitation on a loop.
 */
export function BackgroundsAdmin({
  showToast,
  askConfirm,
  ambientSettings,
  setAmbientSettings,
  onSaveAmbient,
  savingAmbient,
}: Props) {
  const { customVideos, setCustomVideos, activeBackgroundVideoId, setActiveBackgroundVideoId, refreshGlobalCatalog } = usePlayer();

  const [bgName, setBgName] = useState('');
  const [bgDescription, setBgDescription] = useState('');
  const [bgUrl, setBgUrl] = useState('');
  const [bgSetDefault, setBgSetDefault] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState('');
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const persistVideos = async (updated: CustomVideo[]) => {
    setCustomVideos(updated);
    await localforage.setItem('customVideos_list', updated);
  };

  const handleAddVideoUrl = async () => {
    setBgError('');
    const name = bgName.trim();
    const url = bgUrl.trim();
    if (!name) {
      setBgError('Give this background a name (e.g. Kaaba Evening, Rain on Water).');
      return;
    }
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/'))) {
      setBgError('Please enter a valid video link starting with https:// or /');
      return;
    }

    setBgUploading(true);
    try {
      const id = `bg_vid_${Date.now()}`;
      // Save to cloud Postgres database so all devices and phone PWAs load it
      await appApi('/admin/ambient', {
        method: 'POST',
        body: {
          action: 'add_video',
          id,
          name,
          videoUrl: url,
          description: bgDescription.trim() || undefined,
          isDefault: bgSetDefault,
        },
      }).catch(err => {
        console.warn('Cloud video sync note:', err?.message);
      });

      const entry: CustomVideo = {
        id,
        name,
        videoUrl: url,
        description: bgDescription.trim() || undefined,
        isDefault: bgSetDefault,
        createdAt: Date.now(),
      };

      await persistVideos([entry, ...customVideos]);

      if (bgSetDefault || !activeBackgroundVideoId) {
        setActiveBackgroundVideoId(url);
      }

      await refreshGlobalCatalog();
      showToast(`Added background “${name}” for all devices.`, 'success');
      setBgName('');
      setBgDescription('');
      setBgUrl('');
      setBgSetDefault(false);
    } catch (err: any) {
      setBgError(err?.message || 'Failed to add video.');
      showToast(err?.message || 'Failed to add video.', 'error');
    } finally {
      setBgUploading(false);
    }
  };

  const handleUploadBackground = async (file: File) => {
    setBgError('');
    const name = bgName.trim() || file.name.replace(/\.[^/.]+$/, '');
    setBgUploading(true);
    setBgProgress(5);
    try {
      const check = validateFile(file, 'video');
      if (!check.valid) throw new Error(check.error || 'Invalid video file.');
      const id = `custom_vid_${Date.now()}`;
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'video/mp4' });

      // Store blob locally in localforage for instant offline cache
      await localforage.setItem(`customVideo_blob_${id}`, blob);
      await localforage.setItem(id, blob);
      setBgProgress(15);

      let videoUrl: string | undefined = undefined;
      videoUrl = await uploadMediaToServer(
        file,
        {
          filename: file.name,
          name,
          type: file.type || 'video/mp4',
          isDefault: bgSetDefault,
        },
        pct => setBgProgress(15 + Math.round(pct * 0.7))
      );

      if (!videoUrl) {
        throw new Error('Failed to upload video to cloud media storage. Please check connection and try again.');
      }

      setBgProgress(90);

      await appApi('/admin/ambient', {
        method: 'POST',
        body: {
          action: 'add_video',
          id,
          name,
          videoUrl,
          description: bgDescription.trim() || undefined,
          isDefault: bgSetDefault,
        },
      });

      if (bgSetDefault) {
        await appApi('/admin/ambient', {
          method: 'POST',
          body: { action: 'set_default', id, videoUrl },
        }).catch(() => {});
      }

      const entry: CustomVideo = {
        id,
        name,
        videoUrl,
        description: bgDescription.trim() || undefined,
        sizeBytes: file.size,
        isDefault: bgSetDefault,
        createdAt: Date.now(),
      };
      await persistVideos([entry, ...customVideos]);

      if (bgSetDefault || !activeBackgroundVideoId) {
        setActiveBackgroundVideoId(videoUrl);
      }

      await refreshGlobalCatalog();
      setBgProgress(100);
      showToast(`Added background “${name}” and synced to cloud for phones & tablets!`, 'success');
      setBgName('');
      setBgDescription('');
      setBgUrl('');
      setBgSetDefault(false);
    } catch (err: any) {
      setBgError(err?.message || 'Upload failed.');
      showToast(err?.message || 'Upload failed.', 'error');
    } finally {
      setBgUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSetGlobalDefault = async (video: CustomVideo) => {
    try {
      let targetUrl = video.videoUrl || video.id;
      const isPortable =
        targetUrl.startsWith('/api/media/') ||
        targetUrl.startsWith('https://') ||
        targetUrl.startsWith('http://');

      // If this video was only stored locally on this system, upload it to cloud first so phones & tablets can play it!
      if (!isPortable) {
        const blob =
          (await localforage.getItem<Blob>(video.id)) ||
          (await localforage.getItem<Blob>(`customVideo_blob_${video.id}`)) ||
          (await mediaStore.getItem<Blob>(video.id));
        if (blob) {
          showToast(`Syncing “${video.name}” to cloud for mobile & tablet playback...`, 'success');
          const hostedUrl = await uploadMediaToServer(blob, {
            filename: `${video.name || 'video'}.mp4`,
            name: video.name,
            type: blob.type || 'video/mp4',
            isDefault: true,
          });
          if (hostedUrl) {
            targetUrl = hostedUrl;
          }
        }
      }

      setActiveBackgroundVideoId(targetUrl);

      await appApi('/admin/ambient', {
        method: 'POST',
        body: {
          action: 'add_video',
          id: video.id,
          name: video.name,
          videoUrl: targetUrl,
          description: video.description,
          isDefault: true,
        },
      }).catch(() => {});

      await appApi('/admin/ambient', {
        method: 'POST',
        body: {
          action: 'set_default',
          id: video.id,
          videoUrl: targetUrl,
        },
      }).catch(() => {});

      const updated = customVideos.map(v => ({
        ...v,
        videoUrl: v.id === video.id ? targetUrl : v.videoUrl,
        isDefault: v.id === video.id,
      }));
      await persistVideos(updated);

      showToast(`“${video.name}” is now the default background on all phones, tablets, and computers!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to set global default.', 'error');
    }
  };

  const handleActivateThisDevice = (video: CustomVideo) => {
    setActiveBackgroundVideoId(video.videoUrl || video.id);
    showToast(`“${video.name}” activated on this device.`, 'success');
  };

  const handleReplaceVideo = async (id: string, file: File) => {
    try {
      const check = validateFile(file, 'video');
      if (!check.valid) throw new Error(check.error || 'Invalid video file.');
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'video/mp4' });
      await localforage.setItem(`customVideo_blob_${id}`, blob);
      await localforage.setItem(id, blob);

      const existing = customVideos.find(v => v.id === id);
      let newUrl = existing?.videoUrl;
      try {
        newUrl = await uploadMediaToServer(file, {
          filename: file.name,
          name: existing?.name || file.name,
          type: file.type || 'video/mp4',
          isDefault: existing?.isDefault,
        });
        if (newUrl && existing) {
          await appApi('/admin/ambient', {
            method: 'POST',
            body: {
              action: 'add_video',
              id,
              name: existing.name,
              videoUrl: newUrl,
              description: existing.description,
              isDefault: existing.isDefault,
            },
          }).catch(() => {});
        }
      } catch {}

      await persistVideos(
        customVideos.map((v) => (v.id === id ? { ...v, sizeBytes: file.size, videoUrl: newUrl || v.videoUrl } : v))
      );
      showToast('Background video replaced and synced across all devices.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Replace failed.', 'error');
    } finally {
      setReplacingId(null);
    }
  };

  const handleDeleteVideo = (video: CustomVideo) => {
    askConfirm(
      'Delete Background',
      `Delete “${video.name}”? It will be removed from all devices.`,
      async () => {
        try {
          if (activeBackgroundVideoId === video.id || (video.videoUrl && activeBackgroundVideoId === video.videoUrl)) {
            setActiveBackgroundVideoId(null);
          }
          await persistVideos(customVideos.filter((v) => v.id !== video.id));
          await localforage.removeItem(`customVideo_blob_${video.id}`);

          await appApi('/admin/ambient', {
            method: 'POST',
            body: {
              action: 'delete_video',
              id: video.id,
            },
          }).catch(() => {});

          await refreshGlobalCatalog();
          showToast('Background deleted.', 'success');
        } catch {
          showToast('Failed to delete background.', 'error');
        }
      }
    );
  };

  return (
    <>
      <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200 mb-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Video className="text-teal-400" size={20} />
            Ambient Background Video Library
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Add looping video backgrounds from your computer or provide a hosted video link.
            Videos added here sync to the cloud so they play automatically on your phone PWA and for all users!
          </p>
        </div>

        {/* Upload & Link Form */}
        <div className="bg-[#131722]/70 p-5 rounded-2xl border border-slate-800 mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Background name</label>
              <input
                value={bgName}
                onChange={(e) => setBgName(e.target.value)}
                placeholder="e.g. Kaaba Evening, Rain on Water, Prophet's Mosque"
                className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Description (optional)</label>
              <input
                value={bgDescription}
                onChange={(e) => setBgDescription(e.target.value)}
                placeholder="Peaceful golden hour recitation loop..."
                className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Globe size={12} className="text-teal-400" />
              Video URL (Recommended for cross-device sync & phone PWA)
            </label>
            <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <input
                value={bgUrl}
                onChange={(e) => setBgUrl(e.target.value)}
                placeholder="https://example.com/loop.mp4 or Cloudinary / Drive link"
                className="flex-1 bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500 font-mono"
              />
              <button
                type="button"
                onClick={handleAddVideoUrl}
                disabled={bgUploading || !bgUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 text-xs font-bold flex items-center justify-center gap-2 shrink-0 transition-colors shadow-lg shadow-teal-500/20"
              >
                <Save size={14} /> Add Video URL
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Supports any direct MP4 or WebM video loop. Links load instantly on all mobile phones and desktop.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0F1C] border border-slate-700 text-slate-300 text-xs font-semibold hover:border-teal-500/50 transition-colors"
              >
                <Upload size={14} className="text-teal-400" />
                Or Browse Video File from Device
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadBackground(f); }}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bgSetDefault}
                onChange={(e) => setBgSetDefault(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-teal-500 focus:ring-teal-400 focus:ring-offset-0 bg-[#0A0F1C]"
              />
              <span className="text-teal-300 font-medium">Set as default background for all users & phone PWAs</span>
            </label>
          </div>

          {bgUploading && (
            <div className="mt-3 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 transition-all duration-200" style={{ width: `${bgProgress}%` }} />
            </div>
          )}
          {bgError && <p className="mt-2 text-xs text-red-400">{bgError}</p>}
        </div>

        {/* Background list */}
        <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Film size={15} className="text-teal-400" />
            Backgrounds ({customVideos.length})
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            Click any video below to activate or set as global default
          </span>
        </h3>

        {customVideos.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
            No background videos added yet — enter a video URL or upload a file above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customVideos.map((video) => {
              const isActive = activeBackgroundVideoId === video.id || (video.videoUrl && activeBackgroundVideoId === video.videoUrl);
              return (
                <div key={video.id} className="bg-[#131722]/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 relative group">
                  <button
                    onClick={() => setPreviewVideoId(video.videoUrl || video.id)}
                    className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-800 bg-black group/thumb cursor-pointer"
                    title={`Preview ${video.name}`}
                  >
                    <VideoThumb videoId={video.videoUrl || video.id} videoLibrary={customVideos} />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/40">
                      <Play size={24} className="text-white fill-current" />
                    </span>

                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {isActive && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-teal-500 text-slate-900 shadow">
                          Active Here
                        </span>
                      )}
                      {video.isDefault && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-400 text-slate-950 flex items-center gap-1 shadow">
                          <Star size={10} className="fill-current" /> Global Default
                        </span>
                      )}
                    </div>
                  </button>

                  <div>
                    <h4 className="text-xs font-semibold text-white truncate">{video.name}</h4>
                    <p className="text-[10px] text-slate-500">
                      {video.sizeBytes ? formatBytes(video.sizeBytes) : (video.videoUrl ? 'Cloud Hosted' : '')}
                      {video.createdAt ? ` · ${new Date(video.createdAt).toLocaleDateString()}` : ''}
                    </p>
                    {video.description && <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{video.description}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => handleActivateThisDevice(video)}
                      className={`text-[10px] font-semibold py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all ${
                        isActive
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : 'bg-[#0A0F1C] text-slate-300 border-slate-700 hover:border-teal-500/50'
                      }`}
                    >
                      <Check size={11} /> {isActive ? 'Active' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleSetGlobalDefault(video)}
                      className="text-[10px] font-semibold py-1.5 px-2 rounded-lg bg-[#0A0F1C] border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 flex items-center justify-center gap-1 transition-colors"
                      title="Makes this the background on phones and all devices"
                    >
                      <Star size={11} className={video.isDefault ? 'fill-current' : ''} />
                      Set Default
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => { setReplacingId(video.id); replaceRef.current?.click(); }}
                      className="text-[10px] font-semibold text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <RefreshCw size={11} /> Replace file
                    </button>
                    <button
                      onClick={() => handleDeleteVideo(video)}
                      className="text-[10px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <input
          ref={replaceRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && replacingId) handleReplaceVideo(replacingId, file);
            if (replaceRef.current) replaceRef.current.value = '';
          }}
        />
      </section>

      {/* Hosted loop URLs per ambient sound (global mapping, saved to the server) */}
      <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Video className="text-teal-400" size={20} />
              Ambient Sound Video Mapping
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Connect each soundscape (Rain, Mecca, Medina, etc.) to a video loop URL that plays automatically when that ambient sound is chosen.
            </p>
          </div>
          <button
            onClick={onSaveAmbient}
            disabled={savingAmbient}
            className="bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-900 px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20"
          >
            <Save size={16} /> {savingAmbient ? 'Saving...' : 'Save Mappings'}
          </button>
        </div>

        <div className="grid gap-4">
          {AMBIENT_TRACKS.map((track) => (
            <div key={track.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#131722]/60 p-4 rounded-2xl border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <track.icon size={20} />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-white mb-1">{track.name} loop URL</div>
                <input
                  type="text"
                  value={ambientSettings[track.id] || ''}
                  onChange={(e) => setAmbientSettings({ ...ambientSettings, [track.id]: e.target.value })}
                  placeholder="https://example.com/video.mp4"
                  className="w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:border-teal-500 outline-none font-mono"
                />
              </div>
              {ambientSettings[track.id] && (
                <button
                  type="button"
                  onClick={() => setPreviewVideoId(ambientSettings[track.id])}
                  className="px-3 py-2 rounded-xl bg-[#0A0F1C] border border-slate-700 text-teal-400 text-xs font-semibold hover:border-teal-500/40 flex items-center gap-1.5 self-end sm:self-auto shrink-0"
                >
                  <Play size={13} /> Preview
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {previewVideoId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setPreviewVideoId(null)}
          >
            <div
              className="bg-[#0F172A] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-white font-medium text-sm">Background Preview</h3>
                <button onClick={() => setPreviewVideoId(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="aspect-video bg-black relative">
                <PreviewVideo videoId={previewVideoId} videoLibrary={customVideos} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Loop preview thumbnail for one stored background id. */
function VideoThumb({ videoId, videoLibrary }: { videoId: string; videoLibrary?: CustomVideo[] }) {
  const src = useBackgroundVideoSrc(videoId, videoLibrary);
  if (!src) {
    return (
      <span className="flex h-full w-full items-center justify-center text-slate-500">
        <Film size={18} />
      </span>
    );
  }
  return <video src={src} muted loop autoPlay playsInline preload="metadata" className="w-full h-full object-cover" />;
}

/** Full-size preview video for one stored background id. */
function PreviewVideo({ videoId, videoLibrary }: { videoId: string; videoLibrary?: CustomVideo[] }) {
  const src = useBackgroundVideoSrc(videoId, videoLibrary);
  if (!src) {
    return <div className="flex h-full items-center justify-center text-slate-500 text-xs">Preview unavailable</div>;
  }
  return <video key={videoId} src={src} autoPlay loop muted controls className="w-full h-full object-contain" />;
}
