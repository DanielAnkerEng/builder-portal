#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
foundation="$repo_dir/supabase/migrations/20260826130000_security_v2_authorization_foundation.sql"

test -f "$foundation"
test -f "$repo_dir/SECURITY.md"
test -f "$repo_dir/docs/security-architecture.md"
test -f "$repo_dir/AGENTS.md"

if rg -n --glob '!supabase/.temp/**' --glob '!supabase/functions/_shared/security.ts' \
  --glob '!tests/security/static_phase_b.sh' --glob '!tests/security/static_security_v2.sh' \
  '(service_role_key|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|postgresql://[^[:space:]]+:[^[:space:]@]+@)' "$repo_dir"; then
  echo "Potential committed secret found" >&2
  exit 1
fi

if rg -n "insert[[:space:]]+into[[:space:]]+public\.platform_admins" "$foundation"; then
  echo "Foundation migration must not guess platform-admin UUIDs" >&2
  exit 1
fi

rg -q "NO NORMAL PROTECTED SESSION BELOW AAL2" "$repo_dir/SECURITY.md"
rg -q "NO AUTHORIZATION TRUSTS LOCALSTORAGE" "$repo_dir/SECURITY.md"
rg -q "Never guess platform administrator user IDs" "$repo_dir/AGENTS.md"
confirmed="$repo_dir/supabase/migrations/20260826130100_security_v2_confirmed_identity_backfill.sql"
rg -q "8ce09e9b-a061-4a8b-b5f3-d286cc18be8a" "$confirmed"
rg -q "220d30ce-2286-4ec7-b17b-5d871f9fa038" "$confirmed"
rg -q "9e62a891-3805-422d-8f41-e65ce69d5a4b" "$confirmed"
rg -q "set role = 'owner', status = 'active'" "$confirmed"

echo "Phase B static security checks passed"
