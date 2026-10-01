import test from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../services/storageAdapter.ts';
import { useSyncStore, sanitizeBundleUuids, stableUuid } from '../features/sync/syncStore.ts';
import { localDb } from '../db/localDb.ts';
import { useSurveyStore } from '../features/survey/surveyStore.ts';
import type { SurveyBundlePayload } from '../services/supabase.ts';

test('surveyIntegrity: surveyStore initializes with clean state and records real startedAt', () => {
  const store = useSurveyStore.getState();
  store.resetSurvey();

  assert.equal(store.status, 'idle');
  assert.equal(store.distanceMeters, 0);
  assert.equal(store.detections.length, 0);

  store.startSurvey('transect', 'route-test-1');
  const active = useSurveyStore.getState();

  assert.equal(active.status, 'acquiring_fix');
  assert.equal(active.protocol, 'transect');
  assert.equal(active.selectedRouteId, 'route-test-1');
  assert.ok(active.startedAt, 'startedAt timestamp must be recorded');
});

test('surveyIntegrity: addTrackPoint filters out impossible vehicle speeds (>15 km/h) per CLAUDE.md §2.2', () => {
  const store = useSurveyStore.getState();
  store.resetSurvey();
  store.startSurvey('transect');
  useSurveyStore.setState({ status: 'recording' });

  // Point 1: starting position
  store.addTrackPoint(36.8, 10.18, 3.0, 1.2);
  const initialDistance = useSurveyStore.getState().distanceMeters;

  // Point 2: legitimate walking step (approx 5 meters at 1.2 m/s)
  store.addTrackPoint(36.80005, 10.18, 3.0, 1.2);
  const walkingDistance = useSurveyStore.getState().distanceMeters;
  assert.ok(walkingDistance > initialDistance, 'Valid walking speed should increase distance');

  // Point 3: impossible speed jump (e.g. car / teleport at 25 m/s = 90 km/h)
  store.addTrackPoint(36.82, 10.18, 5.0, 25.0);
  const afterVehicleJumpDistance = useSurveyStore.getState().distanceMeters;

  // The vehicle jump distance should NOT be added to distanceMeters
  assert.equal(
    afterVehicleJumpDistance,
    walkingDistance,
    'Speeds > 4.17 m/s (15 km/h) must be rejected from survey distance accumulation'
  );
});

test('surveyIntegrity: logDetection preserves Body Condition Score (1-5) and observer coordinates', () => {
  const store = useSurveyStore.getState();
  store.resetSurvey();
  store.startSurvey('transect');
  useSurveyStore.setState({
    status: 'recording',
    currentLocation: { lat: 36.85, lon: 10.2, accuracy: 2.5, heading: 90 },
  });

  const detection = store.logDetection({
    species: 'cat',
    group_size: 2,
    distance_estimate_m: 8.5,
    bearing_deg: 90,
    body_condition_score: 2, // Underweight
    notes: 'Ear tipped tabby cat near olive tree',
    observer_lat: 36.85,
    observer_lon: 10.2,
    gps_accuracy_m: 2.5,
  });

  assert.equal(detection.species, 'cat');
  assert.equal(detection.group_size, 2);
  assert.equal(detection.body_condition_score, 2, 'BCS must be stored accurately as 2');
  assert.equal(detection.observer_lat, 36.85);
  assert.equal(detection.observer_lon, 10.2);
  assert.equal(detection.bearing_deg, 90);
  assert.ok(detection.animal_lat !== 0, 'Animal coordinate must be computed');
});

test('surveyIntegrity: syncStore preserves cold-start items and handles outbox queue persistence', async () => {
  const sync = useSyncStore.getState();
  sync.clearOutbox();

  const mockColdBundle: SurveyBundlePayload = {
    session: {
      id: 'session-cold-1',
      protocol: 'transect',
      start_time: '2026-09-25T10:00:00Z',
      end_time: '2026-09-25T10:45:00Z',
      distance_km: 1.85,
      complete_session: true,
      number_of_observers: 1,
    },
    observations: [
      {
        id: 'obs-cold-1',
        observed_at: '2026-09-25T10:15:00Z',
        species: 'cat',
        group_size: 1,
        body_condition_score: 4,
        location: { type: 'Point', coordinates: [10.18, 36.8] },
      },
    ],
  };

  // Enqueue survey
  await sync.enqueueSurvey(mockColdBundle);
  assert.equal(useSyncStore.getState().outbox.length, 1);
  assert.equal(useSyncStore.getState().outbox[0].payload.session.id, 'session-cold-1');

  // Persisted in the single SQLite queue, never in a second AsyncStorage copy
  const rows = await localDb.getAllOutbox();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sessionId, 'session-cold-1');
  assert.equal(await storage.getItem('hawem_outbox_v2'), null);

  // Simulate cold boot: clear in-memory state and reload from storage
  useSyncStore.setState({ outbox: [], pendingCount: 0 });
  assert.equal(useSyncStore.getState().outbox.length, 0);

  await useSyncStore.getState().loadOutbox();
  assert.equal(useSyncStore.getState().outbox.length, 1);
  assert.equal(useSyncStore.getState().outbox[0].payload.session.id, 'session-cold-1');
});

