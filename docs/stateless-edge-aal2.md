# Stateless Edge AAL2 verification

## Confirmed issue and correction

The previous shared `requireAal2` configured an Authorization header and
`persistSession: false`, then requested assurance without passing a JWT.
An HTTP header does not establish an SDK Auth session. With no session the
SDK returns no current assurance level, rejecting a valid stateless AAL2
request. This was a fail-closed availability issue, not a demonstrated bypass.

The locally served SDK source and typings were inspected: supabase-js/auth-js
2.112.4 supports `getAuthenticatorAssuranceLevel(jwt)`. Its explicit-token
implementation verifies the token through `getUser(jwt)` before returning
assurance. The shared import is pinned to this inspected version rather than
the floating major version.

The helper now validates Bearer/JWT structure, verifies the user through Auth,
and passes the same JWT explicitly to assurance verification. Only
`currentLevel === 'aal2'` succeeds. An enrolled factor or `nextLevel` is not
proof of current AAL2. The user-scoped client retains that JWT for RLS/RPC
requests, without session persistence, automatic refresh or URL detection.

An active-profile check is now enforced in the helper (previously this was
left to downstream authorization). The optional, backwards-compatible
`platformAdmin: true` option requires the authenticated user's active admin
row. Lookup failures deny access. Existing consumer-specific authorization
remains in place. The privileged client is created only after these checks;
it does not replace user authorization.

## Scope and database defense in depth

All seven consumers were reviewed and left unchanged: save-draft, publish-site,
manage-security-keys, critical-company-action, admin-provision-company,
import-legacy-site and create-customer. Each has an automated AAL1 denial and
AAL2 progression test that stops at invalid input before an operation write.

No migrations, RLS, key requirements, audit schema or Phase B RPC were changed.
`security_v2_create_company` independently retains authenticated actor, AAL2,
active-profile and active-platform-admin checks. This helper is not a
replacement for database authorization. No Phase C endpoint or wizard was built.

## Local verification

- Local database reset: PASS.
- pgTAP: 460 PASS / 0 FAIL across seven files.
- Local database lint: 0 findings.
- JavaScript suite: 135 PASS / 0 FAIL / 2 opt-in SKIP (137 total).
- Focused helper/consumer tests within that suite: 35 PASS / 0 FAIL.
- Nine static security suites: PASS.
- Explicit local New Customer concurrency suite: 6 PASS / 0 FAIL.
- Explicit real local Auth/MFA suite: 6 PASS / 0 FAIL.

The opt-in `tests/security/edge-aal2-local.test.mjs` uses only loopback Supabase
and a disposable local identity. It performs password login, real TOTP
enrollment/challenge/verification, and calls the locally served save-draft
Edge Function. Password AAL1 was denied; verified AAL2 successfully saved a
draft through the user-scoped trusted RPC with correct actor attribution.
The old AAL1 token remained denied after enrollment. Invalid JWT and suspended
profile requests were denied. Fixture data was removed in cleanup.
Passwords, tokens, TOTP seeds and codes are not written or logged.

Unit tests additionally cover missing/non-Bearer/malformed/expired tokens,
assurance errors, inactive/missing profiles, admin failures, JWT propagation
and absence of browser storage dependencies. Expiry rejection is simulated
as an Auth error in the unit suite, not by waiting for a real token to expire.

## Remaining limitations

Deno 2.1.4 typechecking passes the shared helper and six consumers. Checking
save-draft reports TS2698 at index.ts:18 (`...data`). The unchanged committed
HEAD reproduces the same error with its floating SDK import (resolved to
2.117.2 during the baseline check). This existing typing issue was not hidden
or changed outside this task's scope. The actual local save-draft runtime
test passes. The complete Edge typecheck is therefore not green.

The real integration test exercises HTTP Auth/TOTP and Edge behavior, not a
browser UI smoke test. Full authenticated browser verification remains
required before production deployment. No production access, deployment,
commit, push or merge was performed. Local Auth test execution is explicitly
opt-in via `WREACH_LOCAL_AUTH_TESTS=1`; the ordinary suite skips it.
