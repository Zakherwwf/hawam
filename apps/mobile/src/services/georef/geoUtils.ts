/**
 * Spatial Georeferencing & Mathematical Utilities
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * 1. Observer vs. Animal Georeferencing (Turf destination from bearing + distance)
 * 2. Perpendicular Distance to Transect for Distance Sampling (Turf point-to-line-distance)
 * 3. H3 Spatial Hex Indexing (res 7 & 9 via h3-js)
 * 4. GPS Track Simplification (Turf simplify)
 */

import { destination, point, lineString, pointToLineDistance, simplify, distance } from '@turf/turf';
import * as h3 from 'h3-js';

export interface LatLon {
  latitude: number;
  longitude: number;
}

export interface GeoreferencedAnimalLocation {
  animalLat: number;
  animalLon: number;
  perpendicularDistanceM?: number;
  h3Res9: string;
  h3Res7: string;
}

/**
 * Computes estimated animal location given observer position, distance in meters, and bearing in degrees.
 */
export function computeAnimalLocation(
  observerLat: number,
  observerLon: number,
  distanceMeters: number,
  bearingDegrees: number,
  transectCoords?: [number, number][]
): GeoreferencedAnimalLocation {
  // If distance is zero, animal is at observer position
  let animalLat = observerLat;
  let animalLon = observerLon;

  if (distanceMeters > 0) {
    const observerPoint = point([observerLon, observerLat]);
    const distanceKm = distanceMeters / 1000.0;
    const dest = destination(observerPoint, distanceKm, bearingDegrees, { units: 'kilometers' });
    animalLon = dest.geometry.coordinates[0];
    animalLat = dest.geometry.coordinates[1];
  }

  // Calculate perpendicular distance to transect if route/track is provided
  let perpendicularDistanceM: number | undefined;
  if (transectCoords && transectCoords.length >= 2) {
    try {
      const animalPt = point([animalLon, animalLat]);
      const transectLine = lineString(transectCoords.map((c) => [c[1], c[0]])); // [lon, lat]
      const distKm = pointToLineDistance(animalPt, transectLine, { units: 'kilometers' });
      perpendicularDistanceM = parseFloat((distKm * 1000).toFixed(1));
    } catch (e) {
      // Fallback: default to estimated distance
      perpendicularDistanceM = distanceMeters;
    }
  }

  // H3 Spatial Hex indexing
  let h3Res9 = '';
  let h3Res7 = '';
  try {
    h3Res9 = h3.latLngToCell(animalLat, animalLon, 9);
    h3Res7 = h3.latLngToCell(animalLat, animalLon, 7);
  } catch (e) {
    h3Res9 = 'h3_res9_default';
    h3Res7 = 'h3_res7_default';
  }

  return {
    animalLat: parseFloat(animalLat.toFixed(6)),
    animalLon: parseFloat(animalLon.toFixed(6)),
    perpendicularDistanceM,
    h3Res9,
    h3Res7,
  };
}

/**
 * Simplifies a high-frequency GPS track using Douglas-Peucker algorithm
 * while preserving key turns.
 */
export function simplifyGpsTrack(
  track: [number, number][],
  toleranceMeters: number = 3.0
): [number, number][] {
  if (!track || track.length < 3) return track;

  try {
    const line = lineString(track.map((c) => [c[1], c[0]]));
    const simplified = simplify(line, {
      tolerance: toleranceMeters / 111320.0, // convert meters to approximate degrees
      highQuality: true,
      mutate: false,
    });
    return simplified.geometry.coordinates.map((c) => [c[1], c[0]]);
  } catch (e) {
    return track;
  }
}

/**
 * Formats coordinates for clear scientific display (WGS84)
 */
export function formatCoordinates(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

/**
 * Calculates perpendicular distance from a coordinate to a route polyline in meters.
 */
export function calculateDistanceToRouteM(
  lat: number,
  lon: number,
  routeCoords: [number, number][]
): number {
  if (!routeCoords || routeCoords.length < 2) return 0;
  try {
    const pt = point([lon, lat]);
    const line = lineString(routeCoords.map((c) => [c[1], c[0]]));
    const distKm = pointToLineDistance(pt, line, { units: 'kilometers' });
    return parseFloat((distKm * 1000).toFixed(1));
  } catch (e) {
    return 0;
  }
}

/**
 * Calculates geodesic distance between two coordinate pairs in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  try {
    const from = point([lon1, lat1]);
    const to = point([lon2, lat2]);
    return distance(from, to, { units: 'kilometers' });
  } catch (e) {
    // Standard Haversine formula fallback
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

