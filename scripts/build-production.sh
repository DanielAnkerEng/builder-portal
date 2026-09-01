#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist_dir="$repo_dir/dist"

html_files=(index.html login.html mfa.html security-settings.html admin.html builder.html site.html)
css_files=(styles.css login.css admin.css builder.css site.css)
js_files=(
  admin-dashboard-state.mjs admin.js api.js auth-storage.mjs auth.js builder-data.js builder.js login.js
  mfa-controller.mjs mfa.js post-auth-destination.mjs script.js security-settings.js site.js
  supabase-environment.mjs supabase-public-config.mjs supabase.js supabase.local.js
)

rm -rf "$dist_dir"
mkdir -p "$dist_dir/css" "$dist_dir/js"

for file in "${html_files[@]}"; do install -m 0644 "$repo_dir/$file" "$dist_dir/$file"; done
for file in "${css_files[@]}"; do install -m 0644 "$repo_dir/css/$file" "$dist_dir/css/$file"; done
for file in "${js_files[@]}"; do install -m 0644 "$repo_dir/js/$file" "$dist_dir/js/$file"; done
install -m 0644 "$repo_dir/deploy/cloudflare/_headers" "$dist_dir/_headers"

"$repo_dir/tests/security/static_production_artifact.sh" "$dist_dir"
echo "Production artifact built at $dist_dir"
