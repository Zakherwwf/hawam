#!/usr/bin/env node
/**
 * Loads worldwide reference polygons into PostGIS (migration 20260929000002):
 *   ref_countries  <- Natural Earth 1:10m admin-0 countries
 *   ref_admin1     <- Natural Earth 1:10m admin-1 states/provinces
 *   ref_timezones  <- timezone-boundary-builder full "with oceans" set (every IANA tzid)
 * then backfills country / admin1 / timezone on existing observations.
 *
 * Usage, either:
 *   DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres \
 *     node supabase/scripts/load_reference_geography.mjs          (psql, one transaction)
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> \
 *     node supabase/scripts/load_reference_geography.mjs          (Management API, batched)
 *
 * Needs `unzip` (and `psql` for the first form). Downloads (~110 MB) are cached
 * in supabase/.cache/geography and reused on later runs. Safe to re-run: the
 * tables are truncated and reloaded.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TZ_RELEASE = '2026d';
const SOURCES = {
  countries:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson',
  admin1:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson',
  timezones: `https://github.com/evansiroky/timezone-boundary-builder/releases/download/${TZ_RELEASE}/timezones-with-oceans.geojson.zip`,
};

const databaseUrl = process.env.DATABASE_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const viaApi = !databaseUrl && !!accessToken && !!projectRef;
if (!databaseUrl && !viaApi) {
  console.error('Set DATABASE_URL, or SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF.');
  process.exit(1);
}

const cacheDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'geography');
mkdirSync(cacheDir, { recursive: true });

async function download(name, url) {
  const file = join(cacheDir, url.split('/').pop());
  if (existsSync(file)) return file;
  console.info(`Downloading ${name}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

function readGeoJson(file) {
  const text = file.endsWith('.zip')
    ? execFileSync('unzip', ['-p', file], { maxBuffer: 1024 * 1024 * 1024 }).toString('utf8')
    : readFileSync(file, 'utf8');
  return JSON.parse(text).features;
}

const ISO2 = /^[A-Z]{2}$/;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

// 6 decimals is ~10 cm: far below the boundary data's own accuracy
const round6 = (c) =>
  Array.isArray(c[0]) ? c.map(round6) : c.map((v) => Math.round(v * 1e6) / 1e6);

// Douglas-Peucker on one ring (lon/lat degrees), keeping it closed and valid
function simplifyRing(ring, tolerance) {
  if (ring.length <= 8) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = px - (ax + t * dx);
      const ey = py - (ay + t * dy);
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolerance * tolerance) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

// The Management API rejects requests over ~3.5 MB. The few polygons above
// MAX_POLYGON_JSON are simplified, starting at ~20 m, until they fit; that is
// far finer than a country or timezone lookup needs.
const MAX_POLYGON_JSON = 2_500_000;
function fitPolygon(polygon) {
  let rings = round6(polygon);
  for (let tol = 0.0002; JSON.stringify(rings).length > MAX_POLYGON_JSON && tol < 1; tol *= 2) {
    rings = round6(polygon.map((ring) => simplifyRing(ring, tol)));
  }
  return rings;
}

// One statement per polygon of a MultiPolygon keeps each request small
function* parts(geometry) {
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      yield { type: 'Polygon', coordinates: fitPolygon(polygon) };
    }
  } else if (geometry.type === 'Polygon') {
    yield { type: 'Polygon', coordinates: fitPolygon(geometry.coordinates) };
  } else {
    yield geometry;
  }
}

// Valid polygons only, split into <=255-vertex pieces for fast lookups
const polygonsSql = (geometry) =>
  `(ST_Dump(ST_Subdivide(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($g$${JSON.stringify(
    geometry
  )}$g$), 4326)), 3), 255))).geom`;

function* statements(countries, admin1, timezones) {
  yield 'BEGIN;';
  yield 'TRUNCATE public.ref_countries, public.ref_admin1, public.ref_timezones;';

  for (const f of countries) {
    const p = f.properties;
    const iso = [p.ISO_A2, p.ISO_A2_EH].find((c) => ISO2.test(c ?? ''));
    if (!iso || !f.geometry) continue;
    for (const g of parts(f.geometry)) {
      yield `INSERT INTO public.ref_countries (iso_a2, name, geom) SELECT ${lit(iso)}, ${lit(p.NAME)}, ${polygonsSql(g)};`;
    }
  }

  for (const f of admin1) {
    const p = f.properties;
    if (!ISO2.test(p.iso_a2 ?? '') || !p.iso_3166_2 || !f.geometry) continue;
    for (const g of parts(f.geometry)) {
      yield `INSERT INTO public.ref_admin1 (code, iso_a2, name, geom) SELECT ${lit(p.iso_3166_2)}, ${lit(p.iso_a2)}, ${lit(p.name ?? p.iso_3166_2)}, ${polygonsSql(g)};`;
    }
  }

  for (const f of timezones) {
    if (!f.properties?.tzid || !f.geometry) continue;
    for (const g of parts(f.geometry)) {
      yield `INSERT INTO public.ref_timezones (tzid, geom) SELECT ${lit(f.properties.tzid)}, ${polygonsSql(g)};`;
    }
  }

  yield 'COMMIT;';
  yield 'ANALYZE public.ref_countries; ANALYZE public.ref_admin1; ANALYZE public.ref_timezones;';
  yield "SELECT 'backfilled observations: ' || public.backfill_observation_geography();";
  yield "SELECT 'countries ' || count(DISTINCT iso_a2) FROM public.ref_countries;";
  yield "SELECT 'admin1 ' || count(DISTINCT code) FROM public.ref_admin1;";
  yield "SELECT 'timezones ' || count(DISTINCT tzid) FROM public.ref_timezones;";
}

const [countries, admin1, timezones] = await Promise.all([
  download('countries', SOURCES.countries).then(readGeoJson),
  download('admin-1 regions', SOURCES.admin1).then(readGeoJson),
  download('timezones', SOURCES.timezones).then(readGeoJson),
]);
console.info(
  `Loading ${countries.length} countries, ${admin1.length} regions, ${timezones.length} timezones...`
);

if (viaApi) {
  // The Management API runs one request at a time, so there is no transaction
  // spanning the load; statements are sent in ~1 MB batches.
  const run = async (query, attempt = 1) => {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const body = await res.text();
    if (!res.ok) {
      if (attempt < 3 && res.status >= 500) return run(query, attempt + 1);
      throw new Error(`Management API ${res.status}: ${body.slice(0, 300)}`);
    }
    return JSON.parse(body);
  };

  const all = [...statements(countries, admin1, timezones)].filter(
    (sql) => sql !== 'BEGIN;' && sql !== 'COMMIT;'
  );
  const reports = all.filter((sql) => sql.startsWith('SELECT '));
  const work = all.filter((sql) => !sql.startsWith('SELECT '));
  let batch = [];
  let size = 0;
  let sent = 0;
  const flush = async () => {
    if (!batch.length) return;
    await run(batch.join('\n'));
    sent += batch.length;
    process.stdout.write(`\r  ${sent}/${work.length} statements`);
    batch = [];
    size = 0;
  };
  for (const sql of work) {
    if (size + sql.length > 1_000_000) await flush();
    batch.push(sql);
    size += sql.length;
  }
  await flush();
  process.stdout.write('\n');
  for (const sql of reports) console.info(Object.values((await run(sql))[0] ?? {})[0]);
} else {
  const psql = spawn('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A'], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((resolve, reject) =>
    psql.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`psql exited ${code}`))))
  );
  for (const sql of statements(countries, admin1, timezones)) {
    if (!psql.stdin.write(sql + '\n')) {
      await new Promise((r) => psql.stdin.once('drain', r));
    }
  }
  psql.stdin.end();
  await done;
}
console.info('Reference geography loaded.');
