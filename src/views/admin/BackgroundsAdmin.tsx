import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Video, Upload, Trash2, Save, RefreshCw, Play, X, Film } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useBackgroundVideoSrc } from '../../lib/backgrounds';
import { validateFile } from '../../lib/upload';
import { AMBIENT_TRACKS } from '../../lib/constants';
import { formatBytes } from '../../lib/recitations';
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
 * Ambient background management (prompt §3.3): upload looping videos from the
 * device with a name and description, preview them, replace or delete them —
 * and map a hosted loop URL per ambient sound. Everything uploaded here shows
 * up in the player's “Choose background” strip automatically.
 */
export function BackgroundsAdmin({
  showToast,
  askConfirm,
  ambientSettings,
  setAmbientSettings,
  onSaveAmbient,
  savingAmbient,
}: Props) {
  const { customVideos, setCustomVideos, activeBackgroundVideoId, setActiveBackgroundVideoId } = usePlayer();

  const [bgName, setBgName] = useState('');
  const [bgDescription, setBgDescription] = useState('');
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

  const handleUploadBackground = async (file: File) => {
    setBgError('');
    const name = bgName.trim();
    if (!name) {
      setBgError('Give this background a name (e.g. Fireplace).');
      return;
    }
    setBgUploading(true);
    setBgProgress(0);
    try {
      const check = validateFile(file, 'video');
      if (!check.valid) throw new Error(check.error || 'Invalid video file.');
      setBgProgress(35);
      const id = `custom_vid_${Date.now()}`;
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      // Same storage convention SettingsView writes, so the player's shared
      // resolver (lib/backgrounds.ts) finds it by id.
      await localforage.setItem(`customVideo_blob_${id}`, blob);
      setBgProgress(90);
      const entry: CustomVideo = {
        id,
        name,
        description: bgDescription.trim() || undefined,
        sizeBytes: file.size,
        createdAt: Date.now(),
      };
      await persistVideos([entry, ...customVideos]);
      setBgProgress(100);
      showToast(`Added background “${name}”.`, 'success');
      setBgName('');
      setBgDescription('');
    } catch (err: any) {
      setBgError(err?.message || 'Upload failed.');
      showToast(err?.message || 'Upload failed.', 'error');
    } finally {
      setBgUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleReplaceVideo = async (id: string, file: File) => {
    try {
      const check = validateFile(file, 'video');
      if (!check.valid) throw new Error(check.error || 'Invalid video file.');
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      await localforage.setItem(`customVideo_blob_${id}`, blob);
      await persistVideos(customVideos.map((v) => (v.id === id ? { ...v, sizeBytes: file.size } : v)));
      showToast('Background video replaced.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Replace failed.', 'error');
    } finally {
      setReplacingId(null);
    }
  };

  const handleDeleteVideo = (video: CustomVideo) => {
    askConfirm(
      'Delete Background',
      `Delete “${video.name}”? It disappears from the background picker in the player.`,
      async () => {
        try {
          if (activeBackgroundVideoId === video.id) setActiveBackgroundVideoId(null);
          await persistVideos(customVideos.filter((v) => v.id !== video.id));
          await localforage.removeItem(`customVideo_blob_${video.id}`);
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
            Ambient Background Library
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Upload looping videos from your phone or computer. They appear in the full-screen player's
            “Choose background” strip instantly, and play behind the recitation on a loop.
          </p>
        </div>

        {/* Upload form */}
        <div className="bg-[#131722]/70 p-5 rounded-2xl border border-slate-800 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Background name</label>
              <input
                value={bgName}
                onChange={(e) => setBgName(e.target.value)}
                placeholder="e.g. Fireplace, Rain, Night Sky"
                className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Description (optional)</label>
              <input
                value={bgDescription}
                onChange={(e) => setBgDescription(e.target.value)}
                placeholder="Crackling fire, soft rain..."
                className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0F1C] border border-slate-700 text-slate-300 text-xs font-semibold hover:border-teal-500/50 transition-colors"
            >
              <Upload size={14} className="text-teal-400" />
              Browse video (MP4, WebM, MOV)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadBackground(f); }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={bgUploading}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 text-xs font-bold flex items-center gap-2"
            >
              <Upload size={14} /> {bgUploading ? `Uploading ${bgProgress}%` : 'Upload background'}
            </button>
          </div>

          {bgUploading && (
            <div className="mt-3 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 transition-all duration-200" style={{ width: `${bgProgress}%` }} />
            </div>
          )}
          {bgError && <p className="mt-2 text-xs text-red-400">{bgError}</p>}
        </div>

        {/* Background list */}
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Film size={15} className="text-teal-400" />
          Backgrounds ({customVideos.length})
        </h3>

        {customVideos.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
            No background videos yet — upload one above and it shows in the player.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customVideos.map((video) => (
              <div key={video.id} className="bg-[#131722]/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
                <button
                  onClick={() => setPreviewVideoId(video.id)}
                  className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-800 bg-black group"
                  title={`Preview ${video.name}`}
                >
                  <VideoThumb videoId={video.id} />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <Play size={20} className="text-white fill-current" />
                  </span>
                  {activeBackgroundVideoId === video.id && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-teal-500 text-slate-900">
                      Active
                    </span>
                  )}
                </button>
                <div>
                  <h4 className="text-xs font-semibold text-white truncate">{video.name}</h4>
                  <p className="text-[10px] text-slate-500">
                    {video.sizeBytes ? formatBytes(video.sizeBytes) : ''}
                    {video.sizeBytes && video.createdAt ? ' · ' : ''}
                    {video.createdAt ? new Date(video.createdAt).toLocaleDateString() : ''}
                  </p>
                  {video.description && <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{video.description}</p>}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => { setReplacingId(video.id); replaceRef.current?.click(); }}
                    className="text-[10px] font-semibold text-slate-300 hover:text-white flex items-center gap-1"
                  >
                    <RefreshCw size={11} /> Replace
                  </button>
                  <button
                    onClick={() => handleDeleteVideo(video)}
                    className="text-[10px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
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
              Optional: point each ambient soundscape at a hosted MP4/WebM loop URL.
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
                  className="w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:border-teal-500 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preview modal */}
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
                <PreviewVideo videoId={previewVideoId} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Loop preview thumbnail for one stored background id. */
function VideoThumb({ videoId }: { videoId: string }) {
  const src = useBackgroundVideoSrc(videoId);
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
function PreviewVideo({ videoId }: { videoId: string }) {
  const src = useBackgroundVideoSrc(videoId);
  if (!src) {
    return <div className="flex h-full items-center justify-center text-slate-500 text-xs">Preview unavailable</div>;
  }
  return <video key={videoId} src={src} autoPlay loop muted controls className="w-full h-full object-contain" />;
}
