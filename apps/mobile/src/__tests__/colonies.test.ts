import test from 'node:test';
import assert from 'node:assert/strict';
import { useColoniesStore, INITIAL_COLONIES } from '../features/colonies/coloniesStore.ts';
import { useGamificationStore } from '../features/gamification/gamificationStore.ts';

test('coloniesStore: starts with clean empty state for authentic field monitoring', () => {
  assert.equal(INITIAL_COLONIES.length, 0, 'INITIAL_COLONIES should be empty by default');
  assert.equal(useColoniesStore.getState().colonies.length, 0, 'Store should start with 0 colonies');
});

test('coloniesStore: addColony registers a new cat colony with ID and awards XP', () => {
  const initialCount = useColoniesStore.getState().colonies.length;
  const initialXp = useGamificationStore.getState().xpTotal;

  useColoniesStore.getState().addColony({
    name: 'Colonie Test Testeur',
    species: 'cat',
    zone: 'Tunis Test',
    latitude: 36.8,
    longitude: 10.18,
    estimatedPopulation: 10,
    tnrSterilizedCount: 5,
    hasWaterStation: true,
    hasShelter: false,
  });

  const updatedColonies = useColoniesStore.getState().colonies;
  assert.equal(updatedColonies.length, initialCount + 1);

  const registered = updatedColonies[0];
  assert.equal(registered.name, 'Colonie Test Testeur');
  assert.equal(registered.species, 'cat');
  assert.ok(registered.id.startsWith('colony-'), 'Cat colony ID should start with colony-');
  assert.equal(registered.inspectionsCount, 1);

  // Check XP awarded (+20)
  assert.equal(useGamificationStore.getState().xpTotal, initialXp + 20);
});

test('coloniesStore: addColony registers a new dog pack with pack ID and awards XP', () => {
  const initialCount = useColoniesStore.getState().colonies.length;
  const initialXp = useGamificationStore.getState().xpTotal;

  useColoniesStore.getState().addColony({
    name: 'Meute Menzeh Test',
    nameAr: 'قطيع المنزه تجريبي',
    species: 'dog',
    zone: 'El Menzah',
    latitude: 36.83,
    longitude: 10.19,
    estimatedPopulation: 7,
    tnrSterilizedCount: 4,
    hasWaterStation: true,
    hasShelter: true,
  });

  const updatedColonies = useColoniesStore.getState().colonies;
  assert.equal(updatedColonies.length, initialCount + 1);

  const registered = updatedColonies[0];
  assert.equal(registered.name, 'Meute Menzeh Test');
  assert.equal(registered.species, 'dog');
  assert.ok(registered.id.startsWith('pack-'), 'Dog pack ID should start with pack-');

  // Check XP awarded (+20)
  assert.equal(useGamificationStore.getState().xpTotal, initialXp + 20);
});

test('coloniesStore: recordInspection increments inspections and awards +10 XP', () => {
  const initialXp = useGamificationStore.getState().xpTotal;
  const targetColony = useColoniesStore.getState().colonies[0];
  const initialInspections = targetColony.inspectionsCount;

  useColoniesStore.getState().recordInspection(targetColony.id, 'Water replenished and dogs calm');

  const refreshedColony = useColoniesStore.getState().getColonyById(targetColony.id);
  assert.ok(refreshedColony);
  assert.equal(refreshedColony.inspectionsCount, initialInspections + 1);
  assert.ok(refreshedColony.notes?.includes('Water replenished'));

  // Check XP awarded (+10)
  assert.equal(useGamificationStore.getState().xpTotal, initialXp + 10);
});
