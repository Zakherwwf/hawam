/**
 * Spatial Grid Generalization Utilities for Animal Protection.
 *
 * Free-roaming cats and dogs face risks of culling in many places.
 * Public and volunteer-facing coordinates are strictly generalized to ~1 km grid cells.
 */
// 1 degree latitude ~= 111,000 meters
const METERS_PER_DEGREE_LAT = 111000;
const GRID_SIZE_METERS = 1000; // 1 km
/**
 * Calculates a 1 km grid cell ID and its centroid for any given coordinate.
 *
 * Latitude bands are 1 km tall; within a band the longitude step is 1 km at
 * the band's centre latitude, so cells are ~1 km x 1 km anywhere on Earth.
 * Bands are clamped at +/-85 degrees. Must stay identical to
 * public.grid_1km_indices() in supabase/migrations/20260929000002.
 *
 * @param longitude Longitude in decimal degrees (EPSG:4326)
 * @param latitude Latitude in decimal degrees (EPSG:4326)
 */
export function generalizeTo1KmGrid(longitude, latitude) {
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error(`Invalid geographic coordinates: lat=${latitude}, lon=${longitude}`);
    }
    // Latitudinal grid spacing (constant ~0.009009 deg)
    const latStep = GRID_SIZE_METERS / METERS_PER_DEGREE_LAT;
    const clampedLat = Math.max(-85, Math.min(85, latitude));
    const latIndex = Math.floor(clampedLat / latStep);
    // Longitudinal spacing from the band centre, so every point in a band
    // shares the same longitude grid
    const bandCentreRad = ((latIndex + 0.5) * latStep * Math.PI) / 180;
    const lonStep = GRID_SIZE_METERS / (METERS_PER_DEGREE_LAT * Math.cos(bandCentreRad));
    const lonIndex = Math.floor(longitude / lonStep);
    // Cell Centroid (midpoint of the 1km x 1km cell)
    const centroidLat = (latIndex + 0.5) * latStep;
    const centroidLon = (lonIndex + 0.5) * lonStep;
    // Fixed precision to 5 decimal places (~1.1m precision at centroid)
    const roundedCentroidLat = Number(centroidLat.toFixed(5));
    const roundedCentroidLon = Number(centroidLon.toFixed(5));
    // Cell identifier (e.g. 1KM-N36.812-E10.165)
    const latDir = latIndex >= 0 ? 'N' : 'S';
    const lonDir = lonIndex >= 0 ? 'E' : 'W';
    const gridCellId = `1KM-${latDir}${Math.abs(latIndex)}-${lonDir}${Math.abs(lonIndex)}`;
    // The maximum distance from cell centroid to any corner in a 1000m x 1000m square:
    // sqrt(500^2 + 500^2) ~= 707.1 meters
    const coordinateUncertaintyInMeters = 707;
    return {
        centroid: [roundedCentroidLon, roundedCentroidLat],
        gridCellId,
        coordinateUncertaintyInMeters,
        dataGeneralizations: 'Coordinates generalized to 1 km grid centroid to protect free-roaming animals from municipal culling',
        informationWithheld: 'Exact GPS coordinates restricted to certified researchers and administrators',
    };
}
/**
 * Validates whether a given coordinate matches a generalized centroid.
 */
export function isLocationGeneralized(origLon, origLat, genLon, genLat) {
    const gen = generalizeTo1KmGrid(origLon, origLat);
    return Math.abs(gen.centroid[0] - genLon) < 0.0001 && Math.abs(gen.centroid[1] - genLat) < 0.0001;
}
