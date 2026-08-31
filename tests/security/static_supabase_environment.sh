#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
client="$repo_dir/js/supabase.js"; local_config="$repo_dir/js/supabase.local.js"
rg -q "https://oqwpfnmqeriupujpssxz\.supabase\.co" "$client"
rg -q "http://127\.0\.0\.1:54321" "$local_config"
rg -q "Localhost is restricted to local Supabase" "$client"
rg -q "LOCAL SUPABASE" "$client"
secret_prefix='sb''_secret_'; service_key='SUPABASE_''SERVICE_ROLE_KEY'; secret_key='SUPABASE_''SECRET_KEY'
if rg -n "($secret_prefix|$service_key|$secret_key)" "$client" "$local_config"; then echo 'Privileged key found in frontend config' >&2; exit 1; fi
if rg -n '(localStorage|sessionStorage)' "$client" "$local_config" "$repo_dir/js/supabase-environment.mjs"; then echo 'Environment selection must not use browser storage' >&2; exit 1; fi
echo 'Static Supabase environment checks passed'
