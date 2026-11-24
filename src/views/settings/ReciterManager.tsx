import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Camera,
  FileAudio,
  Trash2,
  Users,
  ShieldCheck,
  Check,
  Pencil,
} from 'lucide-react';
import { ReciterAvatar } from '../../components/ReciterAvatar';
import { BioEditor } from './components/BioEditor';
import { StoredRecitation } from '../../lib/recitations';
import type { Reciter } from '../../types';

export const SECTION_OPTIONS = [
  'Sweet Voices',
  "Madinah (Prophet's Mosque)",
  'Makkah (Masjid al-Haram)',
  'Classic Masters',
  'African Masters',
  'Community & Custom',
];

interface ReciterManagerProps {
  allReciters: Reciter[];
  customReciters: Reciter[];
  recitations: StoredRecitation[];
  onManageSurahs: (reciterId: string) => void;
  onPhotoUpload: (reciterId: string, file: File) => Promise<void>;
  onSaveBio: (reciterId: string, bioText: string) => Promise<void>;
  onDeleteCustomReciter: (reciter: Reciter) => void;
  onOpenAddModal: () => void;
}

export function ReciterManager({
  allReciters,
  customReciters,
  recitations,
  onManageSurahs,
  onPhotoUpload,
  onSaveBio,
  onDeleteCustomReciter,
  onOpenAddModal,
}: ReciterManagerProps) {
  const [reciterSearch, setReciterSearch] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('All');

  // Bio Editing state
  const [editingBioReciterId, setEditingBioReciterId] = useState<string | null>(null);
  const [bioInputText, setBioInputText] = useState('');
  const [isSavingBio, setIsSavingBio] = useState(false);

  // Filtered Reciters
  const filteredReciters = useMemo(() => {
    const q = reciterSearch.trim().toLowerCase();
    return allReciters.filter(r => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.nameArabic || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        (r.bio || '').toLowerCase().includes(q);

      const matchesCategory =
        selectedSectionFilter === 'All' ||
        (selectedSectionFilter === 'Custom' && (!r.category || r.category === 'Custom' || r.category === 'Community & Custom')) ||
        (r.category && r.category.toLowerCase().includes(selectedSectionFilter.toLowerCase()));

      return matchesSearch && matchesCategory;
    });
  }, [allReciters, reciterSearch, selectedSectionFilter]);

  const handleStartEditBio = (reciter: Reciter) => {
    if (editingBioReciterId === reciter.id) {
      setEditingBioReciterId(null);
    } else {
      setEditingBioReciterId(reciter.id);
      setBioInputText(reciter.bio || '');
    }
  };

  const handleSaveCurrentBio = async (reciterId: string) => {
    setIsSavingBio(true);
    try {
      await onSaveBio(reciterId, bioInputText);
      setEditingBioReciterId(null);
    } finally {
      setIsSavingBio(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-serif font-bold text-white tracking-wide">
              Sheikhs, Reciters &amp; Audio Library
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold">
              {allReciters.length} Sheikhs
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Browse verified masters, upload photos from your phone, edit biographies, and manage 114 Surah recordings.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all shrink-0 cursor-pointer"
        >
          <Plus size={18} />
          <span>Add New Sheikh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search sheikhs by name, city, style, or Arabic..."
            value={reciterSearch}
            onChange={e => setReciterSearch(e.target.value)}
            className="w-full bg-[#050811] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['All', ...SECTION_OPTIONS].map(sec => (
            <button
              key={sec}
              type="button"
              onClick={() => setSelectedSectionFilter(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                selectedSectionFilter === sec
                  ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold shadow-md'
                  : 'bg-[#050811] text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Reciters Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReciters.map(reciter => {
          const isCustom = customReciters.some(c => c.id === reciter.id);
          const uploadedCount = recitations.filter(r => r.reciterId === reciter.id).length;
          const isEditingBio = editingBioReciterId === reciter.id;

          return (
            <div
              key={reciter.id}
              className="bg-[#050811]/90 border border-slate-800/80 hover:border-teal-500/40 rounded-2xl p-4 sm:p-5 transition-all shadow-md group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-teal-500/30 shadow-md">
                      <ReciterAvatar reciter={reciter} shape="rounded" className="w-full h-full rounded-none" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif font-bold text-white text-base truncate group-hover:text-teal-300 transition-colors">
                          {reciter.name}
                        </h3>
                        {reciter.isPartial && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Partial ({reciter.surahCount || 7}/114)
                          </span>
                        )}
                      </div>
                      {reciter.nameArabic && (
                        <p className="text-xs font-amiri text-teal-400/90 mt-0.5" dir="rtl">
                          {reciter.nameArabic}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                        <span>{reciter.category || 'General'}</span>
                        <span>•</span>
                        <span>{reciter.style || 'Murattal'}</span>
                        {uploadedCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-teal-400 font-semibold">{uploadedCount} custom audio</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => onDeleteCustomReciter(reciter)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete custom sheikh"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Bio text or Bio Editor */}
                {isEditingBio ? (
                  <BioEditor
                    reciterName={reciter.name}
                    bioText={bioInputText}
                    onChange={setBioInputText}
                    onSave={() => handleSaveCurrentBio(reciter.id)}
                    onCancel={() => setEditingBioReciterId(null)}
                    isSaving={isSavingBio}
                  />
                ) : (
                  <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                    {reciter.bio || <span className="text-slate-600 italic">No biography added yet. Click &ldquo;Bio&rdquo; to add one.</span>}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all">
                    <Camera size={14} className="text-teal-400" />
                    <span>Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) onPhotoUpload(reciter.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleStartEditBio(reciter)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Pencil size={12} className="text-teal-400" />
                    <span>Bio</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onManageSurahs(reciter.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <FileAudio size={14} />
                  <span>Upload Surahs (114)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
