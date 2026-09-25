import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAnimalLocation,
  simplifyGpsTrack,
  formatCoordinates,
  calculateDistanceToRouteM,
  calculateDistanceKm,
} from '../services/georef/geoUtils.ts';

test('geoUtils: computeAnimalLocation returns observer location when distance is 0', () => {
  const obsLat = 36.8000;
  const obsLon = 10.1800;

  const result = computeAnimalLocation(obsLat, obsLon, 0, 90);

  assert.equal(result.animalLat, obsLat);
  assert.equal(result.animalLon, obsLon);
  assert.ok(result.h3Res9.length > 0);
  assert.ok(result.h3Res7.length > 0);
});

test('geoUtils: computeAnimalLocation calculates correct bearing and offset for distance > 0', () => {
  const obsLat = 36.8000;
  const obsLon = 10.1800;
  const distanceM = 100; // 100 meters due North (bearing 0)

  const result = computeAnimalLocation(obsLat, obsLon, distanceM, 0);

  // Bearing 0 (North): Latitude increases, longitude stays approximately the same
  assert.ok(result.animalLat > obsLat);
  assert.ok(Math.abs(result.animalLon - obsLon) < 0.0001);

  // Approximately 100m in degrees latitude (~ 100 / 111320 ≈ 0.000898)
  const latDiff = result.animalLat - obsLat;
  assert.ok(latDiff > 0.0008 && latDiff < 0.001);
});

test('geoUtils: computeAnimalLocation generates valid H3 resolution 7 and 9 cell indices', () => {
  const result = computeAnimalLocation(36.8002, 10.1805, 10, 45);

  // H3 index is a 15-character hex string starting with 8 (e.g., 89386e2106bffff)
  assert.equal(result.h3Res9.length, 15);
  assert.equal(result.h3Res7.length, 15);
  assert.match(result.h3Res9, /^[0-9a-f]{15}$/i);
  assert.match(result.h3Res7, /^[0-9a-f]{15}$/i);
});

test('geoUtils: computeAnimalLocation calculates perpendicular distance to transect', () => {
  // Transect running South to North along longitude 10.1800
  const transect: [number, number][] = [
    [36.7900, 10.1800],
    [36.8100, 10.1800],
  ];

  // Observer at 36.8000, 10.1800, spots animal 50m due East (bearing 90)
  const result = computeAnimalLocation(36.8000, 10.1800, 50, 90, transect);

  assert.ok(result.perpendicularDistanceM !== undefined);
  // Perpendicular distance to the North-South line should be very close to 50 meters
  assert.ok(result.perpendicularDistanceM! >= 48 && result.perpendicularDistanceM! <= 52);
});

test('geoUtils: calculateDistanceToRouteM returns correct perpendicular distance', () => {
  const route: [number, number][] = [
    [36.8000, 10.1800],
    [36.8100, 10.1800],
  ];

  // Point directly on the line
  const d0 = calculateDistanceToRouteM(36.8050, 10.1800, route);
  assert.ok(d0 < 1.0); // essentially 0m

  // Empty or invalid route returns 0
  assert.equal(calculateDistanceToRouteM(36.8050, 10.1800, []), 0);
});

test('geoUtils: simplifyGpsTrack reduces colinear vertices', () => {
  // A straight line with redundant points in the middle
  const rawTrack: [number, number][] = [
    [36.8000, 10.1800],
    [36.8001, 10.1800],
    [36.8002, 10.1800],
    [36.8003, 10.1800],
    [36.8004, 10.1800],
  ];

  const simplified = simplifyGpsTrack(rawTrack, 5.0);

  // Start and end are preserved, intermediate colinear points removed
  assert.ok(simplified.length < rawTrack.length);
  assert.deepEqual(simplified[0], rawTrack[0]);
  assert.deepEqual(simplified[simplified.length - 1], rawTrack[rawTrack.length - 1]);
});

test('geoUtils: formatCoordinates outputs standardized WGS84 cardinal format', () => {
  const formatted = formatCoordinates(36.80001, 10.18002);
  assert.equal(formatted, '36.80001° N, 10.18002° E');

  const southernWestern = formatCoordinates(-34.6037, -58.3816);
  assert.equal(southernWestern, '34.60370° S, 58.38160° W');
});

test('geoUtils: calculateDistanceKm returns 0 for identical points', () => {
  const dist = calculateDistanceKm(36.8000, 10.1800, 36.8000, 10.1800);
  assert.equal(dist, 0);
});

test('geoUtils: calculateDistanceKm returns accurate geodesic distance between known landmarks', () => {
  // Tunis Medina (36.7992, 10.1706) to Avenue Habib Bourguiba (36.8000, 10.1800) is ~850 meters (0.85 km)
  const dist = calculateDistanceKm(36.7992, 10.1706, 36.8000, 10.1800);
  assert.ok(dist >= 0.8 && dist <= 0.95);
});

