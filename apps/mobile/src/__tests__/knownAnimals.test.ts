import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkPayload,
  missingFlank,
  nearbyAnimals,
  type KnownAnimal,
} from '../features/animals/knownAnimals.ts';

const animal = (id: string, over: Partial<KnownAnimal> = {}): KnownAnimal => ({
  id,
  species: 'cat',
  nickname: id,
  coatPattern: null,
  latitude: 36.8,
  longitude: 10.18,
  photoPath: null,
  hasLeftFlank: false,
  hasRightFlank: false,
  sightings: 1,
  lastSeen: null,
  createdBy: null,
  ...over,
});

test('nearbyAnimals: same species, within the radius, nearest first', () => {
  const list = [
    animal('far', { latitude: 36.81 }),
    animal('near', { latitude: 36.8005 }),
    animal('here'),
    animal('dog', { species: 'dog' }),
    animal('nowhere', { latitude: null }),
  ];
  assert.deepEqual(
    nearbyAnimals(list, 'cat', 36.8, 10.18).map((a) => a.id),
    ['here', 'near']
  );
});

test('missingFlank: asks for the side not yet photographed', () => {
  assert.equal(missingFlank({ hasLeftFlank: false, hasRightFlank: true }), 'left_flank');
  assert.equal(missingFlank({ hasLeftFlank: true, hasRightFlank: false }), 'right_flank');
  assert.equal(missingFlank({ hasLeftFlank: true, hasRightFlank: true }), null);
});

test('linkPayload: new animal, resighting, or nothing', () => {
  assert.equal(linkPayload({ kind: 'none' }), undefined);
  assert.deepEqual(linkPayload({ kind: 'same', id: 'x', decision: 'unsure' }), {
    id: 'x',
    decision: 'unsure',
  });
  assert.deepEqual(
    linkPayload({ kind: 'new', id: 'y', nickname: ' Ginger ', coatPattern: 'tabby' }),
    { id: 'y', new: true, nickname: 'Ginger', coat_pattern: 'tabby' }
  );
});
