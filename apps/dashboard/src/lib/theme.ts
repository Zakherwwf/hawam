import { hawemDark, hawemLight } from '@tunisia-survey/design-tokens';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'hawem.theme';

/** Writes the design tokens as CSS variables for the chosen scheme. */
export function applyTheme(mode: ThemeMode = readTheme()) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const tokens = dark ? hawemDark : hawemLight;
  const root = document.documentElement;
  for (const [k, val] of Object.entries(tokens)) root.style.setProperty(`--${k}`, val);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Private mode: the choice lasts for this visit
  }
  applyTheme(mode);
}

export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const on = () => readTheme() === 'system' && applyTheme('system');
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}
