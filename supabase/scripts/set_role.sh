#!/usr/bin/env bash
# Gives an existing account a role (volunteer, trained_surveyor, researcher, admin).
# Usage: bash supabase/scripts/set_role.sh someone@example.org admin
# After the first admin exists, roles are managed in the research portal.
set -euo pipefail
EMAIL="$1"; ROLE="$2"
case "$ROLE" in volunteer|trained_surveyor|researcher|admin) ;; *) echo "Unknown role: $ROLE"; exit 1;; esac
REF="${SUPABASE_PROJECT_REF:-opglgsidxoedlmgegojz}"
TOK="${SUPABASE_ACCESS_TOKEN:-$(security find-generic-password -s "Supabase CLI" -w)}"
case "$TOK" in go-keyring-base64:*) TOK=$(echo "${TOK#go-keyring-base64:}" | base64 -d);; esac
SQL="update public.users u set role = '$ROLE' from auth.users a where a.id = u.id and lower(a.email) = lower('$(printf %s "$EMAIL" | sed "s/'/''/g")') returning a.email, u.role;"
python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1]}))' "$SQL" |
  curl -sS --max-time 60 -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d @-
echo
