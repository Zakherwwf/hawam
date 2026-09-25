import type { Species } from '@tunisia-survey/shared';

/**
 * Standardized Scientific Observation Code Generator
 * Hawem Citizen-Science Platform
 *
 * Formats:
 * - Session transect observation: SPECIES-001 (e.g., DOG-001, CAT-002)
 * - Opportunistic observation: SPECIES-DDMM-001 (e.g., DOG-2509-001)
 */

export function generateScientificObservationCode(
  species: Species | 'cat' | 'dog' | 'unknown',
  sequenceNumber: number
): string {
  const prefix = species === 'cat' ? 'CAT' : species === 'dog' ? 'DOG' : 'OBS';
  const padded = String(Math.max(1, sequenceNumber)).padStart(3, '0');
  return `${prefix}-${padded}`;
}

export function getNextSessionObservationCode(
  species: Species | 'cat' | 'dog' | 'unknown',
  existingDetections: Array<{ id?: string; species?: string }>
): string {
  const nextSeq = existingDetections.length + 1;
  return generateScientificObservationCode(species, nextSeq);
}

export function generateOpportunisticCode(
  species: Species | 'cat' | 'dog' | 'unknown',
  sequenceNumber: number = 1
): string {
  const prefix = species === 'cat' ? 'CAT' : species === 'dog' ? 'DOG' : 'OBS';
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const padded = String(Math.max(1, sequenceNumber)).padStart(3, '0');
  return `${prefix}-${day}${month}-${padded}`;
}
