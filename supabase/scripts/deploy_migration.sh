#!/usr/bin/env bash
# Applies one migration file to the live project through the Supabase
# Management API, in a transaction, and records it in schema_migrations.
# Usage: bash supabase/scripts/deploy_migration.sh supabase/migrations/<file>.sql
# Token: SUPABASE_ACCESS_TOKEN, else the Supabase CLI entry in the macOS keychain.
set -euo pipefail
FILE="$1"
REF="${SUPABASE_PROJECT_REF:-opglgsidxoedlmgegojz}"
TOK="${SUPABASE_ACCESS_TOKEN:-$(security find-generic-password -s "Supabase CLI" -w)}"
case "$TOK" in go-keyring-base64:*) TOK=$(echo "${TOK#go-keyring-base64:}" | base64 -d);; esac
BASE=$(basename "$FILE" .sql); VERSION="${BASE%%_*}"; NAME="${BASE#*_}"
q() {
  python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1]}))' "$1" |
    curl -sS --max-time 120 -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
      -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d @-
}
already=$(q "select count(*) as n from supabase_migrations.schema_migrations where version = '$VERSION'")
if echo "$already" | grep -q '"n":1'; then echo "$VERSION already applied"; exit 0; fi
SQL=$(cat "$FILE")
echo "Applying $VERSION ($NAME)..."
q "begin;
$SQL
insert into supabase_migrations.schema_migrations (version, name, statements) values ('$VERSION', '$NAME', array[\$mig\$$SQL\$mig\$]);
commit;"
echo
q "select version, name from supabase_migrations.schema_migrations order by version desc limit 1"
echo
