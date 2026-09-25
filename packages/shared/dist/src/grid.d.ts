/**
 * Spatial Grid Generalization Utilities for Animal Protection.
 *
 * Free-roaming cats and dogs in Tunisia face risks of municipal culling.
 * Public and volunteer-facing coordinates are strictly generalized to ~1 km grid cells.
 */
export interface GeneralizedLocation {
    centroid: [number, number];
    gridCellId: string;
    coordinateUncertaintyInMeters: number;
    dataGeneralizations: string;
    informationWithheld: string;
}
/**
 * Calculates a 1 km grid cell ID and its centroid for any given coordinate.
 * Uses spherical approximation tailored for Tunisia (~30N to 37.5N).
 *
 * @param longitude Longitude in decimal degrees (EPSG:4326)
 * @param latitude Latitude in decimal degrees (EPSG:4326)
 */
export declare function generalizeTo1KmGrid(longitude: number, latitude: number): GeneralizedLocation;
/**
 * Validates whether a given coordinate matches a generalized centroid.
 */
export declare function isLocationGeneralized(origLon: number, origLat: number, genLon: number, genLat: number): boolean;
