/**
 * Scientific Data Exporters:
 * 1. Darwin Core Occurrence (DwC-A / CSV)
 * 2. Capture-History Matrix (SECR / MARK / unmarked)
 * 3. Distance Sampling (R Distance package)
 */

import {
  ObservationPublic,
  ObservationRestrictedLocation,
  SurveySession,
  Individual,
  Species,
} from './types';
import { generalizeTo1KmGrid } from './grid';

/** Bump when a column is added, removed or changes meaning. */
export const EXPORT_SCHEMA_VERSION = '2.0.0';

/** GBIF backbone taxonomy, mirrored in public.ref_taxa (verified via api.gbif.org). */
export const GBIF_TAXA: Record<
  Species,
  { scientificName: string; taxonRank: string; taxonKey: number }
> = {
  cat: { scientificName: 'Felis catus Linnaeus, 1758', taxonRank: 'species', taxonKey: 2435035 },
  dog: {
    scientificName: 'Canis lupus familiaris Linnaeus, 1758',
    taxonRank: 'subspecies',
    taxonKey: 6164210,
  },
  unknown: { scientificName: 'Carnivora', taxonRank: 'order', taxonKey: 732 },
};

export interface DarwinCoreOccurrenceRecord {
  occurrenceID: string;
  eventID: string;
  eventDate: string;
  eventTimeZone: string;
  countryCode: string;
  stateProvince: string;
  scientificName: string;
  taxonRank: string;
  taxonKey: number;
  vernacularName: string;
  individualCount: number;
  occurrenceStatus: 'present' | 'absent';
  samplingProtocol: string;
  samplingEffort: string;
  /** null when the record has no position (e.g. a checklist without a GPS track) */
  decimalLatitude: number | null;
  decimalLongitude: number | null;
  coordinateUncertaintyInMeters: number | null;
  dataGeneralizations: string;
  informationWithheld: string;
  sex: string;
  lifeStage: string;
  reproductiveCondition: string;
  associatedMedia?: string;
  occurrenceRemarks?: string;
}

/**
 * Maps public observations and non-detection sessions to Darwin Core standard records.
 */
export function exportToDarwinCore(
  sessions: SurveySession[],
  observations: ObservationPublic[],
  options: {
    restrictedLocations?: Map<string, ObservationRestrictedLocation>;
    allowPreciseCoordinates?: boolean;
  } = {}
): DarwinCoreOccurrenceRecord[] {
  const records: DarwinCoreOccurrenceRecord[] = [];
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  // 1. Detections (Presence records)
  for (const obs of observations) {
    const session = sessionMap.get(obs.session_id);
    const effortDesc = session
      ? `duration_min=${session.duration_min ?? 0};distance_km=${session.distance_km ?? 0};protocol=${session.protocol}`
      : 'opportunistic';

    let lat = obs.location_public.coordinates[1];
    let lon = obs.location_public.coordinates[0];
    let uncertainty = 707;
    let generalizations =
      'Coordinates generalized to 1 km grid centroid to protect free-roaming animals from municipal culling';
    let withheld = 'Exact GPS coordinates restricted to certified researchers and administrators';

    // If researcher export with explicit authorization:
    if (options.allowPreciseCoordinates && options.restrictedLocations) {
      const precise = options.restrictedLocations.get(obs.id);
      if (precise) {
        lon = precise.location_precise.coordinates[0];
        lat = precise.location_precise.coordinates[1];
        uncertainty = precise.gps_accuracy_m;
        generalizations = 'None (Certified Researcher Export)';
        withheld = 'None';
      }
    }

    const taxon = GBIF_TAXA[obs.species] ?? GBIF_TAXA.unknown;

    records.push({
      occurrenceID: obs.id,
      eventID: obs.session_id,
      eventDate: obs.observed_at,
      eventTimeZone: obs.timezone ?? '',
      countryCode: obs.country_code ?? session?.country_code ?? '',
      stateProvince: obs.admin1_code ?? '',
      scientificName: taxon.scientificName,
      taxonRank: taxon.taxonRank,
      taxonKey: taxon.taxonKey,
      vernacularName: obs.species,
      individualCount: obs.group_size,
      occurrenceStatus: 'present',
      samplingProtocol: session?.protocol ?? 'incidental',
      samplingEffort: effortDesc,
      decimalLatitude: lat,
      decimalLongitude: lon,
      coordinateUncertaintyInMeters: uncertainty,
      dataGeneralizations: generalizations,
      informationWithheld: withheld,
      sex: obs.sex,
      lifeStage: obs.age_class,
      reproductiveCondition: obs.reproductive_status,
      occurrenceRemarks: obs.notes ?? undefined,
    });
  }

  // 2. Non-Detections (Complete sessions where 0 animals were recorded)
  // eBird model: A complete session with zero detections is a valid absence record.
  const observedSessionIds = new Set(observations.map((o) => o.session_id));
  for (const session of sessions) {
    if (session.complete_session && !observedSessionIds.has(session.id)) {
      // Create non-detection absence records for target species (cat and dog)
      // The track start is often the volunteer's home: publish it only as a
      // 1 km grid centroid, and publish no position at all when there is no track.
      const start = session.track?.coordinates?.[0];
      const cell = start ? generalizeTo1KmGrid(start[0], start[1]) : null;

      for (const sp of ['cat', 'dog'] as const) {
        const taxon = GBIF_TAXA[sp];
        records.push({
          occurrenceID: `absence-${session.id}-${sp}`,
          eventID: session.id,
          eventDate: session.start_time,
          eventTimeZone: session.timezone ?? '',
          countryCode: session.country_code ?? '',
          stateProvince: '',
          scientificName: taxon.scientificName,
          taxonRank: taxon.taxonRank,
          taxonKey: taxon.taxonKey,
          vernacularName: sp,
          individualCount: 0,
          occurrenceStatus: 'absent',
          samplingProtocol: session.protocol,
          samplingEffort: `duration_min=${session.duration_min ?? 0};distance_km=${session.distance_km ?? 0};protocol=${session.protocol}`,
          decimalLatitude: cell ? cell.centroid[1] : null,
          decimalLongitude: cell ? cell.centroid[0] : null,
          coordinateUncertaintyInMeters: cell ? cell.coordinateUncertaintyInMeters : null,
          dataGeneralizations: cell
            ? 'Absence record inferred from complete checklist; position is the 1 km grid centroid of the survey start'
            : 'Absence record inferred from complete checklist; no GPS track recorded',
          informationWithheld:
            'Exact survey track restricted to certified researchers and administrators',
          sex: 'unknown',
          lifeStage: 'unknown',
          reproductiveCondition: 'unknown',
          occurrenceRemarks:
            'Complete survey session with zero individuals detected (non-detection)',
        });
      }
    }
  }

  return records;
}

