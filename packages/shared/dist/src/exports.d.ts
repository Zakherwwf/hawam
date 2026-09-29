/**
 * Scientific Data Exporters:
 * 1. Darwin Core Occurrence (DwC-A / CSV)
 * 2. Capture-History Matrix (SECR / MARK / unmarked)
 * 3. Distance Sampling (R Distance package)
 */
import { ObservationPublic, ObservationRestrictedLocation, SurveySession, Individual, Species } from './types';
/** Bump when a column is added, removed or changes meaning. */
export declare const EXPORT_SCHEMA_VERSION = "2.0.0";
/** GBIF backbone taxonomy, mirrored in public.ref_taxa (verified via api.gbif.org). */
export declare const GBIF_TAXA: Record<Species, {
    scientificName: string;
    taxonRank: string;
    taxonKey: number;
}>;
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
export declare function exportToDarwinCore(sessions: SurveySession[], observations: ObservationPublic[], options?: {
    restrictedLocations?: Map<string, ObservationRestrictedLocation>;
    allowPreciseCoordinates?: boolean;
}): DarwinCoreOccurrenceRecord[];
/**
 * Capture-History Matrix Export for Mark-Resight / SECR.
 * Produces rows formatted for R packages: `secr`, `unmarked`, or Program MARK.
 */
export interface CaptureHistoryRow {
    individual_id: string;
    species: string;
    coat_description: string;
    history: number[];
    occasions: string[];
}
export declare function exportCaptureHistoryMatrix(individuals: Individual[], occasions: SurveySession[], observations: ObservationPublic[]): CaptureHistoryRow[];
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
    Effort: number;
    distance: number | '';
    size: number;
    species: string;
    detected: 0 | 1;
}
export declare function exportDistanceSampling(sessions: SurveySession[], observations: ObservationPublic[], 
/** Stratum label; defaults to each session's country code */
regionLabel?: string): DistanceSamplingRecord[];
/**
 * Helper to convert array of objects into standard CSV text.
 */
export declare function objectsToCSV<T extends object>(data: T[]): string;
