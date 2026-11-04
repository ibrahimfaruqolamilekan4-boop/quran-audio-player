import React, { useState, useEffect, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Upload,
  Play,
  Square,
  Star,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sunrise,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  type AdhanVoiceRow,
  uploadAdhanAudioToCloud,
  playAdhanPreview,
  stopAdhanPlayback,
  subscribeToAdhanPlaybackState,
  getAdhanPlaybackState,
  notifyAdhanVoicesChanged,
} from '../../lib/adhanAudio';

interface AdhanVoicesAdminProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  askConfirm: (title: string, message: string, onConfirm: () => Promise<void> | void) => void;
}

export function AdhanVoicesAdmin({ showToast, askConfirm }: AdhanVoicesAdminProps) {
  const [voices, setVoices] = useState<AdhanVoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [playback, setPlayback] = useState(getAdhanPlaybackState);

  // Add custom muezzin modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNameEn, setNewNameEn] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newTitleEn, setNewTitleEn] = useState('Muezzin of Al-Masjid an-Nabawi');
  const [newMosqueEn, setNewMosqueEn] = useState('Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)');
  const [addingVoice, setAddingVoice] = useState(false);

  const loadVoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/adhan-voices?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.voices)) {
          setVoices(data.voices);
        }
      }
    } catch (e) {
      console.warn('Failed to load admin adhan voices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVoices();
  }, [loadVoices]);

  useEffect(() => {
    return subscribeToAdhanPlaybackState(setPlayback);
  }, []);

  const handleUploadAudio = async (
    voice: AdhanVoiceRow,
    variant: 'standard' | 'fajr',
    file: File
  ) => {
    if (!file) return;
    const isAudio =
      file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name);
    if (!isAudio) {
      showToast('Please select a valid audio file (MP3, M4A, WAV, or OGG).', 'error');
      return;
    }

    const key = `${voice.id}:${variant}`;
    setUploadingKey(key);
    try {
      const uploaded = await uploadAdhanAudioToCloud(file, voice.id, variant);
      const existingPaths = Array.isArray(voice.storage_paths) ? voice.storage_paths : [];
      const nextPaths = Array.from(new Set([...existingPaths, uploaded.storagePath]));

      const bodyPayload: Record<string, any> = {
        action: 'update',
        id: voice.id,
        muezzin_name_en: voice.muezzin_name_en,
        muezzin_name_ar: voice.muezzin_name_ar,
        title_en: voice.title_en,
        mosque_en: voice.mosque_en,
        mosque_ar: voice.mosque_ar,
        storage_paths: nextPaths,
        size_bytes: Math.max(Number(voice.size_bytes || 0), uploaded.sizeBytes),
        license_status: 'admin_uploaded',
      };

      if (variant === 'fajr') {
        bodyPayload.fajr_audio_url = uploaded.publicUrl;
        bodyPayload.fajr_duration_seconds = uploaded.durationSeconds;
      } else {
        bodyPayload.audio_url = uploaded.publicUrl;
        bodyPayload.duration_seconds = uploaded.durationSeconds;
      }

      const res = await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save uploaded Adhan voice row.');
      }

      notifyAdhanVoicesChanged();
      await loadVoices();
      showToast(
        `Uploaded ${variant === 'fajr' ? 'Fajr Adhan' : 'Standard Adhan'} for ${voice.muezzin_name_en} — live on all phones!`,
        'success'
      );
    } catch (e: any) {
      showToast(e?.message || 'Upload failed.', 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSetDefault = async (voice: AdhanVoiceRow) => {
    try {
      const res = await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-default', id: voice.id }),
      });
      if (res.ok) {
        notifyAdhanVoicesChanged();
        await loadVoices();
        showToast(`${voice.muezzin_name_en} set as default Adhan voice.`, 'success');
      }
    } catch {
      showToast('Failed to update default voice.', 'error');
    }
  };

  const handleToggleActive = async (voice: AdhanVoiceRow) => {
    const nextActive = voice.is_active === false ? true : false;
    try {
      const res = await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: voice.id,
          is_active: nextActive,
        }),
      });
      if (res.ok) {
        notifyAdhanVoicesChanged();
        await loadVoices();
        showToast(
          `${voice.muezzin_name_en} ${nextActive ? 'enabled' : 'hidden'} on user devices.`,
          'success'
        );
      }
    } catch {
      showToast('Failed to update visibility.', 'error');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= voices.length) return;

    const reordered = [...voices];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    const orderPayload = reordered.map((v, idx) => ({
      id: v.id,
      sort_order: idx + 1,
    }));

    setVoices(reordered.map((v, idx) => ({ ...v, sort_order: idx + 1 })));

    try {
      await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', order: orderPayload }),
      });
      notifyAdhanVoicesChanged();
      showToast('Adhan voice order updated.', 'success');
    } catch {
      showToast('Failed to save order.', 'error');
    }
  };

  const handleDeleteOrClear = (voice: AdhanVoiceRow) => {
    const hasAudio = Boolean(voice.audio_url || voice.fajr_audio_url);
    const title = voice.official_verified && hasAudio ? 'Clear Uploaded Audio' : 'Delete Muezzin Slot';
    const msg =
      voice.official_verified && hasAudio
        ? `Remove the uploaded audio files for "${voice.muezzin_name_en}" and return this official slot to "Upload when licensed"?`
        : `Delete "${voice.muezzin_name_en}" from the Adhan catalog?`;

    askConfirm(title, msg, async () => {
      try {
        const res = await fetch('/api/admin/adhan-voices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: voice.id }),
        });
        if (res.ok) {
          notifyAdhanVoicesChanged();
          await loadVoices();
          showToast('Updated Adhan catalog.', 'success');
        }
      } catch {
        showToast('Failed to delete Adhan voice.', 'error');
      }
    });
  };

  const handleAddCustomVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameEn.trim()) {
      showToast('Muezzin name in English is required.', 'error');
      return;
    }
    setAddingVoice(true);
    try {
      const res = await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          id: `muezzin_${Date.now()}`,
          muezzin_name_en: newNameEn.trim(),
          muezzin_name_ar: newNameAr.trim() || null,
          title_en: newTitleEn.trim() || 'Muezzin Adhan Recording',
          mosque_en: newMosqueEn.trim() || 'Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)',
          official_verified: false,
          license_status: 'upload_when_licensed',
          sort_order: voices.length + 1,
        }),
      });
      if (res.ok) {
        notifyAdhanVoicesChanged();
        await loadVoices();
        setShowAddModal(false);
        setNewNameEn('');
        setNewNameAr('');
        showToast('Added Muezzin slot! Now upload their Standard or Fajr Adhan audio.', 'success');
      }
    } catch {
      showToast('Failed to add Muezzin slot.', 'error');
    } finally {
      setAddingVoice(false);
    }
  };

  const uploadedCount = voices.filter((v) => Boolean(v.audio_url || v.fajr_audio_url)).length;

  return (
    <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Volume2 className="text-amber-400" size={20} />
              Adhan Voices & Muezzin Catalog ({voices.length})
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {uploadedCount} Audio Ready • Realtime Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
            Verified official muezzins of <strong className="text-slate-200">Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)</strong> under the{' '}
            <em>Presidency of Religious Affairs at the Grand Mosque and the Prophet’s Mosque</em> and{' '}
            <strong className="text-slate-200">Sheikh Mishary Rashid Alafasy</strong>. No audio is hardcoded in the codebase: upload licensed Standard and Fajr Adhan MP3/M4A files below and they sync to all user phones immediately via Supabase Realtime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {playback.isPlaying && (
            <button
              type="button"
              onClick={() => stopAdhanPlayback()}
              className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <VolumeX size={14} />
              Stop Preview
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-500/20 cursor-pointer"
          >
            <Plus size={14} />
            Add Muezzin Slot
          </button>
          <button
            type="button"
            onClick={loadVoices}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Licensing & Zero-Hardcoded Audio Policy Notice */}
      <div className="bg-emerald-950/30 border border-emerald-500/25 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
          <div className="font-bold text-emerald-300">
            Commercial Licensing & Fajr Adhan Support (&ldquo;As-salatu khayrun min an-nawm&rdquo;)
          </div>
          <p className="text-slate-400">
            Each Muezzin slot supports both a <strong className="text-slate-200">Standard Adhan</strong> and a separate{' '}
            <strong className="text-amber-300">Fajr Adhan (الصلاة خير من النوم)</strong>. Slots marked{' '}
            <span className="text-amber-300 font-semibold">Upload When Licensed</span> have verified official metadata and play the built-in Medina Sanctuary Chime until you upload a licensed recording.
          </p>
        </div>
      </div>

      {/* Add Muezzin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCustomVoice}
            className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              Add Muezzin Voice Slot
            </h3>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Muezzin Name (English) *
              </label>
              <input
                type="text"
                required
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="e.g., Sheikh Omar Hisham Al Arabi"
                className="w-full bg-[#131722] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Muezzin Name (Arabic)
              </label>
              <input
                type="text"
                value={newNameAr}
                onChange={(e) => setNewNameAr(e.target.value)}
                placeholder="الشيخ ..."
                dir="rtl"
                className="w-full bg-[#131722] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Title / Description
              </label>
              <input
                type="text"
                value={newTitleEn}
                onChange={(e) => setNewTitleEn(e.target.value)}
                className="w-full bg-[#131722] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                Mosque / Sanctuary
              </label>
              <input
                type="text"
                value={newMosqueEn}
                onChange={(e) => setNewMosqueEn(e.target.value)}
                className="w-full bg-[#131722] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingVoice}
                className="px-5 py-2 rounded-xl bg-teal-500 text-slate-950 text-xs font-bold"
              >
                {addingVoice ? 'Adding...' : 'Create Slot'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Muezzin Cards List */}
      <div className="grid gap-4">
        {voices.map((voice, idx) => {
          const hasStandardAudio = Boolean(voice.audio_url);
          const hasFajrAudio = Boolean(voice.fajr_audio_url);
          const isUploadingStd = uploadingKey === `${voice.id}:standard`;
          const isUploadingFajr = uploadingKey === `${voice.id}:fajr`;

          return (
            <div
              key={voice.id}
              className={`rounded-2xl border p-5 transition-all ${
                voice.is_active === false
                  ? 'bg-[#0D121E]/40 border-slate-800/50 opacity-60'
                  : hasStandardAudio || hasFajrAudio
                  ? 'bg-[#111927]/90 border-emerald-500/35 shadow-lg shadow-emerald-950/20'
                  : 'bg-[#131722]/75 border-slate-800'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left Info */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-500">#{idx + 1}</span>
                    <h3 className="text-sm font-bold text-white">{voice.muezzin_name_en}</h3>
                    {voice.muezzin_name_ar && (
                      <span className="text-xs font-semibold text-amber-300/90 font-arabic" dir="rtl">
                        ({voice.muezzin_name_ar})
                      </span>
                    )}
                    {voice.is_default && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        <Star size={10} className="fill-amber-300" /> Default Voice
                      </span>
                    )}
                    {voice.official_verified && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-500/15 text-teal-300 border border-teal-500/30">
                        Verified Official Roster
                      </span>
                    )}
                    {hasStandardAudio || hasFajrAudio ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Audio Live on Phones
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300/90 border border-amber-500/25 flex items-center gap-1">
                        <AlertCircle size={10} /> Upload When Licensed
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 font-medium">
                    {voice.title_en} • <span className="text-slate-400">{voice.mosque_en}</span>
                  </p>

                  {voice.license_notes && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">{voice.license_notes}</p>
                  )}
                </div>

                {/* Right Controls: Upload Standard, Upload Fajr, Preview, Default, Order */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Standard Adhan Upload + Preview */}
                  <label className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all">
                    <Upload size={13} />
                    <span>
                      {isUploadingStd
                        ? 'Uploading...'
                        : hasStandardAudio
                        ? 'Replace Standard MP3'
                        : 'Upload Standard Adhan'}
                    </span>
                    <input
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
                      className="hidden"
                      disabled={Boolean(uploadingKey)}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadAudio(voice, 'standard', f);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {/* Fajr Adhan Upload */}
                  <label className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all">
                    <Sunrise size={13} />
                    <span>
                      {isUploadingFajr
                        ? 'Uploading Fajr...'
                        : hasFajrAudio
                        ? 'Replace Fajr MP3'
                        : 'Upload Fajr Adhan'}
                    </span>
                    <input
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
                      className="hidden"
                      disabled={Boolean(uploadingKey)}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadAudio(voice, 'fajr', f);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {/* Preview Standard */}
                  <button
                    type="button"
                    onClick={() => {
                      if (playback.isPlaying && playback.muezzinNameEn === voice.muezzin_name_en && !playback.isFajrVariant) {
                        stopAdhanPlayback();
                      } else {
                        void playAdhanPreview({ voice, variant: 'standard' });
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Preview Standard Adhan (or Sanctuary Tone if not uploaded yet)"
                  >
                    {playback.isPlaying && playback.muezzinNameEn === voice.muezzin_name_en && !playback.isFajrVariant ? (
                      <>
                        <Square size={12} className="text-red-400 fill-red-400" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} className="text-teal-400 fill-teal-400" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>

                  {/* Preview Fajr (when Fajr audio is uploaded) */}
                  {hasFajrAudio && (
                    <button
                      type="button"
                      onClick={() => void playAdhanPreview({ voice, variant: 'fajr' })}
                      className="px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      title="Preview Fajr Adhan"
                    >
                      <Play size={12} className="fill-amber-300" />
                      <span>Fajr</span>
                    </button>
                  )}

                  {/* Set Default */}
                  {!voice.is_default && (
                    <button
                      type="button"
                      onClick={() => void handleSetDefault(voice)}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                      title="Set as Default Adhan Voice"
                    >
                      <Star size={14} />
                    </button>
                  )}

                  {/* Enable / Disable */}
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(voice)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title={voice.is_active === false ? 'Enable on phones' : 'Hide on phones'}
                  >
                    {voice.is_active === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>

                  {/* Move Up / Down */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => void handleMove(idx, -1)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-300 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === voices.length - 1}
                    onClick={() => void handleMove(idx, 1)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-300 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown size={14} />
                  </button>

                  {/* Delete / Clear */}
                  {(hasStandardAudio || hasFajrAudio || !voice.official_verified) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteOrClear(voice)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                      title={voice.official_verified ? 'Clear uploaded audio' : 'Delete slot'}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
