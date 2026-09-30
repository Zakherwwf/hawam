import test from 'node:test';
import assert from 'node:assert/strict';
import { useRoutesStore, INITIAL_FIXED_ROUTES } from '../features/routes/routesStore.ts';
import { SAMPLE_ROUTES } from './fixtures/sampleRoutes.ts';

// The app ships with no routes; these tests run against sample ones
useRoutesStore.setState({ routes: SAMPLE_ROUTES.map((r) => ({ ...r })) });
import { useGamificationStore } from '../features/gamification/gamificationStore.ts';

test('routesStore: the app ships with no built-in routes', () => {
  assert.equal(INITIAL_FIXED_ROUTES.length, 0);
});

test('routesStore: sample routes have valid trajectories', () => {
  for (const route of SAMPLE_ROUTES) {
    assert.ok(route.id, 'Route must have an id');
    assert.ok(route.name, 'Route must have an English name');
    assert.ok(route.nameAr, 'Route must have an Arabic name');
    assert.ok(route.zone, 'Route must have a zone');
    assert.ok(route.distanceKm > 0, 'Distance must be > 0');
    assert.ok(route.targetPaceKmH > 0, 'Target pace must be > 0');
    assert.ok(route.waypoints.length >= 4, 'Waypoints must have at least 4 coordinates');
    for (const [lat, lon] of route.waypoints) {
      assert.ok(lat >= 36.7 && lat <= 37.0, `Latitude ${lat} must be within Greater Tunis`);
      assert.ok(lon >= 10.1 && lon <= 10.4, `Longitude ${lon} must be within Greater Tunis`);
    }
  }
});

test('routesStore: toggleAdoptRoute toggles adoption status and awards XP when adopting', () => {
  const store = useRoutesStore.getState();
  const gamificationStore = useGamificationStore.getState();

  // Find unadopted route
  const targetRoute = store.routes.find((r) => !r.isAdopted);
  assert.ok(targetRoute, 'Should have at least one unadopted route');
  const routeId = targetRoute.id;

  const xpBefore = gamificationStore.xpTotal;

  // Adopt route
  store.toggleAdoptRoute(routeId);
  const adoptedRoute = useRoutesStore.getState().routes.find((r) => r.id === routeId);
  assert.equal(adoptedRoute?.isAdopted, true, 'Route should now be adopted');
  assert.equal(
    useGamificationStore.getState().xpTotal,
    xpBefore + 30,
    'Should award +30 XP for adopting a route'
  );

  // Un-adopt route
  store.toggleAdoptRoute(routeId);
  const unadoptedRoute = useRoutesStore.getState().routes.find((r) => r.id === routeId);
  assert.equal(unadoptedRoute?.isAdopted, false, 'Route should now be un-adopted');
});

test('routesStore: checkOffRoute identifies on-route and off-route surveyor positions', () => {
  const store = useRoutesStore.getState();
  const bourguibaRoute = store.routes.find((r) => r.id === 'route-bourguiba-02');
  assert.ok(bourguibaRoute, 'Avenue Habib Bourguiba transect must exist');

  // Exact first waypoint: [36.8005, 10.1798]
  const onRouteCheck = store.checkOffRoute(36.8005, 10.1798, 'route-bourguiba-02');
  assert.equal(onRouteCheck.isOffRoute, false, 'Exact waypoint must not be off route');
  assert.ok(onRouteCheck.distanceM < 10, 'Distance to waypoint should be near 0m');

  // Coordinate far away in Ariana: [36.8665, 10.1950] (> 7km away)
  const offRouteCheck = store.checkOffRoute(36.8665, 10.195, 'route-bourguiba-02');
  assert.equal(offRouteCheck.isOffRoute, true, 'Far away coordinate must be flagged as off route');
  assert.ok(offRouteCheck.distanceM > 50, 'Distance must exceed 50m corridor threshold');
});

test('routesStore: recordSurveyCompletion increments count and updates timestamp', () => {
  const store = useRoutesStore.getState();
  const route = store.routes[0];
  const initialSurveyCount = route.timesSurveyed;

  store.recordSurveyCompletion(route.id);

  const updatedRoute = useRoutesStore.getState().routes.find((r) => r.id === route.id);
  assert.ok(updatedRoute);
  assert.equal(
    updatedRoute.timesSurveyed,
    initialSurveyCount + 1,
    'Survey count must increment by 1'
  );
  assert.ok(updatedRoute.lastSurveyedAt, 'lastSurveyedAt timestamp must be recorded');
});
