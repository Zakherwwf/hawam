import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDb } from '../db/localDb.ts';
import { useSurveyStore } from '../features/survey/surveyStore.ts';

test('crashRecovery: ungraceful termination recovers session state, track, and sightings from SQLite', async () => {
  localDb.clearAllForTesting();
  const store = useSurveyStore.getState();
  store.resetSurvey();

  // Surveyor starts a transect in Sidi Bou Said
  store.startSurvey('transect', 'route-sidi-bou-said');
  assert.equal(useSurveyStore.getState().status, 'acquiring_fix');
  assert.ok(useSurveyStore.getState().sessionId);

  useSurveyStore.getState().setFixAcquired();
  assert.equal(useSurveyStore.getState().status, 'recording');

  // Add GPS fixes
  store.addTrackPoint(36.871, 10.341, 3.2, 1.2, false);
  store.addTrackPoint(36.872, 10.342, 3.5, 1.1, false);
  store.addTrackPoint(36.873, 10.343, 4.0, 1.3, false);

  // Log an animal sighting
  const logged = store.logDetection({
    species: 'cat',
    group_size: 1,
    distance_estimate_m: 8,
    bearing_deg: 120,
    body_condition_score: 4,
    notes: 'Calico resting near cafe',
    observer_lat: 36.872,
    observer_lon: 10.342,
    gps_accuracy_m: 3.5,
  });

  const liveStore = useSurveyStore.getState();
  assert.equal(liveStore.detections.length, 1);
  assert.ok(liveStore.distanceMeters > 0);
  const preKillSessionId = liveStore.sessionId;
  const preKillDistance = liveStore.distanceMeters;

  // SIMULATE APP CRASH / OS KILL (Memory wiped completely)
  useSurveyStore.setState({
    sessionId: null,
    status: 'idle',
    startedAt: null,
    elapsedSeconds: 0,
    movingTimeSeconds: 0,
    distanceMeters: 0,
    activeTrack: [],
    rawTrackPoints: [],
    detections: [],
  });

  assert.equal(useSurveyStore.getState().status, 'idle');
  assert.equal(useSurveyStore.getState().activeTrack.length, 0);
  assert.equal(useSurveyStore.getState().detections.length, 0);

  // Cold start relaunch: app invokes restoreDraft()
  const recovered = await useSurveyStore.getState().restoreDraft();
  assert.equal(recovered, true, 'Draft should be recovered from SQLite');

  const recoveredState = useSurveyStore.getState();
  assert.equal(recoveredState.status, 'paused', 'a recovered walk waits to be resumed');
  assert.equal(recoveredState.sessionId, preKillSessionId);
  assert.equal(recoveredState.selectedRouteId, 'route-sidi-bou-said');
  assert.equal(recoveredState.activeTrack.length, 3);
  assert.equal(recoveredState.detections.length, 1);
  assert.equal(recoveredState.detections[0].species, 'cat');
  assert.equal(recoveredState.detections[0].body_condition_score, 4);
  assert.equal(recoveredState.detections[0].notes, 'Calico resting near cafe');
});
