#!/usr/bin/env bash
# Applies every migration to a throwaway PostGIS container and runs the
# behavioural SQL checks. Fails if any check prints FAIL or errors.
set -euo pipefail
cd "$(dirname "$0")/../.."

NAME=hawem-sql-behaviour
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=pw postgis/postgis:16-3.4 >/dev/null
trap 'docker stop "$NAME" >/dev/null' EXIT
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 2

psql_in() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -t "$@"; }

psql_in < supabase/tests/support/platform_stubs.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_in < "$f" >/dev/null 2>&1 || { echo "Migration failed: $f"; psql_in < "$f"; exit 1; }
done

out=$(for t in supabase/tests/*.behaviour.sql; do psql_in < "$t" 2>&1; done | grep -E 'PASS|FAIL|ERROR' | sed -E 's/^(NOTICE: +| +)//')
echo "$out"
if echo "$out" | grep -qE 'FAIL|ERROR'; then exit 1; fi
