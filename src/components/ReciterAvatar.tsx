import React, { useEffect, useState } from 'react';
import { Mic2 } from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Reciter } from '../types';

/** Merge classes so the caller's Tailwind utilities win on conflicts (size, radius, border). */
const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const HONORIFICS = new Set(['sheikh', 'sheik', 'shaykh', 'sheikha', 'dr', 'doctor', 'qari', 'imam', 'hafiz', 'abu']);

/** Up to two initials, ignoring honorific prefixes so "Sheikh Mishary Alafasy" reads "MA". */
export function reciterInitials(name: string): string {
  const words = name.split(/\s+/).map(w => w.replace(/[^A-Za-z\u0600-\u06FF'.-]/g, '')).filter(Boolean);
  if (words.length === 0) return '?';
  const meaningful = words.filter(w => !HONORIFICS.has(w.toLowerCase()));
  const pool = meaningful.length > 0 ? meaningful : words;
  const first = pool[0][0];
  const last = pool.length > 1 ? pool[pool.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface ReciterAvatarProps {
  reciter: Pick<Reciter, 'name' | 'imageUrl'>;
  /** Size/shape utilities; must include a width+height or sit in a sized parent. */
  className?: string;
  /** Text utilities for the monogram fallback. */
  contentClassName?: string;
  shape?: 'circle' | 'rounded';
  iconSize?: number;
}

/**
 * Renders a reciter's photograph and never shows a broken image: while loading,
 * or if the photo is missing or fails, a gradient monogram takes its place.
 * Fills its parent (h-full w-full) so it can never collapse to zero height.
 */
export function ReciterAvatar({
  reciter,
  className,
  contentClassName = 'text-2xl',
  shape = 'rounded',
  iconSize = 24,
}: ReciterAvatarProps) {
  const [failed, setFailed] = useState(false);

  // A new photo must clear the previous failure or a good image stays hidden.
  useEffect(() => {
    setFailed(false);
  }, [reciter.imageUrl]);

  const source = reciter.imageUrl && !failed ? reciter.imageUrl : null;
  const initials = reciterInitials(reciter.name);

  return (
    <div
      className={cn(
        'relative isolate block h-full w-full overflow-hidden rounded-[1.75rem]',
        'border border-white/10 bg-gradient-to-br from-[#101a2b] to-[#04070d]',
        shape === 'circle' && 'rounded-full',
        className
      )}
    >
      {source ? (
        <img
          src={source}
          alt={reciter.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 block h-full w-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {initials === '?' ? (
            <Mic2 size={iconSize} className="text-slate-600" />
          ) : (
            <span className={cn('font-serif tracking-wide text-teal-200/90', contentClassName)}>{initials}</span>
          )}
        </div>
      )}
    </div>
  );
}
