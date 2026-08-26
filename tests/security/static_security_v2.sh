#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
active_files=("$repo_dir"/*.html "$repo_dir"/js/*.js)
if rg -n '(localStorage|sn_session|sn_accounts|document\.write|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|sb_secret_)' "${active_files[@]}"; then
  echo "Unsafe browser-side security pattern found" >&2; exit 1
fi
if rg -n '(demo@|demo123|admin123|password123)' "${active_files[@]}"; then
  echo "Demo credential found in active frontend" >&2; exit 1
fi
echo "Static Security V2 checks passed"
