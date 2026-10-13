#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist_dir="$repo_dir/dist"

html_files=(index.html demo.html login.html mfa.html security-settings.html admin.html builder.html site.html)
css_files=(styles.css marketing.css demo.css public-fonts.css login.css admin.css builder.css site.css)
js_files=(
  admin-new-customer-state.mjs admin-new-customer-api.mjs admin-new-customer.mjs
  admin-customers.mjs admin-customers-data.mjs admin-dashboard.mjs admin-dashboard-state.mjs admin-shell.mjs admin.js api.js auth-storage.mjs auth.js builder-data.js builder.js demo-data.mjs demo.js login.js
  demo-renderer.mjs marketing-scenes.mjs mfa-controller.mjs mfa.js post-auth-destination.mjs script.js security-settings.js site.js
  supabase-environment.mjs supabase-public-config.mjs supabase.js supabase.local.js
)

public_assets=(
OFL-Fraunces.txt
OFL-Manrope.txt
auto-detail-1600.webp
auto-detail-640.webp
auto-workshop-1600.webp
auto-workshop-640.webp
consulting-office-1600.webp
consulting-office-640.webp
credits.json
estate-cabin-1600.webp
estate-cabin-640.webp
estate-house-1600.webp
estate-house-640.webp
fraunces-latin.woff2
manrope-latin.woff2
restaurant-food-1600.webp
restaurant-food-640.webp
restaurant-room-1600.webp
restaurant-room-640.webp
salon-detail-1600.webp
salon-detail-640.webp
salon-hair-1600.webp
salon-hair-640.webp
salon-room-1600.webp
salon-room-640.webp
trade-bath-1600.webp
trade-bath-640.webp
trade-detail-1600.webp
trade-detail-640.webp
wreach-web-studio-1536.webp
wreach-web-studio-640.webp
)

rm -rf "$dist_dir"
mkdir -p "$dist_dir/css" "$dist_dir/js"
mkdir -p "$dist_dir/assets/marketing"

for file in "${html_files[@]}"; do install -m 0644 "$repo_dir/$file" "$dist_dir/$file"; done
for file in "${css_files[@]}"; do install -m 0644 "$repo_dir/css/$file" "$dist_dir/css/$file"; done
for file in "${js_files[@]}"; do install -m 0644 "$repo_dir/js/$file" "$dist_dir/js/$file"; done
install -m 0644 "$repo_dir/deploy/cloudflare/_headers" "$dist_dir/_headers"
for file in "${public_assets[@]}"; do install -m 0644 "$repo_dir/assets/marketing/$file" "$dist_dir/assets/marketing/$file"; done

"$repo_dir/tests/security/static_production_artifact.sh" "$dist_dir"
echo "Production artifact built at $dist_dir"
