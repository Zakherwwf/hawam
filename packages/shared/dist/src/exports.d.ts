/**
 * Scientific Data Exporters:
 * 1. Darwin Core Occurrence (DwC-A / CSV)
 * 2. Capture-History Matrix (SECR / MARK / unmarked)
 * 3. Distance Sampling (R Distance package)
 */
import { ObservationPublic, ObservationRestrictedLocation, SurveySession, Individual } from './types.js';
export interface DarwinCoreOccurrenceRecord {
    occurrenceID: string;
    eventID: string;
    eventDate: string;
    countryCode: string;
    scientificName: string;
    vernacularName: string;
    individualCount: number;
    occurrenceStatus: 'present' | 'absent';
    samplingProtocol: string;
    samplingEffort: string;
    decimalLatitude: number;
    decimalLongitude: number;
    coordinateUncertaintyInMeters: number;
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
export declare function exportDistanceSampling(sessions: SurveySession[], observations: ObservationPublic[], regionLabel?: string): DistanceSamplingRecord[];
/**
 * Helper to convert array of objects into standard CSV text.
 */
export declare function objectsToCSV<T extends object>(data: T[]): string;
