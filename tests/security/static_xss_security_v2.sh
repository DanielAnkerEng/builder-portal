#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; renderer="$repo_dir/js/site.js"
rg -q 'createElement' "$renderer"; rg -q 'textContent' "$renderer"; rg -q 'security_v2_validate_site_content' "$repo_dir/supabase/migrations/20260826130500_security_v2_content_validation.sql"
if rg -n "(innerHTML|outerHTML|insertAdjacentHTML|document\\.write|eval\\s*\\(|new Function|srcdoc|setAttribute\\(['\\\"]on)" "$renderer"; then echo 'Executable HTML sink found' >&2; exit 1; fi
if rg -n '(customCode|localStorage|sessionStorage|SUPABASE_(SERVICE_ROLE|SECRET)_KEY)' "$renderer"; then echo 'Portal/custom-code boundary violation' >&2; exit 1; fi
echo 'Static XSS Security V2 checks passed'
