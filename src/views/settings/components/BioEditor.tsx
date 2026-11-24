import React from 'react';
import { X, Check } from 'lucide-react';

interface BioEditorProps {
  reciterName: string;
  bioText: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function BioEditor({
  reciterName,
  bioText,
  onChange,
  onSave,
  onCancel,
  isSaving = false,
}: BioEditorProps) {
  return (
    <div className="mt-3 p-3.5 bg-[#050811] border border-teal-500/30 rounded-2xl animate-in fade-in duration-150">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-teal-300">
          Edit Biography for {reciterName}
        </label>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-white p-1 rounded-lg"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
      <textarea
        value={bioText}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter birthplace, mosque/sanctuary where they lead prayers, riwayah, and style facts..."
        rows={3}
        className="w-full bg-[#0D121F] border border-slate-700/80 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed"
      />
      <div className="flex items-center justify-end gap-2 mt-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all disabled:opacity-50"
        >
          <Check size={14} />
          <span>{isSaving ? 'Saving...' : 'Save & Sync'}</span>
        </button>
      </div>
    </div>
  );
}
