import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBearing,
  getBearingMetadata,
  computeAnimalLocation,
} from '../services/georef/geoUtils.ts';

test('bearing: normalizeBearing clamps and wraps all degree angles into [0, 360)', () => {
  // Standard range
  assert.equal(normalizeBearing(0), 0);
  assert.equal(normalizeBearing(45), 45);
  assert.equal(normalizeBearing(180), 180);
  assert.equal(normalizeBearing(359.9), 359.9);

  // Exact 360 wraps to 0
  assert.equal(normalizeBearing(360), 0);
  assert.equal(normalizeBearing(720), 0);

  // Overflow > 360
  assert.equal(normalizeBearing(405), 45);
  assert.equal(normalizeBearing(450), 90);

  // Negative degrees
  assert.equal(normalizeBearing(-45), 315);
  assert.equal(normalizeBearing(-90), 270);
  assert.equal(normalizeBearing(-180), 180);
  assert.equal(normalizeBearing(-360), 0);
  assert.equal(normalizeBearing(-370), 350);
});

test('bearing: getBearingMetadata maps 8-point compass sectors accurately', () => {
  // North sector (around 0° / 360°)
  const north = getBearingMetadata(0);
  assert.equal(north.cardinal, 'N');
  assert.equal(north.cardinalAr, 'شمال');
  assert.ok(north.relativeLabel.includes('Ahead'));

  const nearNorth355 = getBearingMetadata(355);
  assert.equal(nearNorth355.cardinal, 'N');

  const nearNorth10 = getBearingMetadata(10);
  assert.equal(nearNorth10.cardinal, 'N');

  // North-East (45°)
  const ne = getBearingMetadata(45);
  assert.equal(ne.cardinal, 'NE');
  assert.equal(ne.cardinalAr, 'شمال شرقي');
  assert.ok(ne.relativeLabel.includes('Front-Right'));

  // East (90°)
  const east = getBearingMetadata(90);
  assert.equal(east.cardinal, 'E');
  assert.equal(east.cardinalAr, 'شرق');
  assert.ok(east.relativeLabel.includes('Perpendicular Right'));

  // South-East (135°)
  const se = getBearingMetadata(135);
  assert.equal(se.cardinal, 'SE');
  assert.ok(se.relativeLabel.includes('Back-Right'));

  // South (180°)
  const south = getBearingMetadata(180);
  assert.equal(south.cardinal, 'S');
  assert.equal(south.cardinalAr, 'جنوب');
  assert.ok(south.relativeLabel.includes('Behind'));

  // South-West (225°)
  const sw = getBearingMetadata(225);
  assert.equal(sw.cardinal, 'SW');
  assert.ok(sw.relativeLabel.includes('Back-Left'));

  // West (270°)
  const west = getBearingMetadata(270);
  assert.equal(west.cardinal, 'W');
  assert.equal(west.cardinalAr, 'غرب');
  assert.ok(west.relativeLabel.includes('Perpendicular Left'));

  // North-West (315°)
  const nw = getBearingMetadata(315);
  assert.equal(nw.cardinal, 'NW');
  assert.ok(nw.relativeLabel.includes('Front-Left'));
});

test('bearing: computeAnimalLocation computes georeferenced destination at varying bearings', () => {
  const obsLat = 36.8000;
  const obsLon = 10.1800;
  const distanceM = 50;

  // Due North (0°): latitude increases, longitude unchanged
  const targetNorth = computeAnimalLocation(obsLat, obsLon, distanceM, 0);
  assert.ok(targetNorth.animalLat > obsLat, 'North: latitude should increase');
  assert.ok(Math.abs(targetNorth.animalLon - obsLon) < 0.00005, 'North: longitude should stay constant');

  // Due East (90°): longitude increases, latitude unchanged
  const targetEast = computeAnimalLocation(obsLat, obsLon, distanceM, 90);
  assert.ok(targetEast.animalLon > obsLon, 'East: longitude should increase');
  assert.ok(Math.abs(targetEast.animalLat - obsLat) < 0.00005, 'East: latitude should stay constant');

  // Due South (180°): latitude decreases, longitude unchanged
  const targetSouth = computeAnimalLocation(obsLat, obsLon, distanceM, 180);
  assert.ok(targetSouth.animalLat < obsLat, 'South: latitude should decrease');
  assert.ok(Math.abs(targetSouth.animalLon - obsLon) < 0.00005, 'South: longitude should stay constant');

  // Due West (270°): longitude decreases, latitude unchanged
  const targetWest = computeAnimalLocation(obsLat, obsLon, distanceM, 270);
  assert.ok(targetWest.animalLon < obsLon, 'West: longitude should decrease');
  assert.ok(Math.abs(targetWest.animalLat - obsLat) < 0.00005, 'West: latitude should stay constant');

  // Diagonal North-East (45°): both latitude and longitude increase
  const targetNE = computeAnimalLocation(obsLat, obsLon, distanceM, 45);
  assert.ok(targetNE.animalLat > obsLat, 'NE: latitude should increase');
  assert.ok(targetNE.animalLon > obsLon, 'NE: longitude should increase');
});
