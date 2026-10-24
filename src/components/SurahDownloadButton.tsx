import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Loader2, X, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import type { Chapter, Reciter } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  downloadSurah,
  cancelDownload,
  deleteDownloadedSurah,
  isSurahDownloaded,
  getSurahDownloadStatus,
  isPremiumActive,
  isMeteredConnection,
} from '../lib/offlineManager';
import { SubscriptionModal } from './SubscriptionModal';

interface SurahDownloadButtonProps {
  chapter: Chapter;
  reciter: Reciter;
  moshafId?: string;
  showText?: boolean;
  className?: string;
}

export function SurahDownloadButton({
  chapter,
  reciter,
  moshafId,
  showText = false,
  className = '',
}: SurahDownloadButtonProps) {
  const { user } = useAuth();
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSubModal, setShowSubModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check download state on mount and on 'quran-downloads-changed' event
  useEffect(() => {
    let cancelled = false;

    async function checkState() {
      const isDl = await isSurahDownloaded(chapter.id, reciter.id, moshafId);
      if (cancelled) return;
      setDownloaded(isDl);

      const activeState = getSurahDownloadStatus(chapter.id, reciter.id, moshafId);
      if (activeState) {
        if (activeState.status === 'downloading' || activeState.status === 'queued') {
          setDownloading(true);
          setProgress(activeState.progressPercent);
          setFailed(false);
        } else if (activeState.status === 'failed') {
          setDownloading(false);
          setFailed(true);
          setErrorMessage(activeState.error || 'Failed');
        } else if (activeState.status === 'downloaded') {
          setDownloading(false);
          setDownloaded(true);
          setFailed(false);
        }
      } else if (!isDl) {
        setDownloading(false);
      }
    }

    void checkState();

    const handleEvent = () => {
      void checkState();
    };

    window.addEventListener('quran-downloads-changed', handleEvent);
    return () => {
      cancelled = true;
      window.removeEventListener('quran-downloads-changed', handleEvent);
    };
  }, [chapter.id, reciter.id, moshafId]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // 1. Paywall Gate: Free users prompt upgrade modal
    if (!isPremiumActive(user)) {
      setShowSubModal(true);
      return;
    }

    // 2. Metered data warning
    if (isMeteredConnection() && chapter.verses_count > 100) {
      const confirmMetered = window.confirm(
        `You are on a metered/cellular data connection. Download ${chapter.name_simple} now?`
      );
      if (!confirmMetered) return;
    }

    try {
      setFailed(false);
      setDownloading(true);
      setProgress(1);

      await downloadSurah(chapter, reciter, user, {
        moshafId,
        onProgress: (pct) => setProgress(pct),
      });

      setDownloading(false);
      setDownloaded(true);
    } catch (err: any) {
      if (err?.message === 'UPGRADE_REQUIRED') {
        setShowSubModal(true);
        setDownloading(false);
        return;
      }
      if (err?.message !== 'Download cancelled.') {
        setFailed(true);
        setErrorMessage(err?.message || 'Download failed');
      }
      setDownloading(false);
    }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await cancelDownload(chapter.id, reciter.id, moshafId);
    setDownloading(false);
    setProgress(0);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDownloadedSurah(chapter.id, reciter.id, moshafId);
    setDownloaded(false);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className={`relative inline-flex items-center gap-1 ${className}`}>
        {/* State 1: DOWNLOADING (progress percent + cancel button) */}
        {downloading ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-mono">
            <Loader2 size={13} className="animate-spin text-teal-400 shrink-0" />
            <span className="font-semibold">{progress}%</span>
            <button
              type="button"
              onClick={handleCancel}
              title="Cancel download"
              className="p-0.5 ml-0.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        ) : downloaded ? (
          /* State 2: DOWNLOADED (Emerald checkmark + delete option) */
          <div className="relative group/dl inline-flex items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(prev => !prev);
              }}
              title="Downloaded for offline listening. Click to manage/delete."
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all cursor-pointer min-h-[36px]"
            >
              <CheckCircle2 size={15} className="text-emerald-400" />
              {showText && <span>Downloaded</span>}
            </button>

            {/* Quick delete popover */}
            {showDeleteConfirm && (
              <div
                className="absolute right-0 bottom-full mb-1 z-30 p-2 bg-[#0A0F1D] border border-slate-700 rounded-xl shadow-2xl flex items-center gap-2 whitespace-nowrap animate-in fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] text-slate-300">Delete download?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        ) : failed ? (
          /* State 3: FAILED (Warning icon + retry) */
          <button
            type="button"
            onClick={handleDownload}
            title={`Download failed (${errorMessage}). Click to retry.`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 text-xs font-medium transition-all cursor-pointer min-h-[36px]"
          >
            <RefreshCw size={13} className="shrink-0" />
            <span>Retry</span>
          </button>
        ) : (
          /* State 4: DEFAULT (Download button) */
          <button
            type="button"
            onClick={handleDownload}
            title="Download for offline listening (Premium)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-teal-300 hover:bg-white/5 transition-all cursor-pointer min-h-[36px]"
          >
            <Download size={16} />
            {showText && <span className="text-xs font-medium">Download</span>}
          </button>
        )}
      </div>

      {/* Subscription Paywall Modal */}
      <SubscriptionModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        onSuccess={() => setShowSubModal(false)}
      />
    </>
  );
}
