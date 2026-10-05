import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWalkBundle } from '../features/survey/buildWalkBundle.ts';

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const base = {
  sessionId: 'sess-123-abc',
  protocol: 'transect' as const,
  startedAt: '2026-09-30T08:00:00Z',
  endedAt: '2026-09-30T08:40:00Z',
  distanceKm: 1.23456,
  appVersion: '3.0.0',
  newId,
};
const det = (over: object = {}) => ({
  id: 'd1',
  species: 'cat' as const,
  group_size: 2,
  observed_at: '2026-09-30T08:10:00Z',
  observer_lat: 36.8,
  observer_lon: 10.18,
  animal_lat: 36.8,
  animal_lon: 10.18,
  h3_res9: 'x',
  ...over,
});

test('buildWalkBundle: zero-animal complete walk is a valid non-detection', () => {
  const b = buildWalkBundle({
    ...base,
    completeChecklist: true,
    detections: [],
    activeTrack: [
      [36.8, 10.18],
      [36.801, 10.18],
      [36.802, 10.181],
    ],
    rawTrackPoints: [
      { recorded_at: '2026-09-30T08:00:01Z', latitude: 36.8, longitude: 10.18, accuracy_m: 5 },
      { recorded_at: '2026-09-30T08:00:02Z', latitude: 36.8, longitude: 10.18, accuracy_m: 48 },
    ],
  });
  assert.equal(b.session.complete_session, true);
  assert.equal(b.observations.length, 0);
  assert.match(b.session.id, /^[0-9a-f-]{36}$/, 'non-UUID local id replaced');
  assert.equal(b.session.distance_km, 1.235);
  assert.equal(b.track_points?.length, 2, 'the weak fix goes up too; the server flags it');
  assert.equal(b.track_points?.[1].recorded_at, '2026-09-30T08:00:02Z');
  assert.equal(b.session.device_gps_accuracy_avg, 26.5);
  assert.equal(b.track?.coordinates[0][0], 10.18, 'GeoJSON order is lon, lat');
});

test('buildWalkBundle: nothing invented for an animal logged without estimates', () => {
  const b = buildWalkBundle({
    ...base,
    completeChecklist: false,
    detections: [det()],
    activeTrack: [],
    rawTrackPoints: [],
  });
  const o = b.observations[0];
  assert.equal(o.distance_from_path_m, null);
  assert.equal(o.distance_estimate_m, null);
  assert.equal(o.bearing_deg, null);
  assert.equal(o.body_condition_score, null);
  assert.equal(b.photos?.length, 0);
});

test('buildWalkBundle: estimates, tag, details and the single photo are carried', () => {
  const b = buildWalkBundle({
    ...base,
    completeChecklist: true,
    detections: [
      det({
        id: '11111111-2222-4333-8444-555555555555',
        distance_estimate_m: 10,
        bearing_deg: 90,
        perpendicular_distance_m: 9.7,
        animal_lat: 36.8,
        animal_lon: 10.1801,
        body_condition_score: 2,
        identifier: 'Ginger',
        notes: 'limping',
        ear_tip_or_notch: 'yes',
        photoUris: ['file:///a.jpg'],
      }),
    ],
    activeTrack: [],
    rawTrackPoints: [],
  });
  const o = b.observations[0];
  assert.equal(o.id, '11111111-2222-4333-8444-555555555555');
  assert.equal(o.distance_from_path_m, 9.7);
  assert.equal(o.bearing_deg, 90);
  assert.equal(o.body_condition_score, 2);
  assert.equal(o.notes, 'Tag: Ginger | limping');
  assert.equal(o.ear_tip_or_notch, 'yes');
  assert.notDeepEqual(o.location.coordinates, o.observer_location.coordinates);
  assert.equal(b.photos?.[0].angle, 'other');
  assert.equal(b.photos?.[0].observation_id, o.id);
});

test('buildWalkBundle: effort metadata and fake-GPS flags are sent', () => {
  const b = buildWalkBundle({
    ...base,
    completeChecklist: true,
    detections: [],
    activeTrack: [],
    rawTrackPoints: [
      {
        recorded_at: '2026-09-30T08:00:01Z',
        latitude: 36.8,
        longitude: 10.18,
        accuracy_m: 5,
        is_mock: true,
      },
      { recorded_at: '2026-09-30T08:00:02Z', latitude: 36.8, longitude: 10.18, accuracy_m: 5 },
    ],
    weather: 'rain',
    observers: 3,
    timeOfDay: 'morning',
  });
  assert.equal(b.session.weather, 'rain');
  assert.equal(b.session.number_of_observers, 3);
  assert.equal(b.session.time_of_day, 'morning');
  assert.equal(b.track_points?.[0].is_mock, true);
  assert.equal(b.track_points?.[1].is_mock, false);
});
