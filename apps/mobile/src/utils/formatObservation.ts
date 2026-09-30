/**
 * Display formatting for observations. Storage is untouched: coordinates stay
 * signed decimal degrees and times stay ISO 8601 UTC.
 */

/** "12.04955° S, 77.04433° W". 5 decimals is ~1 m, the best a phone GPS does. */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(5)}° ${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(longitude).toFixed(5)}° ${longitude < 0 ? 'W' : 'E'}`;
  return `${lat}, ${lon}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function time(d: Date): string {
  try {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

function shortDate(d: Date, withYear: boolean): string {
  try {
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * When a sighting happened, in the phone's time zone: "Today, 09:29",
 * "Yesterday, 18:02", "3 Sep, 07:45", or with the year once it is not this year.
 * Labels come from the caller so they are translated.
 */
export function formatObservedAt(
  iso: string,
  labels: { today: string; yesterday: string },
  now: Date = new Date()
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `${labels.today}, ${time(d)}`;
  if (sameDay(d, yesterday)) return `${labels.yesterday}, ${time(d)}`;
  return `${shortDate(d, d.getFullYear() !== now.getFullYear())}, ${time(d)}`;
}

/** The day heading for a list of sightings: "Today", "Yesterday" or "3 Sep". */
export function formatDay(
  iso: string,
  labels: { today: string; yesterday: string },
  now: Date = new Date()
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return labels.today;
  if (sameDay(d, yesterday)) return labels.yesterday;
  return shortDate(d, d.getFullYear() !== now.getFullYear());
}