/**
 * Capture-History Matrix Export for Mark-Resight / SECR.
 * Produces rows formatted for R packages: `secr`, `unmarked`, or Program MARK.
 */
export interface CaptureHistoryRow {
  individual_id: string;
  species: string;
  coat_description: string;
  history: number[]; // e.g. [1, 0, 1, 0, 0] for occasions
  occasions: string[];
}

export function exportCaptureHistoryMatrix(
  individuals: Individual[],
  occasions: SurveySession[],
  observations: ObservationPublic[]
): CaptureHistoryRow[] {
  // Sort occasions chronologically
  const sortedOccasions = [...occasions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const occasionIds = sortedOccasions.map((o) => o.id);

  // Map individual sightings: Map<individual_id, Set<session_id>>
  const sightings = new Map<string, Set<string>>();
  for (const obs of observations) {
    if (obs.linked_individual_id) {
      if (!sightings.has(obs.linked_individual_id)) {
        sightings.set(obs.linked_individual_id, new Set());
      }
      sightings.get(obs.linked_individual_id)!.add(obs.session_id);
    }
  }

  return individuals.map((ind) => {
    const indSessions = sightings.get(ind.id) ?? new Set<string>();
    const history = occasionIds.map((sessionId) => (indSessions.has(sessionId) ? 1 : 0));

    return {
      individual_id: ind.id,
      species: ind.species,
      coat_description: ind.coat_description,
      history,
      occasions: occasionIds,
    };
  });
}

/**
 * Distance Sampling Table Export for R `Distance` package.
 * Columns:
 * - Region.Label (Study area / Governorate)
 * - Area (Study area size in sq km, optional)
 * - Sample.Label (Session / Transect ID)
 * - Effort (Transect line length in meters or km)
 * - distance (Perpendicular distance from path in meters)
 * - size (Group size)
 * - species (cat or dog)
 */
export interface DistanceSamplingRecord {
  'Region.Label': string;
  'Sample.Label': string;
  Effort: number; // in meters
  distance: number | ''; // in meters (blank if transect had 0 animals or distance not recorded)
  size: number;
  species: string;
  detected: 0 | 1;
}

export function exportDistanceSampling(
  sessions: SurveySession[],
  observations: ObservationPublic[],
  /** Stratum label; defaults to each session's country code */
  regionLabel?: string
): DistanceSamplingRecord[] {
  const records: DistanceSamplingRecord[] = [];
  const transectSessions = sessions.filter((s) => s.protocol === 'transect');

  for (const session of transectSessions) {
    const sessionObs = observations.filter((o) => o.session_id === session.id);
    const effortMeters = (session.distance_km ?? 0) * 1000;
    const stratum = regionLabel ?? session.country_code ?? 'unassigned';

    if (sessionObs.length === 0) {
      // Non-detection session still provides effort
      records.push({
        'Region.Label': stratum,
        'Sample.Label': session.id,
        Effort: effortMeters,
        distance: '',
        size: 0,
        species: 'none',
        detected: 0,
      });
    } else {
      for (const obs of sessionObs) {
        records.push({
          'Region.Label': stratum,
          'Sample.Label': session.id,
          Effort: effortMeters,
          distance: obs.distance_from_path_m != null ? obs.distance_from_path_m : '',
          size: obs.group_size,
          species: obs.species,
          detected: 1,
        });
      }
    }
  }

  return records;
}

/**
 * Helper to convert array of objects into standard CSV text.
 */
export function objectsToCSV<T extends object>(data: T[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]) as Array<keyof T>;
  const rows = data.map((item) =>
    headers
      .map((header) => {
        const val = item[header];
        if (val == null) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
