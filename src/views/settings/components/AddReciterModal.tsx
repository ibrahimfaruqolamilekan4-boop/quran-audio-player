import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Upload, AlertCircle } from 'lucide-react';
import { resizeImageToDataUrl } from '../../../lib/upload';

interface AddReciterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    nameArabic: string;
    section: string;
    bio: string;
    photoData: string | null;
  }) => Promise<void>;
  isSubmitting: boolean;
  error: string;
  sectionOptions: string[];
}

export function AddReciterModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  sectionOptions,
}: AddReciterModalProps) {
  const [name, setName] = useState('');
  const [nameArabic, setNameArabic] = useState('');
  const [section, setSection] = useState(sectionOptions[0] || 'Community & Custom');
  const [bio, setBio] = useState('');
  const [photoData, setPhotoData] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      nameArabic,
      section,
      bio,
      photoData,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-[#0D121F] border border-slate-800 rounded-3xl p-6 lg:p-7 shadow-2xl relative"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h3 className="text-xl font-serif font-bold text-white">Add New Sheikh / Reciter</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-5">
            {/* Photo from Phone */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#050811] border border-slate-800">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-700 shrink-0">
                {photoData ? (
                  <img src={photoData} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={24} className="text-slate-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Profile Photo</p>
                <p className="text-xs text-slate-400 mt-0.5">Upload a picture directly from your phone</p>
                <label className="cursor-pointer inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors">
                  <Upload size={14} />
                  Choose Photo from Phone
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const dataUrl = await resizeImageToDataUrl(file);
                        if (dataUrl) setPhotoData(dataUrl);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Reciter Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Sheikh / Reciter Name <span className="text-teal-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Sheikh Bilal Al Dirbali"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            {/* Arabic Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Arabic Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. الشيخ بلال الدربالي"
                dir="rtl"
                value={nameArabic}
                onChange={e => setNameArabic(e.target.value)}
                className="w-full bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-amiri"
              />
            </div>

            {/* Section / Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">App Section</label>
              <select
                value={section}
                onChange={e => setSection(e.target.value)}
                className="w-full bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
              >
                {sectionOptions.map(opt => (
                  <option key={opt} value={opt} className="bg-slate-900 text-white">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Biography */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Biography / Information (Optional)
              </label>
              <textarea
                placeholder="Country of birth, where they lead prayer, recitation style..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                className="w-full bg-[#050811] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : 'Create & Upload Surahs'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
