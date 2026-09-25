import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDb } from '../db/localDb.ts';
import { computeBackoffMs, processOutboxNow, type NetworkConnectionState } from '../services/sync/outboxWorker.ts';

test('outboxWorker: computeBackoffMs calculates monotonic exponential backoff with upper cap', () => {
  const b0 = computeBackoffMs(0, 1000, 300000);
  const b1 = computeBackoffMs(1, 1000, 300000);
  const b2 = computeBackoffMs(2, 1000, 300000);
  const b10 = computeBackoffMs(10, 1000, 300000);

  assert.ok(b0 >= 1000, 'Attempt 0 should be at least base 1000ms');
  assert.ok(b1 >= 2000, 'Attempt 1 should be at least 2000ms');
  assert.ok(b2 >= 4000, 'Attempt 2 should be at least 4000ms');
  assert.ok(b10 <= 300000, 'Attempt 10 should not exceed 300000ms cap');
});

test('outboxWorker: skips sync when offline or internet unreachable', async () => {
  localDb.clearAllForTesting();

  await localDb.enqueueOutbox({
    id: 'outbox-offline-test',
    sessionId: 'session-offline',
    payloadJson: JSON.stringify({ session: { id: 'session-offline' } }),
    createdAt: new Date().toISOString(),
    status: 'pending',
  });

  const offlineState: NetworkConnectionState = {
    type: 'none',
    isConnected: false,
    isInternetReachable: false,
    details: null,
  };

  const result = await processOutboxNow({ forcedNetState: offlineState });
  assert.equal(result.processed, 0, 'Should not process when offline');

  const pending = await localDb.getPendingOutbox();
  assert.equal(pending.length, 1, 'Item should remain pending in SQLite');
});

test('outboxWorker: skips sync when wifiOnly is enabled on cellular network', async () => {
  localDb.clearAllForTesting();

  await localDb.enqueueOutbox({
    id: 'outbox-cellular-test',
    sessionId: 'session-cellular',
    payloadJson: JSON.stringify({ session: { id: 'session-cellular' } }),
    createdAt: new Date().toISOString(),
    status: 'pending',
  });

  const cellularState: NetworkConnectionState = {
    type: 'cellular',
    isConnected: true,
    isInternetReachable: true,
    details: null,
  };

  const result = await processOutboxNow({
    wifiOnly: true,
    forcedNetState: cellularState,
  });

  assert.equal(result.processed, 0, 'Should skip processing when wifiOnly is true and connection is cellular');
  const pending = await localDb.getPendingOutbox();
  assert.equal(pending.length, 1);
});
