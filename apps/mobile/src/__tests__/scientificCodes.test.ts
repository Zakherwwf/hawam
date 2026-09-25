import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateScientificObservationCode,
  getNextSessionObservationCode,
  generateOpportunisticCode,
} from '../utils/scientificCodes.ts';

test('scientificCodes: generateScientificObservationCode formats correct species prefix and 3-digit padding', () => {
  assert.equal(generateScientificObservationCode('dog', 1), 'DOG-001');
  assert.equal(generateScientificObservationCode('dog', 14), 'DOG-014');
  assert.equal(generateScientificObservationCode('dog', 105), 'DOG-105');

  assert.equal(generateScientificObservationCode('cat', 1), 'CAT-001');
  assert.equal(generateScientificObservationCode('cat', 42), 'CAT-042');

  assert.equal(generateScientificObservationCode('unknown', 3), 'OBS-003');
});

test('scientificCodes: getNextSessionObservationCode increments based on session length', () => {
  const empty: Array<{ id: string; species: string }> = [];
  assert.equal(getNextSessionObservationCode('dog', empty), 'DOG-001');

  const one = [{ id: '1', species: 'cat' }];
  assert.equal(getNextSessionObservationCode('dog', one), 'DOG-002');

  const two = [{ id: '1', species: 'dog' }, { id: '2', species: 'cat' }];
  assert.equal(getNextSessionObservationCode('cat', two), 'CAT-003');
});

test('scientificCodes: generateOpportunisticCode creates structured date-based identifier', () => {
  const code = generateOpportunisticCode('dog', 5);
  assert.ok(code.startsWith('DOG-'));
  assert.ok(code.endsWith('-005'));
});
