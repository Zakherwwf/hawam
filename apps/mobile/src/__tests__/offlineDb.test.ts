import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDb } from '../db/localDb.ts';

test('localDb: session insertion, metrics update, and unfinished query', async () => {
  localDb.clearAllForTesting();

  const sessionId = 'test-session-001';
  await localDb.insertSession({
    id: sessionId,
    protocol: 'transect',
    routeId: 'route-marsa',
    startedAt: '2026-09-25T10:00:00.000Z',
    createdAt: '2026-09-25T10:00:00.000Z',
    status: 'active',
  });

  let unfinished = await localDb.getUnfinishedSession();
  assert.ok(unfinished);
  assert.equal(unfinished.id, sessionId);
  assert.equal(unfinished.status, 'active');
  assert.equal(unfinished.routeId, 'route-marsa');

  // Update metrics
  await localDb.updateSessionMetrics(sessionId, 15.5, 1.25);
  await localDb.updateSessionStatus(sessionId, 'paused');

  unfinished = await localDb.getUnfinishedSession();
  assert.ok(unfinished);
  assert.equal(unfinished.status, 'paused');
  assert.equal(unfinished.durationMin, 15.5);
  assert.equal(unfinished.distanceKm, 1.25);

  // Finish session
  await localDb.updateSessionStatus(sessionId, 'finished', '2026-09-25T10:30:00.000Z');
  unfinished = await localDb.getUnfinishedSession();
  assert.equal(unfinished, null);
});

test('localDb: track points insertion preserves accuracy, speed, and mocked flag', async () => {
  localDb.clearAllForTesting();

  const sessionId = 'test-session-002';
  await localDb.insertTrackPoint({
    id: 'tp-1',
    sessionId,
    latitude: 36.878,
    longitude: 10.324,
    accuracyM: 4.2,
    speedMps: 1.2,
    mocked: false,
    recordedAt: '2026-09-25T10:01:00.000Z',
  });

  await localDb.insertTrackPoint({
    id: 'tp-2',
    sessionId,
    latitude: 36.879,
    longitude: 10.325,
    accuracyM: 6.8,
    speedMps: 5.5,
    mocked: true,
    rejectedReason: 'speed_exceeded_15kmh',
    recordedAt: '2026-09-25T10:02:00.000Z',
  });

  const points = await localDb.getTrackPointsBySession(sessionId);
  assert.equal(points.length, 2);
  assert.equal(points[0].latitude, 36.878);
  assert.equal(points[0].mocked, false);
  assert.equal(points[1].mocked, true);
  assert.equal(points[1].rejectedReason, 'speed_exceeded_15kmh');
});

test('localDb: observations CRUD stores biological fields and BCS', async () => {
  localDb.clearAllForTesting();

  const sessionId = 'test-session-003';
  await localDb.insertObservation({
    id: 'obs-1',
    sessionId,
    observedAt: '2026-09-25T10:05:00.000Z',
    observerLat: 36.878,
    observerLon: 10.324,
    animalLat: 36.8785,
    animalLon: 10.3245,
    gpsAccuracyM: 3.5,
    bearingDeg: 45,
    distanceEstimateM: 15,
    species: 'dog',
    groupSize: 2,
    bodyConditionScore: 3,
    healthIssuesJson: JSON.stringify(['skin_lesion']),
    notes: 'Resting near olive tree',
  });

  let obsList = await localDb.getObservationsBySession(sessionId);
  assert.equal(obsList.length, 1);
  assert.equal(obsList[0].species, 'dog');
  assert.equal(obsList[0].groupSize, 2);
  assert.equal(obsList[0].bodyConditionScore, 3);
  assert.equal(obsList[0].notes, 'Resting near olive tree');

  // Delete
  await localDb.deleteObservation('obs-1', sessionId);
  obsList = await localDb.getObservationsBySession(sessionId);
  assert.equal(obsList.length, 0);
});

test('localDb: transactional outbox queue with status and backoff', async () => {
  localDb.clearAllForTesting();

  const outboxId = 'outbox-session-100';
  await localDb.enqueueOutbox({
    id: outboxId,
    sessionId: 'session-100',
    payloadJson: JSON.stringify({ session: { id: 'session-100' } }),
    createdAt: new Date().toISOString(),
    status: 'pending',
  });

  let pending = await localDb.getPendingOutbox();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, outboxId);

  // Set backoff into the future
  const futureIso = new Date(Date.now() + 60000).toISOString();
  await localDb.updateOutboxStatus(outboxId, 'failed', 1, 'Network timeout', futureIso);

  pending = await localDb.getPendingOutbox();
  assert.equal(pending.length, 0, 'Should not return items under active backoff');

  // Set backoff in the past
  const pastIso = new Date(Date.now() - 1000).toISOString();
  await localDb.updateOutboxStatus(outboxId, 'failed', 1, 'Network timeout', pastIso);

  pending = await localDb.getPendingOutbox();
  assert.equal(pending.length, 1, 'Should return item once backoff expires');

  // Mark synced
  await localDb.updateOutboxStatus(outboxId, 'synced', 2);
  pending = await localDb.getPendingOutbox();
  assert.equal(pending.length, 0);
});
