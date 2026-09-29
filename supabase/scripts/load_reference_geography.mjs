#!/usr/bin/env node
/**
 * Loads worldwide reference polygons into PostGIS (migration 20260929000002):
 *   ref_countries  <- Natural Earth 1:10m admin-0 countries
 *   ref_admin1     <- Natural Earth 1:10m admin-1 states/provinces
 *   ref_timezones  <- timezone-boundary-builder full "with oceans" set (every IANA tzid)
 * then backfills country / admin1 / timezone on existing observations.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres \
 *     node supabase/scripts/load_reference_geography.mjs
 *
 * Needs `psql` and `unzip` on PATH. Downloads (~110 MB) are cached in
 * supabase/.cache/geography and reused on later runs. Safe to re-run: each
 * table is replaced inside one transaction.
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
if (!databaseUrl) {
  console.error('Set DATABASE_URL to the Postgres connection string.');
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
    yield `INSERT INTO public.ref_countries (iso_a2, name, geom) SELECT ${lit(iso)}, ${lit(p.NAME)}, ${polygonsSql(f.geometry)};`;
  }

  for (const f of admin1) {
    const p = f.properties;
    if (!ISO2.test(p.iso_a2 ?? '') || !p.iso_3166_2 || !f.geometry) continue;
    yield `INSERT INTO public.ref_admin1 (code, iso_a2, name, geom) SELECT ${lit(p.iso_3166_2)}, ${lit(p.iso_a2)}, ${lit(p.name ?? p.iso_3166_2)}, ${polygonsSql(f.geometry)};`;
  }

  for (const f of timezones) {
    if (!f.properties?.tzid || !f.geometry) continue;
    yield `INSERT INTO public.ref_timezones (tzid, geom) SELECT ${lit(f.properties.tzid)}, ${polygonsSql(f.geometry)};`;
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
console.info('Reference geography loaded.');
