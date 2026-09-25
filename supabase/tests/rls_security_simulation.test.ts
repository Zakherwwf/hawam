import test from 'node:test';
import assert from 'node:assert/strict';

// Roles definition matching schema
type UserRole = 'volunteer' | 'trained_surveyor' | 'researcher' | 'admin' | 'anonymous';

interface SecurityContext {
  userId: string | null;
  role: UserRole;
}

interface ObservationRecord {
  id: string;
  observer_id: string;
  location_public: { lon: number; lat: number };
  grid_cell_id: string;
  species: 'cat' | 'dog' | 'unknown';
}

interface RestrictedLocationRecord {
  observation_id: string;
  location_precise: { lon: number; lat: number };
  gps_accuracy_m: number;
}

interface RouteRecord {
  id: string;
  name: string;
  is_active: boolean;
}

/**
 * Evaluates RLS policy on public.routes:
 * CREATE POLICY "Allow public read on routes"
 * ON public.routes FOR SELECT TO anon, authenticated
 * USING (is_active = true);
 */
function evaluateRoutesRLS(ctx: SecurityContext, routes: RouteRecord[]): RouteRecord[] {
  // Both anon and authenticated can read active routes
  return routes.filter((r) => r.is_active);
}

/**
 * Evaluates RLS policy on public.observations:
 * Generalized observations are accessible to authenticated users only.
 * Anonymous users must query the aggregated get_public_density_map function.
 */
function evaluateObservationsRLS(ctx: SecurityContext, observations: ObservationRecord[]): ObservationRecord[] {
  if (ctx.role === 'anonymous') {
    return [];
  }
  return observations;
}

/**
 * Exact implementation of the PostgreSQL Row Level Security (RLS) policies:
 *
 * CREATE POLICY "Strict researcher select on precise locations"
 * ON public.observation_locations_restricted
 * FOR SELECT TO authenticated
 * USING (current_user_role() IN ('researcher', 'admin'));
 */
function evaluateRestrictedLocationRLS(
  ctx: SecurityContext,
  data: RestrictedLocationRecord[]
): RestrictedLocationRecord[] {
  // If not authenticated or not researcher/admin, RLS returns empty set
  if (!ctx.userId || (ctx.role !== 'researcher' && ctx.role !== 'admin')) {
    return [];
  }
  return data;
}

/**
 * Implementation of public density map k-anonymity aggregation:
 * HAVING COUNT(*) >= min_count_threshold
 */
function getPublicDensityMap(
  observations: ObservationRecord[],
  minCountThreshold = 3
): { grid_cell_id: string; count: number; centroid: { lon: number; lat: number } }[] {
  const cellGroups = new Map<string, ObservationRecord[]>();
  for (const obs of observations) {
    if (!cellGroups.has(obs.grid_cell_id)) {
      cellGroups.set(obs.grid_cell_id, []);
    }
    cellGroups.get(obs.grid_cell_id)!.push(obs);
  }

  const results: { grid_cell_id: string; count: number; centroid: { lon: number; lat: number } }[] = [];
  for (const [cellId, items] of cellGroups.entries()) {
    // K-Anonymity privacy filter: cells with fewer sightings than threshold are SUPPRESSED
    if (items.length >= minCountThreshold) {
      const avgLon = items.reduce((sum, i) => sum + i.location_public.lon, 0) / items.length;
      const avgLat = items.reduce((sum, i) => sum + i.location_public.lat, 0) / items.length;
      results.push({
        grid_cell_id: cellId,
        count: items.length,
        centroid: { lon: Number(avgLon.toFixed(5)), lat: Number(avgLat.toFixed(5)) },
      });
    }
  }
  return results;
}

test('RLS Policy: Volunteer and Trained Surveyor CANNOT access precise locations', () => {
  const secretCoords: RestrictedLocationRecord[] = [
    {
      observation_id: 'obs-tunis-01',
      location_precise: { lon: 10.1812345, lat: 36.8012345 },
      gps_accuracy_m: 3.2,
    },
  ];

  // 1. Volunteer attempt
  const volunteerCtx: SecurityContext = { userId: 'usr-vol-1', role: 'volunteer' };
  const volunteerResults = evaluateRestrictedLocationRLS(volunteerCtx, secretCoords);
  assert.equal(volunteerResults.length, 0, 'Volunteer MUST receive 0 rows from restricted locations table');

  // 2. Trained Surveyor attempt
  const surveyorCtx: SecurityContext = { userId: 'usr-surv-1', role: 'trained_surveyor' };
  const surveyorResults = evaluateRestrictedLocationRLS(surveyorCtx, secretCoords);
  assert.equal(surveyorResults.length, 0, 'Trained surveyor MUST receive 0 rows from restricted locations table');

  // 3. Anonymous unauthenticated attempt
  const anonCtx: SecurityContext = { userId: null, role: 'anonymous' };
  const anonResults = evaluateRestrictedLocationRLS(anonCtx, secretCoords);
  assert.equal(anonResults.length, 0, 'Anonymous users MUST receive 0 rows from restricted locations table');
});

