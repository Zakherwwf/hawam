import test from 'node:test';
import assert from 'node:assert/strict';
import {
  useColoniesStore,
  INITIAL_COLONIES,
  type CatColony,
  type PendingVisit,
} from '../features/colonies/coloniesStore.ts';
import {
  colonyFromServer,
  colonyToServer,
  routeFromServer,
} from '../features/sync/serverMapping.ts';

const base = {
  name: 'Market cats',
  species: 'cat' as const,
  zone: 'Old town',
  latitude: 36.8,
  longitude: 10.18,
  estimatedPopulation: 10,
  tnrSterilizedCount: 5,
  hasWaterStation: true,
  hasShelter: false,
};

test('coloniesStore: starts empty', () => {
  assert.equal(INITIAL_COLONIES.length, 0);
  assert.equal(useColoniesStore.getState().colonies.length, 0);
});

test('coloniesStore: a new colony gets a UUID and waits to be uploaded', () => {
  const c = useColoniesStore.getState().addColony(base);
  assert.match(c.id, /^[0-9a-f-]{36}$/);
  assert.equal(c.synced, false);
  assert.equal(c.inspectionsCount, 0);
  assert.equal(useColoniesStore.getState().colonies[0].id, c.id);
});

test('coloniesStore: sync uploads colonies, then visits, then takes the shared list', async () => {
  useColoniesStore.setState({ colonies: [], pendingVisits: [] });
  const mine = useColoniesStore.getState().addColony(base);
  useColoniesStore.getState().recordInspection(mine.id, 'two kittens', ['food_ok']);
  const pushed: string[] = [];
  const visits: PendingVisit[] = [];
  const someoneElse: CatColony = {
    ...base,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Harbour dogs',
    species: 'dog',
    lastInspectedAt: '2026-09-29T08:00:00Z',
    inspectionsCount: 2,
    synced: true,
  };
  await useColoniesStore.getState().syncWithServer({
    userId: 'u1',
    push: async (c) => (pushed.push(c.id), true),
    pushVisit: async (v) => (visits.push(v), true),
    pull: async () => [{ ...mine, synced: true, inspectionsCount: 1 }, someoneElse],
  });
  const st = useColoniesStore.getState();
  assert.deepEqual(pushed, [mine.id]);
  assert.equal(visits.length, 1);
  assert.deepEqual(visits[0].tags, ['food_ok']);
  assert.equal(st.pendingVisits.length, 0);
  assert.equal(st.colonies.length, 2);
  assert.ok(st.colonies.every((c) => c.synced));
});

test('coloniesStore: offline, nothing is lost', async () => {
  useColoniesStore.setState({ colonies: [], pendingVisits: [] });
  const mine = useColoniesStore.getState().addColony(base);
  useColoniesStore.getState().recordInspection(mine.id, undefined, ['water_refilled']);
  await useColoniesStore.getState().syncWithServer({
    userId: 'u1',
    push: async () => false,
    pushVisit: async () => false,
    pull: async () => null,
  });
  const st = useColoniesStore.getState();
  assert.equal(st.colonies.length, 1);
  assert.equal(st.colonies[0].synced, false);
  assert.equal(st.pendingVisits.length, 1, 'visit kept for later');
});

test('serverMapping: colonies round-trip; location as EWKT lon lat', () => {
  const row = colonyToServer({ ...base, id: 'x', lastInspectedAt: '', inspectionsCount: 0 }, 'u1');
  assert.equal(row.location, 'SRID=4326;POINT(10.18 36.8)');
  assert.equal(row.type, 'cat_colony');
  const back = colonyFromServer({
    id: 'x',
    name: 'Market cats',
    species: 'cat',
    latitude: 36.8,
    longitude: 10.18,
    estimated_population: 10,
    sterilised_count: 5,
    has_water: true,
    has_shelter: false,
    caretaker_name: null,
    feeding_schedule: null,
    area: 'Old town',
    notes: null,
    created_by: 'u1',
    visit_count: 3,
    last_visit_at: '2026-09-30T08:00:00Z',
    created_at: '2026-09-01T08:00:00Z',
  });
  assert.equal(back.inspectionsCount, 3);
  assert.equal(back.zone, 'Old town');
  assert.equal(back.synced, true);
});

test('serverMapping: routes flip GeoJSON lon,lat to lat,lon and keep local adoption', () => {
  const r = routeFromServer(
    {
      id: 'r1',
      name: 'Harbour loop',
      governorate: 'North',
      delegation: 'Port',
      length_km: 1.234,
      geometry: {
        type: 'LineString',
        coordinates: [
          [10.18, 36.8],
          [10.19, 36.81],
        ],
      },
    },
    { isAdopted: true, timesSurveyed: 4 } as never
  );
  assert.ok(r);
  assert.deepEqual(r!.waypoints[0], [36.8, 10.18]);
  assert.equal(r!.isAdopted, true);
  assert.equal(r!.timesSurveyed, 4);
  assert.equal(r!.zone, 'Port, North');
  assert.equal(r!.distanceKm, 1.23);
  assert.equal(routeFromServer({ id: 'r2', name: 'x', geometry: null }), null);
});
