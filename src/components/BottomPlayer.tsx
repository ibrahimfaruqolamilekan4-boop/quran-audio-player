import React, { useState } from 'react';
import { Pause, Play, Repeat, SkipBack, SkipForward, SlidersHorizontal, Volume1, Volume2, VolumeX } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { AMBIENT_TRACKS, CURATED_RECITERS } from '../lib/constants';
import { cx, Equalizer, Khatam, ReciterAvatar } from './ui';

function formatTime(seconds: number) {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BottomPlayer() {
  const {
    currentChapter, currentReciter, currentAmbient, isPlaying, isLoading,
    currentTime, duration, togglePlayPause, playNextChapter, playPreviousChapter, seekTo,
    quranVolume, ambientVolume, setQuranVolume, setAmbientVolume, setAmbientTrack, customReciters,
    playbackRate, setPlaybackRate,
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);
  if (!currentChapter) return null;

  const reciter = CURATED_RECITERS.concat(customReciters).find((r) => r.id === currentReciter?.id) ?? currentReciter;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const rates = [0.75, 1, 1.25, 1.5];

  return (
    <div
      className={cx(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-ink-950/85 backdrop-blur-3xl transition-[height] duration-500 ease-[cubic-bezier(.32,.72,0,1)] md:left-[276px]',
        expanded ? 'h-[27rem]' : 'h-[92px]',
      )}
      style={{ boxShadow: '0 -30px 60px -40px rgba(0,0,0,.95)' }}
    >
      {/* hairline glow along the top edge */}
      <span className="pointer-events-none absolute inset-x-[12%] -top-px h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent" />

      {/* Scrubber (mini) */}
      <div className={cx('group absolute -top-1 left-0 right-0 z-10 px-6 transition-opacity md:px-8', expanded ? 'pointer-events-none opacity-0' : 'opacity-100')}>
        <div className="absolute -top-6 left-6 right-6 flex justify-between font-mono text-[10px] tracking-widest text-mist-dim opacity-0 transition-opacity group-hover:opacity-100">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range" min="0" max={duration || 100} value={currentTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          aria-label="Seek"
          className="h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{ background: `linear-gradient(90deg, var(--accent) ${pct}%, rgba(255,255,255,.08) ${pct}%)` }}
        />
      </div>

      {/* ---------- Mini bar ---------- */}
      <div className={cx('flex h-[92px] items-center justify-between gap-4 px-6 md:px-8', expanded && 'max-md:hidden')}>
        <button
          onClick={() => setExpanded(true)}
          className="group flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <span className="relative shrink-0">
            <span className="grid h-14 w-14 place-items-center rounded-[18px] border border-gold/20 bg-ink-900" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' }}>
              {isPlaying ? <Equalizer playing className="h-5" /> : <Khatam size={20} className="text-gold/70" />}
            </span>
            {reciter && (
              <span className="absolute -bottom-1.5 -right-1.5">
                <ReciterAvatar reciter={reciter} size="xs" ring className="!h-7 !w-7 !rounded-full" imgClassName="object-[50%_20%]" />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="display block truncate text-[17px] leading-tight text-white group-hover:text-gold-100">
              {currentChapter.name_simple}
              <span className="arabic ml-3 text-[15px] text-gold/70">{currentChapter.name_arabic}</span>
            </span>
            <span className="mt-1 flex items-center gap-2 truncate text-[12px] font-light text-mist-dim">
              {reciter?.name}
              {currentAmbient && (
                <>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="inline-flex items-center gap-1.5"><currentAmbient.icon size={12} strokeWidth={1.6} /> {currentAmbient.name}</span>
                </>
              )}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <button onClick={playPreviousChapter} aria-label="Previous surah" className="hidden p-2 text-mist-dim transition-colors hover:text-white sm:block">
            <SkipBack size={19} className="fill-current" />
          </button>
          <button
            onClick={togglePlayPause}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="btn-gold sheen !h-12 !w-12 !p-0 disabled:opacity-60"
          >
            {isLoading
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
              : isPlaying ? <Pause size={19} className="fill-current" /> : <Play size={19} className="ml-0.5 fill-current" />}
          </button>
          <button onClick={playNextChapter} aria-label="Next surah" className="hidden p-2 text-mist-dim transition-colors hover:text-white sm:block">
            <SkipForward size={19} className="fill-current" />
          </button>
          <button onClick={() => setExpanded(true)} aria-label="Open mixer" className="ml-1 hidden p-2 text-mist-dim transition-colors hover:text-gold md:block">
            <SlidersHorizontal size={19} />
          </button>
        </div>
      </div>

      {/* ---------- Expanded console ---------- */}
      <div className={cx('h-[calc(100%-92px)] overflow-y-auto px-5 pb-6 pt-5 transition-all duration-500 max-md:hidden', expanded ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Now reciting */}
          <div className="surface p-6">
            <div className="flex items-start gap-5">
              <ReciterAvatar reciter={reciter} size="md" />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Now reciting</p>
                <h3 className="display mt-2 truncate text-[26px] leading-tight text-white">{currentChapter.name_simple}</h3>
                <p className="truncate text-[13px] font-light text-mist-dim">
                  {currentChapter.translated_name?.name} · {currentChapter.verses_count} verses · {reciter?.name}
                </p>
              </div>
              <span className="arabic shrink-0 text-3xl text-gold/80">{currentChapter.name_arabic}</span>
            </div>

            <div className="mt-7">
              <div className="mb-2 flex justify-between font-mono text-[11px] tracking-widest text-mist-dim">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range" min="0" max={duration || 100} value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                aria-label="Seek"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
                style={{ background: `linear-gradient(90deg, var(--accent) ${pct}%, rgba(255,255,255,.08) ${pct}%)` }}
              />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={playPreviousChapter} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.07] text-mist transition-all hover:border-gold/30 hover:text-white">
                  <SkipBack size={16} className="fill-current" />
                </button>
                <button onClick={togglePlayPause} className="btn-gold !h-12 !w-12 !p-0">
                  {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="ml-0.5 fill-current" />}
                </button>
                <button onClick={playNextChapter} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.07] text-mist transition-all hover:border-gold/30 hover:text-white">
                  <SkipForward size={16} className="fill-current" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <Repeat size={14} className="mr-1 text-mist-dim" />
                {rates.map((r) => (
                  <button
                    key={r}
                    onClick={() => setPlaybackRate(r)}
                    className={cx(
                      'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all',
                      playbackRate === r ? 'bg-gold/15 text-gold-100 ring-1 ring-gold/30' : 'text-mist-dim hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mixer + ambience */}
          <div className="space-y-5">
            <div className="surface p-6">
              <p className="eyebrow mb-5">Audio mixer</p>
              <MixerRow
                label="Recitation" value={quranVolume} onChange={setQuranVolume}
                icon={quranVolume === 0 ? VolumeX : quranVolume < 0.5 ? Volume1 : Volume2}
              />
              <div className="my-5 hairline" />
              <MixerRow
                label="Ambience" value={ambientVolume} onChange={setAmbientVolume}
                icon={currentAmbient ? currentAmbient.icon : VolumeX}
                disabled={!currentAmbient}
                hint={currentAmbient ? currentAmbient.name : 'No soundscape'}
              />
            </div>

            <div className="surface max-h-[13.5rem] overflow-y-auto p-4">
              <p className="eyebrow sticky top-0 z-10 bg-transparent px-2 pb-3 pt-1">Soundscape</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <SoundTile active={!currentAmbient} onClick={() => setAmbientTrack(null)} icon={VolumeX} label="Silence" />
                {AMBIENT_TRACKS.map((t) => (
                  <SoundTile key={t.id} active={currentAmbient?.id === t.id} onClick={() => setAmbientTrack(t)} icon={t.icon} label={t.name} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MixerRow({
  label, value, onChange, icon: Icon, disabled, hint,
}: { label: string; value: number; onChange: (v: number) => void; icon: any; disabled?: boolean; hint?: string }) {
  return (
    <div className={cx(disabled && 'opacity-50')}>
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-[13px] text-sandstone">
          <Icon size={15} className="text-gold" strokeWidth={1.6} /> {label}
          {hint && <span className="text-[11px] text-mist-dim">· {hint}</span>}
        </span>
        <span className="font-mono text-[11px] text-mist-dim">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range" min="0" max="1" step="0.01" value={value} disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={`${label} volume`}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: `linear-gradient(90deg, var(--accent) ${value * 100}%, rgba(255,255,255,.08) ${value * 100}%)` }}
      />
    </div>
  );
}

function SoundTile({ active, onClick, icon: Icon, label }: { key?: string | number; active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 transition-all duration-300',
        active
          ? 'border-gold/40 bg-gold/[0.1] text-gold-100 shadow-[0_0_24px_-10px_var(--accent-glow)]'
          : 'border-white/[0.06] bg-white/[0.02] text-mist-dim hover:border-white/15 hover:text-sandstone',
      )}
    >
      <Icon size={19} strokeWidth={1.4} />
      <span className="w-full truncate text-center text-[10px] font-medium tracking-wide">{label}</span>
    </button>
  );
}
