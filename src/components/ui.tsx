import React from 'react';
import { reciterHue, reciterInitials } from '../lib/constants';
import type { Reciter } from '../types';

/* ============================================================
   NOORAYA UI PRIMITIVES
   Small, dependency-free building blocks that carry the
   gilded-obsidian language across every surface.
   ============================================================ */

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* ---------------- Ornaments ---------------- */

/** Eight-point khatam star, used as a section rule and seal. */
export function Khatam({ size = 14, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 1.6 14.3 4l3.3-.6.9 3.2 3 1.5-1.4 3 1.4 3-3 1.5-.9 3.2-3.3-.6L12 22.4 9.7 20l-3.3.6-.9-3.2-3-1.5L3.9 13 2.5 10l3-1.5.9-3.2L9.7 4Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  );
}

/** A gold hairline that dissolves into a khatam star. */
export function OrnamentRule({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <div className={cx('flex items-center gap-3 text-gold/50', flip && 'flex-row-reverse', className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
      <Khatam size={12} className="shrink-0" />
      <span className="h-px w-10 bg-gradient-to-r from-gold/40 to-transparent" />
    </div>
  );
}

/* ---------------- Type ---------------- */

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <span className="eyebrow">{children}</span>
      <span className="h-px w-8 bg-gradient-to-r from-gold/50 to-transparent" />
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-2.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="display text-[28px] leading-tight text-white sm:text-[34px]">{title}</h2>
        {subtitle && <p className="max-w-xl text-[15px] font-light leading-relaxed text-mist-dim">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------------- Surfaces ---------------- */

export function Panel({
  as: Tag = 'div',
  className,
  children,
  lit = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { as?: React.ElementType; lit?: boolean }) {
  return (
    <Tag className={cx('surface overflow-hidden', lit && 'edge-lit', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Faint arabesque wash for hero surfaces. */
export function ArabesqueWash({ opacity = 0.05 }: { opacity?: number }) {
  return <div className="arabesque pointer-events-none absolute inset-0" style={{ opacity, maskImage: 'radial-gradient(ellipse at 30% 0%, #000 10%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 30% 0%, #000 10%, transparent 75%)' }} aria-hidden="true" />;
}

/* ---------------- Data bits ---------------- */

export function Stat({ label, value, hint, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist-dim">{label}</p>
      <p className="mt-1.5 display text-xl text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-mist-dim">{hint}</p>}
    </div>
  );
}

export function Equalizer({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span className={cx('flex h-3.5 items-end gap-[3px]', className)} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="eq-bar h-full"
          style={{ animationDelay: `${i * 140}ms`, animationPlayState: playing ? 'running' : 'paused', opacity: playing ? 1 : 0.35 }}
        />
      ))}
    </span>
  );
}

/* ---------------- Reciter portrait ---------------- */

const SIZES: Record<string, string> = {
  xs: 'h-9 w-9 text-[11px] rounded-[10px]',
  sm: 'h-12 w-12 text-xs rounded-xl',
  md: 'h-20 w-20 text-lg rounded-[20px]',
  lg: 'h-32 w-32 text-2xl rounded-[26px]',
  xl: 'h-44 w-44 text-[34px] rounded-[34px] sm:h-52 sm:w-52',
};

export function ReciterAvatar({
  reciter,
  size = 'md',
  ring = true,
  className,
  imgClassName,
}: {
  reciter: Pick<Reciter, 'id' | 'name' | 'image'> | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [reciter?.image]);

  if (!reciter) return null;
  const useImage = Boolean(reciter.image) && !failed;
  const hue = reciterHue(reciter.id);

  return (
    <div
      className={cx(
        'relative shrink-0 overflow-hidden bg-ink-900',
        SIZES[size],
        ring && 'ring-1 ring-white/10',
        className,
      )}
      style={
        ring
          ? { boxShadow: `0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent), 0 18px 40px -22px rgba(0,0,0,.9)` }
          : undefined
      }
    >
      {useImage ? (
        <img
          src={reciter.image}
          alt={`Portrait of ${reciter.name}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cx('h-full w-full object-cover object-top', imgClassName)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            background: `radial-gradient(120% 120% at 20% 0%, hsl(${hue} 38% 22%) 0%, #0A0E16 62%), linear-gradient(160deg, rgba(255,255,255,.07), rgba(0,0,0,.4))`,
          }}
        >
          <div className="arabesque absolute inset-0 opacity-[0.09]" aria-hidden="true" />
          <span className="display relative font-semibold tracking-[0.06em] text-gold-100/90">{reciterInitials(reciter.name)}</span>
        </div>
      )}
      {/* gilded inner edge */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-inset ring-1 ring-white/[0.07]" aria-hidden="true" />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'linear-gradient(to top, rgba(5,7,12,.6), transparent)' }}
        aria-hidden="true"
      />
    </div>
  );
}
