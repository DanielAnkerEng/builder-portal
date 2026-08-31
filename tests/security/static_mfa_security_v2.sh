#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
files=("$repo_dir/js/mfa-controller.mjs" "$repo_dir/js/mfa.js" "$repo_dir/js/login.js" "$repo_dir/js/security-settings.js")
rg -q "currentLevel === 'aal2'" "$repo_dir/js/mfa-controller.mjs"
rg -q "nextLevel === 'aal2'" "$repo_dir/js/mfa-controller.mjs"
rg -q 'mfa\.unenroll' "$repo_dir/js/mfa-controller.mjs"
rg -q 'refreshSession' "$repo_dir/js/mfa-controller.mjs"
rg -q 'mfa_factor_name_conflict' "$repo_dir/js/mfa-controller.mjs"
rg -q 'verified\.length > 0' "$repo_dir/js/mfa.js"
if rg -n '(localStorage|sessionStorage|console\.|document\.write|innerHTML|eval\s*\(|new Function)' "${files[@]}"; then echo 'Unsafe MFA browser pattern found' >&2; exit 1; fi
if rg -n '(secret|qrCode|code).*(insert|update|upsert|audit|log)' "${files[@]}"; then echo 'MFA secret persistence/logging pattern found' >&2; exit 1; fi
echo 'Static MFA Security V2 checks passed'
