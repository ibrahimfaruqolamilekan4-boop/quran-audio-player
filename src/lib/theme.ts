import { THEME_LIBRARY } from '../components/QuranicPremiumBackground';

const STORAGE_KEY = 'nooraya_theme';
export const FALLBACK_THEME = 'midnight-scholar';

export function readStoredTheme(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEME_LIBRARY[saved]) return saved;
  } catch {
    /* storage unavailable */
  }
  return FALLBACK_THEME;
}

export function storeTheme(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
}

export function themeAccent(name: string): { primary: string; secondary: string; background: string } {
  const theme = THEME_LIBRARY[name] ?? THEME_LIBRARY[FALLBACK_THEME];
  return {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    background: theme.colors.background,
  };
}

/** Publishes the active theme onto CSS custom properties so the whole UI re-gilds. */
export function applyThemeVars(name: string) {
  const { primary, secondary } = themeAccent(name);
  const root = document.documentElement;
  root.style.setProperty('--accent', primary);
  root.style.setProperty('--accent-soft', secondary);
  root.style.setProperty('--accent-glow', hexToRgba(primary, 0.3));
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return `rgba(214, 179, 106, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mix a hex colour with black (amount 0..1) - used for deep, tinted grounds. */
export function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return hex;
  const mix = (v: number) => Math.round(v * (1 - amount));
  return `#${[mix((num >> 16) & 255), mix((num >> 8) & 255), mix(num & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
