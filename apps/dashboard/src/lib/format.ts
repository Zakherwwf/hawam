/** Intl formatting in the browser's language (web guidelines: no hand-rolled formats). */
const lang =
  typeof navigator !== 'undefined' ? navigator.languages?.[0] || navigator.language : 'en';

export const fmtInt = (n: number) =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(n);
export const fmtKm = (n: number) =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: n < 10 ? 2 : 1 }).format(n);
export const fmtPct = (n: number) =>
  new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(n);
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  );
export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
export const fmtWeek = (d: Date) =>
  new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(d);

export function fmtDuration(minutes: number | null | undefined) {
  if (minutes == null) return '-';
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