test('surveyIntegrity: sanitizeBundleUuids converts legacy timestamp IDs to compliant UUIDs', () => {
  const legacyBundle: SurveyBundlePayload = {
    session: {
      id: 'incidental-sess-1790280000000',
      start_time: '2026-09-26T00:00:00.000Z',
    },
    observations: [
      {
        id: 'sighting-1790280000000',
        observed_at: '2026-09-26T00:00:00.000Z',
        species: 'dog',
        location: { type: 'Point', coordinates: [10.18, 36.8] },
      },
    ],
    photos: [
      {
        id: 'photo-sighting-1790280000000-0',
        observation_id: 'sighting-1790280000000',
        storage_path: 'file:///path/to/img.jpg',
        angle: 'left_flank',
        taken_at: '2026-09-26T00:00:00.000Z',
      },
    ],
  };

  const sanitized = sanitizeBundleUuids(legacyBundle);
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  assert.match(sanitized.session.id, UUID_REGEX);
  assert.match(sanitized.observations[0].id, UUID_REGEX);
  assert.match(sanitized.photos![0].id, UUID_REGEX);
  assert.equal(sanitized.photos![0].observation_id, sanitized.observations[0].id);

  // Verify location sanitization for remote generalize_point function
  assert.equal(sanitized.observations[0].location.latitude, 36.8);
  assert.equal(sanitized.observations[0].location.longitude, 10.18);
  assert.equal(sanitized.observations[0].location.type, 'Point');
  assert.deepEqual(sanitized.observations[0].location.coordinates, [10.18, 36.8]);
  assert.ok(sanitized.observations[0].observer_location, 'observer_location must be present');
  assert.equal(sanitized.observations[0].observer_location?.latitude, 36.8);
  assert.equal(sanitized.observations[0].observer_location?.longitude, 10.18);
});

test('surveyIntegrity: a legacy record keeps the same ids on every retry', () => {
  const legacy: SurveyBundlePayload = {
    session: { id: 'incidental-sess-1790280000000', start_time: '2026-09-26T00:00:00.000Z' },
    observations: [
      {
        id: 'sighting-1790280000000',
        observed_at: '2026-09-26T00:00:00.000Z',
        species: 'cat',
        location: { type: 'Point', coordinates: [10.18, 36.8] },
      },
    ],
    photos: [
      {
        id: 'photo-1',
        observation_id: 'sighting-1790280000000',
        storage_path: 'file:///a.jpg',
        angle: 'other',
        taken_at: '2026-09-26T00:00:00.000Z',
      },
    ],
  };
  const a = sanitizeBundleUuids(legacy);
  const b = sanitizeBundleUuids(legacy);
  assert.equal(a.session.id, b.session.id);
  assert.equal(a.observations[0].id, b.observations[0].id);
  assert.equal(a.photos![0].id, b.photos![0].id);
  assert.notEqual(stableUuid('x'), stableUuid('y'));
});

test('surveyIntegrity: an old AsyncStorage queue is moved once, not copied back each launch', async () => {
  useSyncStore.getState().clearOutbox();
  const item = {
    id: 'outbox-old-1',
    payload: { session: { id: 'old-1', start_time: '2026-09-25T10:00:00Z' } },
    created_at: '2026-09-25T10:00:00Z',
    status: 'pending',
    attempts: 0,
  };
  await storage.setItem('hawem_outbox_v2', JSON.stringify([item]));
  await useSyncStore.getState().loadOutbox();
  assert.equal(useSyncStore.getState().outbox.length, 1);
  assert.equal(await storage.getItem('hawem_outbox_v2'), null, 'legacy copy removed');

  // Uploaded (removed from SQLite): the next launch must not bring it back
  await localDb.removeOutboxItem('outbox-old-1');
  await useSyncStore.getState().loadOutbox();
  assert.equal(useSyncStore.getState().outbox.length, 0);
});
