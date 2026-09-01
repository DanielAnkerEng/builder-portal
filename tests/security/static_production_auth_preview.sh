#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
preview="$repo_dir/js/production-auth-preview.js"; gate="$repo_dir/js/production-auth-preview-gate.mjs"; config="$repo_dir/js/supabase-public-config.mjs"
rg -q 'productionAuthPreviewAllowed' "$preview"
rg -q 'confirm-real-production-users' "$gate"
rg -q 'PRODUCTION AUTH PREVIEW' "$repo_dir/production-auth-preview.html"
rg -q 'createMemoryStorage' "$preview"
rg -q 'refreshPreviewFactorStatus' "$preview"
rg -q 'if \(ok\) await finishVerifiedUi\(\)' "$preview"
rg -q 'currentLevel' "$repo_dir/js/mfa-controller.mjs"
rg -q 'mfa_factor_name_conflict' "$repo_dir/js/mfa-controller.mjs"
if rg -n '\.(from|rpc|functions|storage)\b|saveDraft|publish|securityKey|critical' "$preview"; then echo 'Non-Auth capability found in production preview' >&2; exit 1; fi
if rg -n '(localStorage|sessionStorage|console\.|document\.write|innerHTML|eval\s*\(|new Function)' "$preview" "$gate" "$config"; then echo 'Unsafe production preview pattern found' >&2; exit 1; fi
secret_prefix='sb''_secret_'; service_key='SUPABASE_''SERVICE_ROLE_KEY'; secret_key='SUPABASE_''SECRET_KEY'
if rg -n "($secret_prefix|$service_key|$secret_key)" "$preview" "$config"; then echo 'Privileged key found in production preview' >&2; exit 1; fi
echo 'Static production Auth preview checks passed'
