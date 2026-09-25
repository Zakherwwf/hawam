/**
 * Utility functions and constants for WorkoutHUD.
 * Pure TypeScript without JSX, safe for Node test runners.
 */

export const POCKET_SAFE_DELAY_MS = 600;

export function getGpsQuality(
  accuracyM?: number,
  isPaused: boolean = false
): { label: string; level: 'good' | 'fair' | 'poor' | 'paused' } {
  if (isPaused) {
    return { label: 'PAUSED', level: 'paused' };
  }
  if (accuracyM === undefined || accuracyM === null || accuracyM <= 0) {
    return { label: 'GPS: POOR', level: 'poor' };
  }
  if (accuracyM <= 10) {
    return { label: `GPS: GOOD (${Math.round(accuracyM)}m)`, level: 'good' };
  }
  if (accuracyM <= 25) {
    return { label: `GPS: FAIR (${Math.round(accuracyM)}m)`, level: 'fair' };
  }
  return { label: `GPS: POOR (${Math.round(accuracyM)}m)`, level: 'poor' };
}
