/**
 * Basemap for the native MapLibre renderer. No token: the default is the
 * free OpenFreeMap "liberty" style. For production, host a Protomaps build on
 * your own object storage + CDN (TECHNICAL_REVIEW.md §5.2) and point
 * EXPO_PUBLIC_MAP_STYLE_URL at its style.json.
 */
export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** Where a map with no saved camera and no GPS fix opens. */
export const WORLD_VIEW = { center: [0, 20] as [number, number], zoom: 1.5 };
