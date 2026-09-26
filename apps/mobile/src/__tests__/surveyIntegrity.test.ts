import test from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../services/storageAdapter.ts';
import { useSyncStore, sanitizeBundleUuids } from '../features/sync/syncStore.ts';
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
  store.addTrackPoint(36.8000, 10.1800, 3.0, 1.2);
  const initialDistance = useSurveyStore.getState().distanceMeters;

  // Point 2: legitimate walking step (approx 5 meters at 1.2 m/s)
  store.addTrackPoint(36.80005, 10.1800, 3.0, 1.2);
  const walkingDistance = useSurveyStore.getState().distanceMeters;
  assert.ok(walkingDistance > initialDistance, 'Valid walking speed should increase distance');

  // Point 3: impossible speed jump (e.g. car / teleport at 25 m/s = 90 km/h)
  store.addTrackPoint(36.8200, 10.1800, 5.0, 25.0);
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
    currentLocation: { lat: 36.8500, lon: 10.2000, accuracy: 2.5, heading: 90 },
  });

  const detection = store.logDetection({
    species: 'cat',
    group_size: 2,
    distance_estimate_m: 8.5,
    bearing_deg: 90,
    body_condition_score: 2, // Underweight
    notes: 'Ear tipped tabby cat near olive tree',
    observer_lat: 36.8500,
    observer_lon: 10.2000,
    gps_accuracy_m: 2.5,
  });

  assert.equal(detection.species, 'cat');
  assert.equal(detection.group_size, 2);
  assert.equal(detection.body_condition_score, 2, 'BCS must be stored accurately as 2');
  assert.equal(detection.observer_lat, 36.8500);
  assert.equal(detection.observer_lon, 10.2000);
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
        location: { type: 'Point', coordinates: [10.18, 36.80] },
      },
    ],
  };

  // Enqueue survey
  await sync.enqueueSurvey(mockColdBundle);
  assert.equal(useSyncStore.getState().outbox.length, 1);
  assert.equal(useSyncStore.getState().outbox[0].payload.session.id, 'session-cold-1');

  // Verify persistence in AsyncStorage
  const raw = await storage.getItem('hawem_outbox_v2');
  assert.ok(raw, 'Outbox must be saved to storage');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].payload.session.id, 'session-cold-1');

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
        location: { type: 'Point', coordinates: [10.18, 36.80] },
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
});

