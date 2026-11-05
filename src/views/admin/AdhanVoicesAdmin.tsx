import React, { useState, useEffect, useCallback } from 'react';
import {
  Volume2,
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
  FileAudio,
  Activity,
  Edit3,
  Download,
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
import {
  inspectAdhanAudioUrl,
  type AudioUrlInspectionReport,
} from '../../lib/adhanAudioProcessor';
import { PushNotificationsPanel } from '../../components/PushNotificationsPanel';
import { DEFAULT_PRAYER_SETTINGS, type PrayerSettings } from '../../lib/prayer';
import { getSavedLocation } from '../../lib/location';

interface AdhanVoicesAdminProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  askConfirm: (title: string, message: string, onConfirm: () => Promise<void> | void) => void;
}

export function AdhanVoicesAdmin({ showToast, askConfirm }: AdhanVoicesAdminProps) {
  const [voices, setVoices] = useState<AdhanVoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [dragActiveKey, setDragActiveKey] = useState<string | null>(null);
  const [adminPrayerSettings, setAdminPrayerSettings] = useState<PrayerSettings>(DEFAULT_PRAYER_SETTINGS);
  const [playback, setPlayback] = useState(getAdhanPlaybackState);

  // Per-voice URL health inspection state
  const [inspectingKey, setInspectingKey] = useState<string | null>(null);
  const [inspectionReports, setInspectionReports] = useState<Record<string, AudioUrlInspectionReport>>({});

  // Inline license/source/attribution editor state
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [editLicenseStatus, setEditLicenseStatus] = useState<string>('verified_licensed');
  const [editLicenseNotes, setEditLicenseNotes] = useState<string>('');
  const [editSourceUrl, setEditSourceUrl] = useState<string>('');
  const [editAttribution, setEditAttribution] = useState<string>('');

  // Add custom muezzin modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMuezzinEn, setNewMuezzinEn] = useState('');
  const [newMuezzinAr, setNewMuezzinAr] = useState('');
  const [newTitleEn, setNewTitleEn] = useState('Muezzin of the Prophet’s Mosque (Madinah)');
  const [newMosqueEn, setNewMosqueEn] = useState('Al-Masjid an-Nabawi (Prophet’s Mosque, Madinah)');
  const [newLicenseNotes, setNewLicenseNotes] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newAttribution, setNewAttribution] = useState('');
  const [newStdFile, setNewStdFile] = useState<File | null>(null);
  const [newFajrFile, setNewFajrFile] = useState<File | null>(null);
  const [addingVoice, setAddingVoice] = useState(false);

  const loadVoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/adhan-voices?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.voices)) {
          setVoices(data.voices);
        }
      }
    } catch (e) {
      console.error('Failed to load admin adhan voices:', e);
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

  const executeUploadWithDsp = async (
    voice: AdhanVoiceRow,
    variant: 'standard' | 'fajr',
    file: File,
    allowShortClipOverride = false
  ) => {
    const key = `${voice.id}:${variant}`;
    setUploadingKey(key);
    setUploadStatusText('Decoding audio, trimming silence & normalizing loudness...');

    try {
      const uploaded = await uploadAdhanAudioToCloud(file, voice.id, variant, {
        allowShortClipOverride,
      });

      setUploadStatusText('Publishing Web + 30s Native Notification versions to Supabase...');

      const nextPaths = Array.from(
        new Set([...(voice.storage_paths || []), uploaded.storagePath, uploaded.clipStoragePath])
      );

      const updatePayload: Record<string, any> = {
        action: 'update',
        id: voice.id,
        storage_paths: nextPaths,
        size_bytes: uploaded.sizeBytes,
        license_status:
          voice.license_status === 'upload_when_licensed'
            ? 'admin_uploaded'
            : voice.license_status,
      };

      if (variant === 'fajr') {
        updatePayload.fajr_audio_url = uploaded.publicUrl;
        updatePayload.fajr_notification_clip_url = uploaded.notificationClipUrl;
        updatePayload.fajr_duration_seconds = uploaded.durationSeconds;
      } else {
        updatePayload.audio_url = uploaded.publicUrl;
        updatePayload.notification_clip_url = uploaded.notificationClipUrl;
        updatePayload.duration_seconds = uploaded.durationSeconds;
      }

      const res = await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save voice record');
      }

      notifyAdhanVoicesChanged();
      const dsp = uploaded.dspReport;
      showToast(
        `${variant === 'fajr' ? 'Fajr' : 'Standard'} Adhan published (${uploaded.durationSeconds}s, gain ${dsp.gainAppliedDb >= 0 ? '+' : ''}${dsp.gainAppliedDb} dB, peak ${dsp.peakDbAfter} dBFS + ${uploaded.notificationClipDurationSeconds}s native clip)!`,
        'success'
      );
      await loadVoices();
    } catch (e: any) {
      const msg = String(e?.message || 'Upload failed.');
      if (msg.includes('< 60s') && !allowShortClipOverride) {
        askConfirm(
          'Short Audio Warning (< 60 Seconds)',
          `${msg}\n\nAre you sure you want to publish this short recording anyway?`,
          async () => {
            await executeUploadWithDsp(voice, variant, file, true);
          }
        );
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setUploadingKey(null);
      setUploadStatusText('');
    }
  };

  const handleUploadAudio = async (
    voice: AdhanVoiceRow,
    variant: 'standard' | 'fajr',
    file: File
  ) => {
    if (!file) return;
    const isAudio =
      file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name);
    if (!isAudio) {
      showToast('Please select a valid audio file (MP3, M4A, WAV, AAC, or OGG).', 'error');
      return;
    }
    await executeUploadWithDsp(voice, variant, file, false);
  };

  const handleInspectUrl = async (voiceId: string, variant: 'standard' | 'fajr', url?: string | null) => {
    if (!url) {
      showToast('No audio URL is uploaded for this slot yet.', 'error');
      return;
    }
    const key = `${voiceId}:${variant}`;
    setInspectingKey(key);
    try {
      const report = await inspectAdhanAudioUrl(url);
      setInspectionReports((prev) => ({ ...prev, [key]: report }));
    } finally {
      setInspectingKey(null);
    }
  };

  const handleSaveLicenseMeta = async (voice: AdhanVoiceRow) => {
    try {
      const res = await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: voice.id,
          license_status: editLicenseStatus,
          license_notes: editLicenseNotes,
          source_url: editSourceUrl,
          attribution: editAttribution,
        }),
      });
      if (res.ok) {
        notifyAdhanVoicesChanged();
        showToast(`Updated licence & source metadata for ${voice.muezzin_name_en}`, 'success');
        setEditingLicenseId(null);
        await loadVoices();
      }
    } catch {
      showToast('Failed to update licence metadata.', 'error');
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
        showToast(`${voice.muezzin_name_en} set as default Adhan voice.`, 'success');
        await loadVoices();
      }
    } catch {
      showToast('Failed to set default voice.', 'error');
    }
  };

  const handleToggleActive = async (voice: AdhanVoiceRow) => {
    const nextActive = voice.is_active === false;
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
        showToast(
          `${voice.muezzin_name_en} is now ${nextActive ? 'visible on phones' : 'hidden'}.`,
          'success'
        );
        await loadVoices();
      }
    } catch {
      showToast('Failed to update status.', 'error');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= voices.length) return;
    const copy = [...voices];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    const reordered = copy.map((v, idx) => ({ ...v, sort_order: idx + 1 }));
    setVoices(reordered);

    try {
      await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          order: reordered.map((v) => ({ id: v.id, sort_order: v.sort_order })),
        }),
      });
      notifyAdhanVoicesChanged();
    } catch {
      showToast('Failed to save sort order.', 'error');
    }
  };

  const handleDeleteOrClear = (voice: AdhanVoiceRow) => {
    const isOfficial = Boolean(voice.official_verified);
    askConfirm(
      isOfficial ? 'Clear Uploaded Adhan Audio' : 'Delete Muezzin Voice',
      isOfficial
        ? `Clear the uploaded audio files for ${voice.muezzin_name_en} and return this official Prophet's Mosque slot to "Upload When Licensed"?`
        : `Permanently delete ${voice.muezzin_name_en} from the Adhan catalog?`,
      async () => {
        try {
          const res = await fetch('/api/admin/adhan-voices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: voice.id }),
          });
          if (res.ok) {
            notifyAdhanVoicesChanged();
            showToast(
              isOfficial ? 'Cleared uploaded audio.' : 'Deleted Muezzin voice.',
              'success'
            );
            await loadVoices();
          }
        } catch {
          showToast('Failed to delete/clear voice.', 'error');
        }
      }
    );
  };

  const handleCreateCustomVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMuezzinEn.trim()) {
      showToast('Muezzin name (English) is required.', 'error');
      return;
    }

    setAddingVoice(true);
    try {
      const id = `adhan_${newMuezzinEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')}_${Date.now().toString(36)}`;

      let audio_url: string | null = null;
      let fajr_audio_url: string | null = null;
      let notification_clip_url: string | null = null;
      let fajr_notification_clip_url: string | null = null;
      let duration_seconds = 0;
      let fajr_duration_seconds = 0;
      let size_bytes = 0;
      const storage_paths: string[] = [];

      if (newStdFile) {
        const up = await uploadAdhanAudioToCloud(newStdFile, id, 'standard', {
          allowShortClipOverride: true,
        });
        audio_url = up.publicUrl;
        notification_clip_url = up.notificationClipUrl;
        duration_seconds = up.durationSeconds;
        size_bytes += up.sizeBytes;
        storage_paths.push(up.storagePath, up.clipStoragePath);
      }

      if (newFajrFile) {
        const upFajr = await uploadAdhanAudioToCloud(newFajrFile, id, 'fajr', {
          allowShortClipOverride: true,
        });
        fajr_audio_url = upFajr.publicUrl;
        fajr_notification_clip_url = upFajr.notificationClipUrl;
        fajr_duration_seconds = upFajr.durationSeconds;
        size_bytes += upFajr.sizeBytes;
        storage_paths.push(upFajr.storagePath, upFajr.clipStoragePath);
      }

      const res = await fetch('/api/admin/adhan-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          id,
          muezzin_name_en: newMuezzinEn.trim(),
          muezzin_name_ar: newMuezzinAr.trim() || null,
          title_en: newTitleEn.trim() || 'Adhan Recording',
          mosque_en: newMosqueEn.trim() || 'Al-Masjid an-Nabawi',
          audio_url,
          fajr_audio_url,
          notification_clip_url,
          fajr_notification_clip_url,
          duration_seconds,
          fajr_duration_seconds,
          size_bytes,
          storage_paths,
          license_status: audio_url || fajr_audio_url ? 'admin_uploaded' : 'upload_when_licensed',
          license_notes: newLicenseNotes.trim() || null,
          source_url: newSourceUrl.trim() || null,
          attribution: newAttribution.trim() || null,
          official_verified: false,
          is_active: true,
          sort_order: voices.length + 1,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create Muezzin slot');
      }

      notifyAdhanVoicesChanged();
      showToast(`Added ${newMuezzinEn.trim()} to Adhan catalog!`, 'success');
      setShowAddModal(false);
      setNewMuezzinEn('');
      setNewMuezzinAr('');
      setNewLicenseNotes('');
      setNewSourceUrl('');
      setNewAttribution('');
      setNewStdFile(null);
      setNewFajrFile(null);
      await loadVoices();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add Muezzin voice.', 'error');
    } finally {
      setAddingVoice(false);
    }
  };

  const liveUploadedCount = voices.filter((v) => v.audio_url || v.fajr_audio_url).length;

  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#071F17] via-[#0B2D22] to-[#061812] border border-emerald-800/50 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={13} />
              <span>Real-Audio-Only Adhan Engine • One-Step DSP Uploader</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Volume2 className="text-emerald-400" size={22} />
              <span>Prophet&apos;s Mosque (Al-Masjid an-Nabawi) &amp; Global Muezzin Voices</span>
            </h2>
            <p className="text-xs text-emerald-200/80 mt-1.5 max-w-3xl leading-relaxed">
              Drag and drop a Muezzin&apos;s <strong>Full Adhan</strong> and separate{' '}
              <strong>Fajr Adhan</strong> (<em>As-salatu khayrun min an-nawm</em>). Every upload
              automatically validates duration (<strong>&ge; 60s</strong>), trims leading/trailing
              silence, normalizes loudness to <strong>-1.0 dBFS</strong>, adds smooth fade-in/out,
              and generates both the <strong>Web Version</strong> and a{' '}
              <strong>&le;30s Native Notification Clip (WAV)</strong> synced live via Supabase Realtime.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadVoices()}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-700/50 text-emerald-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#04140E] text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Muezzin Voice</span>
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-emerald-800/40">
          <div className="bg-[#04140E]/70 border border-emerald-800/40 rounded-xl p-3.5 flex items-center gap-3">
            <ShieldCheck className="text-emerald-400 shrink-0" size={20} />
            <div>
              <div className="text-[11px] text-emerald-300/70 uppercase font-bold tracking-wider">
                Verified Official Roster
              </div>
              <div className="text-sm font-bold text-white">
                {voices.length} Muezzin Slots (10 Masjid an-Nabawi + Alafasy)
              </div>
            </div>
          </div>

          <div className="bg-[#04140E]/70 border border-emerald-800/40 rounded-xl p-3.5 flex items-center gap-3">
            <CheckCircle2
              className={liveUploadedCount > 0 ? 'text-emerald-400 shrink-0' : 'text-amber-400 shrink-0'}
              size={20}
            />
            <div>
              <div className="text-[11px] text-emerald-300/70 uppercase font-bold tracking-wider">
                Real Audio Files Uploaded
              </div>
              <div className="text-sm font-bold text-white">
                {liveUploadedCount} of {voices.length} Slots Have Real Audio
              </div>
            </div>
          </div>

          <div className="bg-[#04140E]/70 border border-emerald-800/40 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-emerald-300/70 uppercase font-bold tracking-wider">
                Zero Fallback Horn Guarantee
              </div>
              <div className="text-xs font-semibold text-emerald-200 mt-0.5">
                {playback.isPlaying
                  ? `Playing: ${playback.muezzinNameEn}`
                  : 'All synthetic tones removed — plays real audio only'}
              </div>
            </div>
            {playback.isPlaying && (
              <button
                type="button"
                onClick={() => stopAdhanPlayback()}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Square size={12} className="fill-red-300" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>

        {/* Active DSP Upload Progress Banner */}
        {uploadingKey && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-3 text-xs text-emerald-200 font-semibold">
            <RefreshCw size={15} className="animate-spin text-emerald-400 shrink-0" />
            <span>{uploadStatusText || 'Processing and uploading Adhan audio...'}</span>
          </div>
        )}

        {/* Visible Playback Error Banner in Admin */}
        {playback.errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 flex items-center justify-between gap-3 text-xs text-red-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={15} className="text-red-400 shrink-0" />
              <span>{playback.errorMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Add Custom Muezzin Modal */}
      {showAddModal && (
        <div className="bg-[#111722] border border-teal-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus size={18} className="text-teal-400" />
              <span>Add Licensed Muezzin Voice</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateCustomVoice} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Muezzin Name (English) *
              </label>
              <input
                type="text"
                required
                value={newMuezzinEn}
                onChange={(e) => setNewMuezzinEn(e.target.value)}
                placeholder="e.g. Sheikh Abdul-Majid Al-Surayhi"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Muezzin Name (Arabic)
              </label>
              <input
                type="text"
                dir="rtl"
                value={newMuezzinAr}
                onChange={(e) => setNewMuezzinAr(e.target.value)}
                placeholder="الشيخ عبد المجيد السريحي"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Title / Role
              </label>
              <input
                type="text"
                value={newTitleEn}
                onChange={(e) => setNewTitleEn(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mosque
              </label>
              <input
                type="text"
                value={newMosqueEn}
                onChange={(e) => setNewMosqueEn(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Standard Adhan Audio (MP3 / M4A / WAV, &ge; 60s)
              </label>
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
                onChange={(e) => setNewStdFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-500/20 file:text-teal-300 file:font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fajr Adhan Audio (Separate Dawn Recording, &ge; 60s)
              </label>
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
                onChange={(e) => setNewFajrFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-amber-500/20 file:text-amber-300 file:font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Licence &amp; Attribution Notes
              </label>
              <input
                type="text"
                value={newLicenseNotes}
                onChange={(e) => setNewLicenseNotes(e.target.value)}
                placeholder="e.g. CC0 Public Domain / Direct studio permission"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Source URL
              </label>
              <input
                type="url"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-700 text-sm text-white"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingVoice}
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold cursor-pointer"
              >
                {addingVoice ? 'Processing & Saving...' : 'Save Muezzin Voice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Muezzin Cards List with Drag-and-Drop One-Step Uploaders */}
      <div className="grid gap-4">
        {voices.map((voice, idx) => {
          const hasStandardAudio = Boolean(voice.audio_url);
          const hasFajrAudio = Boolean(voice.fajr_audio_url);
          const isUploadingStd = uploadingKey === `${voice.id}:standard`;
          const isUploadingFajr = uploadingKey === `${voice.id}:fajr`;
          const stdReport = inspectionReports[`${voice.id}:standard`];
          const fajrReport = inspectionReports[`${voice.id}:fajr`];
          const isEditingLicense = editingLicenseId === voice.id;

          return (
            <div
              key={voice.id}
              className={`rounded-2xl border p-5 transition-all space-y-4 ${
                voice.is_active === false
                  ? 'bg-[#0D121E]/40 border-slate-800/50 opacity-60'
                  : hasStandardAudio || hasFajrAudio
                  ? 'bg-[#111927]/90 border-emerald-500/35 shadow-lg shadow-emerald-950/20'
                  : 'bg-[#131722]/75 border-slate-800'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
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
                        <CheckCircle2 size={10} /> Real Audio Live ({voice.duration_seconds || 0}s)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300/90 border border-amber-500/25 flex items-center gap-1">
                        <AlertCircle size={10} /> Upload When Licensed (No Audio File Yet)
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 font-medium">
                    {voice.title_en} • <span className="text-slate-400">{voice.mosque_en}</span>
                  </p>

                  {voice.license_notes && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong>Licence:</strong> {voice.license_notes}
                      {voice.source_url ? ` • Source: ${voice.source_url}` : ''}
                    </p>
                  )}
                </div>

                {/* Top Right Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingLicense) {
                        setEditingLicenseId(null);
                      } else {
                        setEditingLicenseId(voice.id);
                        setEditLicenseStatus(voice.license_status || 'verified_licensed');
                        setEditLicenseNotes(voice.license_notes || '');
                        setEditSourceUrl(voice.source_url || '');
                        setEditAttribution(voice.attribution || '');
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Edit Licence & Source Metadata"
                  >
                    <Edit3 size={12} />
                    <span>Licence / Source</span>
                  </button>

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

                  <button
                    type="button"
                    onClick={() => void handleToggleActive(voice)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title={voice.is_active === false ? 'Enable on phones' : 'Hide on phones'}
                  >
                    {voice.is_active === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>

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

              {/* Inline Licence & Source Metadata Editor */}
              {isEditingLicense && (
                <div className="bg-[#0B0F17] border border-slate-700/80 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Licence Status
                    </label>
                    <select
                      value={editLicenseStatus}
                      onChange={(e) => setEditLicenseStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      <option value="verified_licensed">Verified Licensed</option>
                      <option value="admin_uploaded">Admin Uploaded</option>
                      <option value="upload_when_licensed">Upload When Licensed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Licence Notes
                    </label>
                    <input
                      type="text"
                      value={editLicenseNotes}
                      onChange={(e) => setEditLicenseNotes(e.target.value)}
                      placeholder="e.g. Official Haramain permission"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Source URL
                    </label>
                    <input
                      type="text"
                      value={editSourceUrl}
                      onChange={(e) => setEditSourceUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Attribution
                      </label>
                      <input
                        type="text"
                        value={editAttribution}
                        onChange={(e) => setEditAttribution(e.target.value)}
                        placeholder="Mosque / Studio"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveLicenseMeta(voice)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Two Drag-and-Drop Zones: (1) Full Standard Adhan & (2) Separate Fajr Adhan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {/* 1. Standard Full Adhan Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActiveKey(`${voice.id}:standard`);
                  }}
                  onDragLeave={() => setDragActiveKey(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActiveKey(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleUploadAudio(voice, 'standard', file);
                  }}
                  className={`rounded-xl border border-dashed p-3.5 transition-all ${
                    dragActiveKey === `${voice.id}:standard`
                      ? 'border-emerald-400 bg-emerald-500/15'
                      : hasStandardAudio
                      ? 'border-emerald-500/40 bg-[#0B1410]/80'
                      : 'border-slate-700 bg-[#0B0F17]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileAudio
                        size={16}
                        className={hasStandardAudio ? 'text-emerald-400 shrink-0' : 'text-slate-500 shrink-0'}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">
                          Full Standard Adhan (Dhuhr, Asr, Maghrib, Isha)
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {hasStandardAudio
                            ? `Live (${voice.duration_seconds || 0}s) • Drag & drop to replace`
                            : 'No audio uploaded • Drag & drop MP3/WAV/M4A (>= 60s)'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <Upload size={12} />
                        <span>{isUploadingStd ? 'Processing...' : hasStandardAudio ? 'Replace' : 'Upload'}</span>
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

                      {hasStandardAudio && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                playback.isPlaying &&
                                playback.voiceId === voice.id &&
                                !playback.isFajrVariant
                              ) {
                                stopAdhanPlayback();
                              } else {
                                void playAdhanPreview({ voice, variant: 'standard' });
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {playback.isPlaying &&
                            playback.voiceId === voice.id &&
                            !playback.isFajrVariant ? (
                              <>
                                <Square size={11} className="text-red-400 fill-red-400" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play size={11} className="text-emerald-400 fill-emerald-400" />
                                <span>Play</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleInspectUrl(voice.id, 'standard', voice.audio_url)}
                            disabled={inspectingKey === `${voice.id}:standard`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Verify HTTP 200/206, Content-Type, Range support, duration & loudness"
                          >
                            <Activity size={11} />
                            <span>{inspectingKey === `${voice.id}:standard` ? '...' : 'Verify'}</span>
                          </button>
                        </>
                      )}

                      {voice.notification_clip_url && (
                        <a
                          href={voice.notification_clip_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-[11px] font-semibold flex items-center gap-1"
                          title="Download <=30s Native Notification Clip (WAV for iOS/Android)"
                        >
                          <Download size={11} />
                          <span>30s Clip</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {stdReport && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-black/50 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-0.5">
                      <div className={stdReport.verdict === 'valid_adhan' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {stdReport.verdictSummary}
                      </div>
                      <div>
                        HTTP {stdReport.httpStatus} • Type: {stdReport.contentType} • Size:{' '}
                        {stdReport.contentLengthBytes ? `${Math.round(stdReport.contentLengthBytes / 1024)} KB` : 'N/A'} •
                        Range: {stdReport.rangeSupported ? 'Yes' : 'No'} • Peak: {stdReport.peakDbFs} dBFS • RMS:{' '}
                        {stdReport.rmsDbFs} dBFS
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Separate Fajr Adhan Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActiveKey(`${voice.id}:fajr`);
                  }}
                  onDragLeave={() => setDragActiveKey(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActiveKey(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleUploadAudio(voice, 'fajr', file);
                  }}
                  className={`rounded-xl border border-dashed p-3.5 transition-all ${
                    dragActiveKey === `${voice.id}:fajr`
                      ? 'border-amber-400 bg-amber-500/15'
                      : hasFajrAudio
                      ? 'border-amber-500/40 bg-[#171208]/80'
                      : 'border-slate-700 bg-[#0B0F17]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sunrise
                        size={16}
                        className={hasFajrAudio ? 'text-amber-400 shrink-0' : 'text-slate-500 shrink-0'}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">
                          Separate Fajr Adhan (الصلاة خير من النوم)
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {hasFajrAudio
                            ? `Live (${voice.fajr_duration_seconds || 0}s) • Drag & drop to replace`
                            : 'No Fajr recording yet • Drag & drop MP3/WAV/M4A (>= 60s)'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <Upload size={12} />
                        <span>{isUploadingFajr ? 'Processing...' : hasFajrAudio ? 'Replace' : 'Upload Fajr'}</span>
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

                      {hasFajrAudio && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                playback.isPlaying &&
                                playback.voiceId === voice.id &&
                                playback.isFajrVariant
                              ) {
                                stopAdhanPlayback();
                              } else {
                                void playAdhanPreview({ voice, variant: 'fajr' });
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {playback.isPlaying &&
                            playback.voiceId === voice.id &&
                            playback.isFajrVariant ? (
                              <>
                                <Square size={11} className="text-red-400 fill-red-400" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play size={11} className="fill-amber-300" />
                                <span>Play Fajr</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleInspectUrl(voice.id, 'fajr', voice.fajr_audio_url)}
                            disabled={inspectingKey === `${voice.id}:fajr`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Verify HTTP 200/206, Content-Type, Range support, duration & loudness"
                          >
                            <Activity size={11} />
                            <span>{inspectingKey === `${voice.id}:fajr` ? '...' : 'Verify'}</span>
                          </button>
                        </>
                      )}

                      {voice.fajr_notification_clip_url && (
                        <a
                          href={voice.fajr_notification_clip_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1"
                          title="Download <=30s Fajr Native Notification Clip (WAV)"
                        >
                          <Download size={11} />
                          <span>30s Clip</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {fajrReport && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-black/50 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-0.5">
                      <div className={fajrReport.verdict === 'valid_adhan' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {fajrReport.verdictSummary}
                      </div>
                      <div>
                        HTTP {fajrReport.httpStatus} • Type: {fajrReport.contentType} • Size:{' '}
                        {fajrReport.contentLengthBytes ? `${Math.round(fajrReport.contentLengthBytes / 1024)} KB` : 'N/A'} •
                        Range: {fajrReport.rangeSupported ? 'Yes' : 'No'} • Peak: {fajrReport.peakDbFs} dBFS • RMS:{' '}
                        {fajrReport.rmsDbFs} dBFS
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase 3 & Step 2.7 Admin Diagnostics & Closed-App Push Verification */}
      <div className="pt-4">
        <PushNotificationsPanel
          location={getSavedLocation()}
          settings={adminPrayerSettings}
          onUpdateSettings={(patch) => setAdminPrayerSettings((prev) => ({ ...prev, ...patch }))}
          isAdminView={true}
        />
      </div>
    </section>
  );
}
