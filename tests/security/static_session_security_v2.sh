#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
adapter="$repo_dir/js/auth-storage.mjs"; client="$repo_dir/js/supabase.js"; auth="$repo_dir/js/auth.js"; login="$repo_dir/js/login.js"; builder="$repo_dir/js/builder.js"
rg -q 'persistentStorage: browser\.localStorage' "$adapter"
rg -q 'transientStorage: browser\.sessionStorage' "$adapter"
rg -q 'prepareAuthSignIn\(remember\)' "$login"
rg -q 'clearWreachAuthSession' "$auth"
rg -q 'supabase\.auth\.signOut' "$auth"
rg -q 'requireAal2' "$builder"
rg -q "assurance.currentLevel !== 'aal2'" "$auth"
rg -q 'id="remember"' "$repo_dir/login.html"
if rg -q 'id="remember"[^>]*checked' "$repo_dir/login.html"; then echo 'Remember me must default to off' >&2; exit 1; fi
if rg -n '(localStorage|sessionStorage)\.clear\(' "$repo_dir/js"; then echo 'Global browser storage clear found' >&2; exit 1; fi
if rg -n '(console\.|document\.write|eval\s*\(|new Function)' "$adapter" "$client" "$login" "$auth"; then echo 'Unsafe session implementation pattern found' >&2; exit 1; fi
echo 'Static session Security V2 checks passed'
