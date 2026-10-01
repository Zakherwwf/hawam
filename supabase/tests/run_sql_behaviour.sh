#!/usr/bin/env bash
# Replays every migration on a throwaway PostGIS container, then runs
#  - supabase/tests/live/*.sql       pgTAP suites for the access model and grid
#  - supabase/tests/*.behaviour.sql  PASS/FAIL behaviour checks
# Fails on any pgTAP "not ok", any FAIL line, or any SQL error.
set -euo pipefail
cd "$(dirname "$0")/../.."

NAME=hawem-sql-behaviour
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=pw postgis/postgis:16-3.4 >/dev/null
trap 'docker stop "$NAME" >/dev/null' EXIT
# The image runs a temporary server for its init scripts, then restarts
until docker logs "$NAME" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
docker exec "$NAME" bash -c "apt-get update -qq >/dev/null && apt-get install -y -qq postgresql-16-pgtap >/dev/null"

psql_in() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -t -A "$@"; }

psql_in < supabase/tests/support/platform_stubs.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  psql_in < "$f" >/dev/null 2>&1 || { echo "Migration failed: $f"; psql_in < "$f"; exit 1; }
done

status=0
for t in supabase/tests/live/*.sql; do
  out=$(psql_in < "$t" 2>&1) || status=1
  echo "$t: $(echo "$out" | grep -c '^ok') ok, $(echo "$out" | grep -c '^not ok') not ok"
  if echo "$out" | grep -qE '^not ok|ERROR'; then echo "$out" | grep -E '^not ok|ERROR|# '; status=1; fi
done

out=$(for t in supabase/tests/*.behaviour.sql; do psql_in < "$t" 2>&1; done | grep -E 'PASS|FAIL|ERROR' | sed -E 's/^(NOTICE: +| +)//')
echo "$out"
if echo "$out" | grep -qE 'FAIL|ERROR'; then status=1; fi
exit $status
