import React from 'react';
import { X, ShieldCheck, ExternalLink, Film } from 'lucide-react';
import type { CustomVideo } from '../types';
import { SOURCE_LICENSE_AUDITS } from '../lib/ambientCandidates';

interface MediaCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: CustomVideo[];
}

export function MediaCreditsModal({ isOpen, onClose, videos }: MediaCreditsModalProps) {
  if (!isOpen) return null;

  const creditedVideos = videos.filter(
    (v) =>
      v.attributionRequired ||
      v.creator ||
      v.licenseName ||
      v.attribution ||
      v.sourceUrl
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-emerald-500/25 bg-[#071712] text-white shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Media Credits & Licences
              </h2>
              <p className="text-xs text-white/60">
                Attribution and commercial licence verification for ambient backgrounds
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
            aria-label="Close credits"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
            Active Background Video Attributions ({creditedVideos.length})
          </h3>

          {creditedVideos.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/60">
              All currently active backgrounds use royalty-free / first-party commercial licences that do not require mandatory attribution, or have no external attribution attached yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {creditedVideos.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Film className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-sm font-medium text-white">{v.name}</span>
                      {v.category && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                          {v.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/70">
                      {v.creator ? `Creator: ${v.creator}` : v.attribution || 'Verified Ambient Source'}
                      {v.licenseName ? ` • Licence: ${v.licenseName}` : ''}
                      {v.dateChecked ? ` • Checked: ${v.dateChecked}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.sourceUrl && (
                      <a
                        href={v.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-300 transition"
                      >
                        Source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {v.licenseUrl && (
                      <a
                        href={v.licenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
                      >
                        Licence <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80 mb-2.5">
              Verified Source Licence Standards
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {SOURCE_LICENSE_AUDITS.map((audit) => (
                <div
                  key={audit.source}
                  className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{audit.source}</span>
                    <a
                      href={audit.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                    >
                      {audit.licenseName} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-white/60">{audit.flagsAndCaveats}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
