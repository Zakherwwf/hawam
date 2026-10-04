/**
 * Security invariants read from the real migrations (replaces the former
 * rls_security_simulation test, which re-implemented the policies in
 * TypeScript and so could pass while the database did something else).
 *
 * These are static checks on the SQL that ships: every table has RLS,
 * nothing is granted to anon, privileged functions pin search_path, exact
 * locations are owner-or-researcher, effort and consent are locked. The
 * behaviour of the policies against real rows is tested by
 * tests/*.behaviour.sql (run_sql_behaviour.sh replays every migration on a
 * throwaway PostGIS container).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.cwd(), 'migrations');
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const sql = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
// Comments out, so prose about a rule cannot satisfy or break a check
const code = sql.replace(/--[^\n]*/g, '');

/** The last definition of each function, by name. */
function lastFunction(name: string): string {
  const re = new RegExp(
    `create (?:or replace )?function public\\.${name}\\b[\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$`,
    'gi'
  );
  const all = code.match(re);
  assert.ok(all?.length, `function ${name} is defined`);
  return all![all!.length - 1];
}

/** Effective policies per table after drops and re-creates, in migration order. */
function policies(): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  const re =
    /(drop policy if exists ("?[\w :]+"?) on (?:public|storage)\.(\w+)\s*;)|(create policy ("?[\w :]+"?)\s+on (?:public|storage)\.(\w+)\s+([\s\S]*?);)/gi;
  for (const m of code.matchAll(re)) {
    if (m[1]) out.get(m[3])?.delete(m[2].replace(/"/g, ''));
    else {
      if (!out.has(m[6])) out.set(m[6], new Map());
      out.get(m[6])!.set(m[5].replace(/"/g, ''), m[7].replace(/\s+/g, ' '));
    }
  }
  return out;
}

test('every table has row-level security enabled', () => {
  const tables = new Set(
    [...code.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1])
  );
  const rls = new Set(
    [
      ...code.matchAll(/alter table (?:if exists )?public\.(\w+)\s+enable row level security/gi),
    ].map((m) => m[1])
  );
  const missing = [...tables].filter((t) => !rls.has(t));
  assert.deepEqual(missing, [], `tables without RLS: ${missing.join(', ')}`);
});

test('nothing is granted to anon or public', () => {
  const grants = [...code.matchAll(/grant [^;]+ to ([^;]+);/gi)].filter((m) =>
    /\b(anon|public)\b/i.test(m[1])
  );
  assert.deepEqual(
    grants.map((g) => g[0].replace(/\s+/g, ' ')),
    []
  );
});

test('every security definer function pins its search_path', () => {
  const fns = code.match(/create (?:or replace )?function [\s\S]*?\$\$/gi) ?? [];
  const bad = fns
    .filter((f) => /security definer/i.test(f) && !/set search_path/i.test(f))
    .map((f) => f.match(/function ([\w.]+)/i)?.[1]);
  assert.deepEqual(bad, []);
});

test('exact locations: the location gate is researcher-only, not "any signed-in user"', () => {
  const gate = lastFunction('can_read_precise_locations');
  assert.match(gate, /is_researcher\(\)/);
  assert.doesNotMatch(gate, /auth\.uid\(\) is not null/);
});

test('exact positions and tracks are readable by their owner or a researcher only', () => {
  const p = policies();
  for (const table of ['observation_locations', 'session_tracks', 'track_points']) {
    const selects = [...(p.get(table) ?? new Map()).values()].filter((b) => /for select/i.test(b));
    assert.ok(selects.length, `${table} has a select policy`);
    for (const body of selects) {
      assert.doesNotMatch(
        body,
        /using \(\s*true\s*\)/i,
        `${table} must not be readable by everyone`
      );
      assert.match(body, /observer_id = auth\.uid\(\)/i, `${table} lets the owner read`);
      assert.match(body, /is_researcher\(\)/i, `${table} lets researchers read`);
    }
  }
});

test('effort and observation counts are locked against direct client edits', () => {
  assert.match(code, /create trigger sessions_protect_effort\s+before update on public\.sessions/i);
  const fn = lastFunction('protect_session_effort');
  for (const col of ['distance_km', 'complete_session', 'start_time', 'end_time', 'protocol'])
    assert.match(fn, new RegExp(`new\\.${col} := old\\.${col}`), `${col} is locked`);
  assert.match(
    code,
    /create trigger observations_protect_counts\s+before update on public\.observations/i
  );
  assert.match(code, /create trigger sessions_protect_validation/i);
});

test('consent columns are not readable or writable by other accounts', () => {
  const lastUsersSelect = [
    ...code.matchAll(/grant select \(([^)]*)\) on public\.users to authenticated/gi),
  ].pop();
  assert.ok(lastUsersSelect, 'users has a column-level select grant');
  assert.doesNotMatch(lastUsersSelect![1], /consent/);
  assert.match(code, /revoke select, update, insert on public\.users from authenticated/i);
  // Writes stay possible on your own row only (users_update_self), for installed builds
  const self = policies().get('users')?.get('users_update_self') ?? '';
  assert.match(self, /using \(id = auth\.uid\(\)\)/i);
});

test('nobody can promote themselves', () => {
  const body = policies().get('users')?.get('users_update_self') ?? '';
  assert.match(body, /role = \(select role from public\.users where id = auth\.uid\(\)\)/i);
});

test('the photo bucket is private with size and type limits; uploads go to your own folder', () => {
  assert.match(
    code,
    /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)/i
  );
  assert.match(code, /set public = false/i);
  const insert = policies().get('objects')?.get('animal photos: insert own prefix') ?? '';
  assert.match(insert, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
});

test('writes into another person’s records are refused by the sync functions', () => {
  const push = lastFunction('sync_push');
  for (const msg of ['belongs to another observer', 'not yours'])
    assert.match(push, new RegExp(msg), `sync_push refuses: ${msg}`);
});

test('profiles expose totals, never locations', () => {
  const view = code.match(/create or replace view public\.people_stats[\s\S]*?;\s*\n/i)?.[0] ?? '';
  assert.ok(view, 'people_stats exists');
  assert.doesNotMatch(view, /location|latitude|longitude|track/i);
  assert.match(view, /security_invoker = on/i);
});
