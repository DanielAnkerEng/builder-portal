#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

rg -q "resolvePostAuthDestination" "$repo_dir/js/login.js"
rg -q "resolvePostAuthDestination" "$repo_dir/js/mfa.js"
if rg -n "location\.replace\('builder\.html'\)" "$repo_dir/js/login.js" "$repo_dir/js/mfa.js"; then
  echo "Hardcoded post-auth builder redirect remains" >&2
  exit 1
fi
rg -q "\.eq\('user_id', session\.user\.id\)" "$repo_dir/js/post-auth-destination.mjs"
rg -q "assurance\?\.currentLevel !== 'aal2'" "$repo_dir/js/post-auth-destination.mjs"
echo "Static post-auth routing checks passed"
