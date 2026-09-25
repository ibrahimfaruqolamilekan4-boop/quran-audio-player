import React, { useState, useEffect, useRef } from 'react';
import { Music, Play, Trash2, Upload, RefreshCw, ListMusic, Search } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { getChapters } from '../../lib/api';
import {
  uploadRecitation,
  replaceRecitation,
  deleteRecitation,
  formatDuration,
  formatBytes,
  type StoredRecitation,
} from '../../lib/recitations';

type Toast = (message: string, type?: 'success' | 'error') => void;
type AskConfirm = (title: string, message: string, onConfirm: () => Promise<void> | void) => void;

interface Props {
  showToast: Toast;
  askConfirm: AskConfirm;
}

/**
 * Recitation audio management (prompt §3.2): browse from the device, assign a
 * reciter and surah (the surah number follows the chosen name), track upload
 * progress, then view / filter / replace / delete every uploaded recitation.
 */
export function RecitationsAdmin({ showToast, askConfirm }: Props) {
  const { allReciters, chapters, setChapters, recitations, setRecitations, playChapter } = usePlayer();

  const [reciterId, setReciterId] = useState('');
  const [surahQuery, setSurahQuery] = useState('');
  const [surahId, setSurahId] = useState<number | ''>('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [reciterFilter, setReciterFilter] = useState('');
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  // The admin route renders outside the dashboard layout, so the chapter list
  // may not be loaded yet — fetch it here when it is empty.
  useEffect(() => {
    if (chapters.length === 0) {
      getChapters()
        .then((data) => { if (Array.isArray(data) && data.length) setChapters(data); })
        .catch(() => { /* offline — the surah list stays empty and uploads still work by id */ });
    }
  }, [chapters.length, setChapters]);

  useEffect(() => {
    if (!reciterId && allReciters.length) setReciterId(allReciters[0].id);
  }, [reciterId, allReciters]);

  const filteredChapters = surahQuery.trim()
    ? chapters.filter(
        (c) =>
          c.name_simple.toLowerCase().includes(surahQuery.trim().toLowerCase()) ||
          String(c.id) === surahQuery.trim()
      )
    : chapters;

  const visible = reciterFilter
    ? recitations.filter((r) => r.reciterId === reciterFilter)
    : recitations;

  const handleUpload = async () => {
    setAudioError('');
    if (!audioFile) {
      setAudioError('Choose an audio file from your device first.');
      return;
    }
    if (!reciterId) {
      setAudioError('Choose the reciter this audio belongs to.');
      return;
    }
    if (!surahId) {
      setAudioError('Choose the surah — the surah number fills in automatically.');
      return;
    }
    const reciter = allReciters.find((r) => r.id === reciterId);
    const chapter = chapters.find((c) => c.id === surahId);
    if (!reciter || !chapter) {
      setAudioError('That reciter or surah is no longer available — reselect and try again.');
      return;
    }
    setAudioUploading(true);
    setAudioProgress(0);
    try {
      const entry = await uploadRecitation(
        audioFile,
        { reciterId: reciter.id, reciterName: reciter.name, surah: chapter.id, surahName: chapter.name_simple },
        setAudioProgress
      );
      setRecitations([entry, ...recitations]);
      showToast(`Uploaded “${entry.fileName}” — ${entry.reciterName}, ${entry.surahName}.`, 'success');
      setAudioFile(null);
      setSurahId('');
      setSurahQuery('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      const message = err?.message || 'Upload failed.';
      setAudioError(message);
      showToast(message, 'error');
    } finally {
      setAudioUploading(false);
    }
  };

  const handleReplace = async (id: string, file: File) => {
    try {
      const updated = await replaceRecitation(id, file, setAudioProgress);
      if (updated) {
        setRecitations(recitations.map((r) => (r.id === id ? updated : r)));
        showToast(`Replaced the audio for ${updated.surahName}.`, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Replace failed.', 'error');
    } finally {
      setReplacingId(null);
    }
  };

  const handleDelete = (entry: StoredRecitation) => {
    askConfirm(
      'Delete Recitation',
      `Delete “${entry.surahName}” by ${entry.reciterName}? The file is removed from this device.`,
      async () => {
        try {
          await deleteRecitation(entry.id);
          setRecitations(recitations.filter((r) => r.id !== entry.id));
          showToast('Recitation deleted.', 'success');
        } catch {
          showToast('Failed to delete recitation.', 'error');
        }
      }
    );
  };

  const handlePlay = (entry: StoredRecitation) => {
    const reciter = allReciters.find((r) => r.id === entry.reciterId);
    if (!reciter) return;
    playChapter(
      {
        id: entry.surah,
        name_simple: entry.surahName,
        name_arabic: '',
        translated_name: { name: '' },
        verses_count: 0,
      },
      reciter
    );
  };

  return (
    <section className="bg-[#0A0F1C]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-xl animate-in fade-in duration-200">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Music className="text-teal-400" size={20} />
          Recitation Audio
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Upload recitations straight from your phone or computer, assign them to a reciter and surah, and
          they stream first in the player — before any public mirror. Files are kept on this device.
        </p>
      </div>

      {/* Upload form */}
      <div className="bg-[#131722]/70 p-5 rounded-2xl border border-slate-800 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Reciter</label>
            <select
              value={reciterId}
              onChange={(e) => setReciterId(e.target.value)}
              className="mt-1 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500"
            >
              {allReciters.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Surah</label>
            <div className="relative mt-1">
              <Search size={13} className="absolute left-3 top-3 text-slate-500" />
              <input
                value={surahQuery}
                onChange={(e) => setSurahQuery(e.target.value)}
                placeholder="Search surah name or number..."
                className="w-full bg-[#0A0F1C] border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-white text-xs outline-none focus:border-teal-500"
              />
            </div>
            <select
              value={surahId}
              onChange={(e) => setSurahId(e.target.value ? Number(e.target.value) : '')}
              className="mt-2 w-full bg-[#0A0F1C] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-500"
            >
              <option value="">Select surah...</option>
              {filteredChapters.slice(0, 60).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}. {c.name_simple}
                </option>
              ))}
            </select>
            {surahId !== '' && (
              <p className="text-[10px] text-teal-400 mt-1">Surah number: {surahId}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0F1C] border border-slate-700 text-slate-300 text-xs font-semibold hover:border-teal-500/50 transition-colors"
          >
            <Upload size={14} className="text-teal-400" />
            {audioFile ? audioFile.name : 'Browse audio file (MP3, M4A, WAV)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg,audio/aac,audio/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; setAudioFile(f ?? null); setAudioError(''); }}
          />
          <button
            onClick={handleUpload}
            disabled={audioUploading || !audioFile}
            className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 text-xs font-bold flex items-center gap-2"
          >
            <Upload size={14} /> {audioUploading ? `Uploading ${audioProgress}%` : 'Upload recitation'}
          </button>
        </div>

        {audioUploading && (
          <div className="mt-3 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-200" style={{ width: `${audioProgress}%` }} />
          </div>
        )}

        {audioError && <p className="mt-2 text-xs text-red-400">{audioError}</p>}
      </div>

      {/* List */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ListMusic size={15} className="text-teal-400" />
          Uploaded Recitations ({visible.length})
        </h3>
        <select
          value={reciterFilter}
          onChange={(e) => setReciterFilter(e.target.value)}
          className="bg-[#131722] border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs outline-none focus:border-teal-500"
        >
          <option value="">All reciters</option>
          {allReciters.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
          No recitations uploaded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">Reciter</th>
                <th className="pb-3 px-3">Surah</th>
                <th className="pb-3 px-3">Duration</th>
                <th className="pb-3 px-3">Size</th>
                <th className="pb-3 px-3">Uploaded</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-800/60">
              {visible.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 text-white font-medium">{entry.reciterName}</td>
                  <td className="py-3 px-3 text-slate-300">
                    {entry.surah}. {entry.surahName}
                    <span className="block text-[10px] text-slate-500 truncate max-w-[180px]">{entry.fileName}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 font-mono">{formatDuration(entry.durationSec)}</td>
                  <td className="py-3 px-3 text-slate-400 font-mono">{formatBytes(entry.sizeBytes)}</td>
                  <td className="py-3 px-3 text-slate-500">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePlay(entry)}
                        className="p-1.5 rounded-lg text-teal-400 hover:bg-teal-500/10 transition-colors"
                        title="Play in full-screen player"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => { setReplacingId(entry.id); replaceRef.current?.click(); }}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                        title="Replace audio file"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete recitation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* One hidden picker serves every row's Replace action. */}
      <input
        ref={replaceRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg,audio/aac,audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replacingId) handleReplace(replacingId, file);
          if (replaceRef.current) replaceRef.current.value = '';
        }}
      />

      <p className="mt-4 text-[10px] text-slate-500 flex items-center gap-1.5">
        <RefreshCw size={11} /> A recitation for a sheikh + surah always plays before the streaming mirrors.
      </p>
    </section>
  );
}
