#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
dist_dir="${1:-$repo_dir/dist}"

test -d "$dist_dir"
expected=(
  _headers admin.html builder.html index.html login.html mfa.html security-settings.html site.html
  css/admin.css css/builder.css css/login.css css/site.css css/styles.css
  js/admin-dashboard-state.mjs js/admin.js js/api.js js/auth-storage.mjs js/auth.js js/builder-data.js js/builder.js
  js/login.js js/mfa-controller.mjs js/mfa.js js/post-auth-destination.mjs js/script.js js/security-settings.js js/site.js
  js/supabase-environment.mjs js/supabase-public-config.mjs js/supabase.js js/supabase.local.js
)

actual="$(cd "$dist_dir" && find . -type f -print | sed 's#^./##' | LC_ALL=C sort)"
wanted="$(printf '%s\n' "${expected[@]}" | LC_ALL=C sort)"
if [[ "$actual" != "$wanted" ]]; then
  echo "Artifact differs from the explicit production allowlist" >&2
  diff -u <(printf '%s\n' "$wanted") <(printf '%s\n' "$actual") || true
  exit 1
fi

for forbidden in production-auth-preview.html tools supabase tests backups README.md SECURITY.md AGENTS.md docs deploy scripts; do
  if find "$dist_dir" -path "*/$forbidden" -print -quit | rg -q .; then
    echo "Forbidden production artifact entry found: $forbidden" >&2
    exit 1
  fi
done

headers="$dist_dir/_headers"
rg -q "frame-ancestors 'none'" "$headers"
rg -q '^  Referrer-Policy: no-referrer$' "$headers"
rg -q '^  Permissions-Policy:' "$headers"
rg -q '^  X-Content-Type-Options: nosniff$' "$headers"
for page in login mfa security-settings builder admin; do
  rg -q "^/$page\.html$" "$headers"
done
test "$(rg -c '^  Cache-Control: no-store, max-age=0$' "$headers")" -eq 5

preview_marker='production-auth-''preview'
service_key='SUPABASE_''SERVICE_ROLE_KEY'
secret_key='SUPABASE_''SECRET_KEY'
secret_prefix='sb_''secret_'
if rg -n "($preview_marker|$service_key|$secret_key|$secret_prefix)" "$dist_dir"; then
  echo "Preview or privileged configuration found in production artifact" >&2
  exit 1
fi
rg -q "https://oqwpfnmqeriupujpssxz\.supabase\.co" "$dist_dir/js/supabase-public-config.mjs"
rg -q "http://127\.0\.0\.1:54321" "$dist_dir/js/supabase.local.js"
rg -q "Localhost is restricted to local Supabase" "$dist_dir/js/supabase.js"

echo 'Static production artifact checks passed'