test('RLS Policy: Certified Researcher and Admin ARE authorized to access research data', () => {
  const secretCoords: RestrictedLocationRecord[] = [
    {
      observation_id: 'obs-tunis-01',
      location_precise: { lon: 10.1812345, lat: 36.8012345 },
      gps_accuracy_m: 3.2,
    },
  ];

  // 1. Researcher access
  const researcherCtx: SecurityContext = { userId: 'usr-res-1', role: 'researcher' };
  const researcherResults = evaluateRestrictedLocationRLS(researcherCtx, secretCoords);
  assert.equal(researcherResults.length, 1);
  assert.equal(researcherResults[0].location_precise.lat, 36.8012345);

  // 2. Admin access
  const adminCtx: SecurityContext = { userId: 'usr-admin-1', role: 'admin' };
  const adminResults = evaluateRestrictedLocationRLS(adminCtx, secretCoords);
  assert.equal(adminResults.length, 1);
});

test('Public Density Map suppresses cells below k-anonymity threshold to prevent animal culling', () => {
  const observations: ObservationRecord[] = [
    // Cell A has 4 observations (>= threshold 3)
    { id: '1', observer_id: 'u1', location_public: { lon: 10.18, lat: 36.80 }, grid_cell_id: 'CELL-A', species: 'cat' },
    { id: '2', observer_id: 'u1', location_public: { lon: 10.18, lat: 36.80 }, grid_cell_id: 'CELL-A', species: 'cat' },
    { id: '3', observer_id: 'u2', location_public: { lon: 10.18, lat: 36.80 }, grid_cell_id: 'CELL-A', species: 'dog' },
    { id: '4', observer_id: 'u3', location_public: { lon: 10.18, lat: 36.80 }, grid_cell_id: 'CELL-A', species: 'dog' },

    // Cell B has only 1 isolated animal (< threshold 3) - MUST BE SUPPRESSED
    { id: '5', observer_id: 'u4', location_public: { lon: 10.25, lat: 36.85 }, grid_cell_id: 'CELL-B-ISOLATED', species: 'dog' },
  ];

  const mapData = getPublicDensityMap(observations, 3);

  // Should only contain CELL-A, CELL-B must be omitted
  assert.equal(mapData.length, 1);
  assert.equal(mapData[0].grid_cell_id, 'CELL-A');
  assert.equal(mapData[0].count, 4);

  const isolatedCell = mapData.find((c) => c.grid_cell_id === 'CELL-B-ISOLATED');
  assert.equal(isolatedCell, undefined, 'Isolated sighting cell must NOT appear on public map');
});

test('RLS Policy: Anonymous and unauthenticated visitors CAN read active routes but NOT raw observations', () => {
  const routes: RouteRecord[] = [
    { id: 'route-1', name: 'Medina Bab Souika', is_active: true },
    { id: 'route-2-inactive', name: 'Archived Route', is_active: false },
  ];
  const observations: ObservationRecord[] = [
    {
      id: 'obs-1',
      observer_id: 'u1',
      location_public: { lon: 10.18, lat: 36.80 },
      grid_cell_id: 'C1',
      species: 'cat',
    },
  ];

  const anonCtx: SecurityContext = { userId: null, role: 'anonymous' };
  const authCtx: SecurityContext = { userId: 'u2', role: 'volunteer' };

  // 1. Can view active routes, cannot view inactive routes
  const accessibleRoutes = evaluateRoutesRLS(anonCtx, routes);
  assert.equal(accessibleRoutes.length, 1);
  assert.equal(accessibleRoutes[0].id, 'route-1');

  // 2. Anonymous is blocked from raw observations (must use aggregated density map per CLAUDE.md §4.3)
  const anonObs = evaluateObservationsRLS(anonCtx, observations);
  assert.equal(anonObs.length, 0, 'Anonymous users cannot query raw observation records');

  // 3. Authenticated surveyors can view generalized observations
  const authObs = evaluateObservationsRLS(authCtx, observations);
  assert.equal(authObs.length, 1);
  assert.equal(authObs[0].id, 'obs-1');
});

