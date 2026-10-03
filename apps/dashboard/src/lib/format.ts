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

export const fmtDec = (n: number, d = 2) =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n);
export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const fmtDay = (iso: string | Date) =>
  new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(iso)
  );
export const fmtMonth = (d: Date) =>
  new Intl.DateTimeFormat(lang, { month: 'short', year: '2-digit' }).format(d);

/** Axis and tooltip labels for a time bucket of the given grain. */
export function bucketLabel(grain: 'day' | 'week' | 'month', long = false) {
  if (grain === 'month')
    return (d: Date) =>
      new Intl.DateTimeFormat(lang, {
        month: long ? 'long' : 'short',
        year: long ? 'numeric' : '2-digit',
      }).format(d);
  if (grain === 'week' && long)
    return (d: Date) =>
      `Week of ${new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)}`;
  return (d: Date) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(d);
}

const rtf =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    : null;
/** "3 days ago", "yesterday" */
export function fmtAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 'Never';
  const s = (new Date(iso).getTime() - now) / 1000;
  const a = Math.abs(s);
  if (!rtf) return fmtDate(iso);
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 45) return rtf.format(Math.round(s / 86400), 'day');
  if (a < 86400 * 400) return rtf.format(Math.round(s / (86400 * 30)), 'month');
  return rtf.format(Math.round(s / (86400 * 365)), 'year');
}

/** Format a metric value with its definition's precision. */
export const fmtMetric = (v: number | null | undefined, decimals: number) =>
  v == null ? 'No data' : decimals ? fmtDec(v, decimals) : fmtInt(v);
