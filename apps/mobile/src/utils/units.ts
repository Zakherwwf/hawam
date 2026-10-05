/**
 * Presentation-layer distance units. Storage and every computation stay in
 * metres (CLAUDE.md §1.4); only what the volunteer reads is converted, so a US
 * volunteer estimates in the unit they can judge by eye.
 */
export type MeasurementSystem = 'metric' | 'imperial';

const METERS_PER_FOOT = 0.3048;
// Regions whose everyday distance unit is the foot
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

export function measurementSystemForLocale(locale?: string): MeasurementSystem {
  let tag = locale;
  if (!tag) {
    try {
      tag = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      tag = 'en';
    }
  }
  const region = tag.split(/[-_]/).find((part, i) => i > 0 && /^[A-Z]{2}$/i.test(part));
  return region && IMPERIAL_REGIONS.has(region.toUpperCase()) ? 'imperial' : 'metric';
}

export function formatDistance(meters: number, system: MeasurementSystem, decimals = 1): string {
  if (system === 'imperial') {
    return `${Math.round(meters / METERS_PER_FOOT)} ft`;
  }
  return `${meters.toFixed(decimals)} m`;
}

export function toMeters(value: number, system: MeasurementSystem): number {
  return system === 'imperial' ? value * METERS_PER_FOOT : value;
}
