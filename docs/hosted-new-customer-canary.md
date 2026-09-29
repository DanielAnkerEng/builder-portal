# P3 hosted canary preparation — NOT EXECUTED

This is a plan, not a hosted verification result. No production access is needed
or implemented. Local Kong's wildcard CORS / intercepted OPTIONS / changed cache
headers do not establish hosted behavior. Passing unit tests cannot certify the
hosted gateway. No product, Auth, RLS or deployment configuration changes.

## Local usage and execution boundary

Run `node scripts/hosted-new-customer-canary.mjs` from this repository. It reads
local source/config and prints eight deterministic request descriptions only.
All CLI arguments and plan overrides are rejected. There is no HTTP transport,
SDK, credential input, database connection or execution branch. Setting
`WREACH_HOSTED_CANARY=1` still cannot execute. No real tokens or public keys are
included. An independently approved future executor would need separate review.
Local source checks are drift alarms, not a formal semantic proof.

## Intended contract

Fixed target: `https://oqwpfnmqeriupujpssxz.supabase.co`.
Create path: `/functions/v1/admin-create-company`.
Both create and retired routes have `enabled=true`, `verify_jwt=true` locally;
hosted revision/config parity must be verified separately before any canary.

Create supports POST / OPTIONS. Exact allowed origins are `https://wreach.no`,
`http://127.0.0.1:4175`, `http://localhost:4175`. Allowed request headers:
authorization, apikey, content-type, idempotency-key, x-client-info.
Handler responses use exact approved ACAO (never wildcard), ACAM `POST, OPTIONS`,
ACAH the five headers, `Vary: Origin`, `Cache-Control: no-store`.
Disallowed origins receive no ACAO. JSON success/errors use application/json;
valid OPTIONS is 204 with no body (no JSON Content-Type required).

The normal D2 adapter sends a valid frozen company payload and idempotency key:
it MUST NOT be used to generate a canary. P3 plans always omit the key and body.

## Matrix (future approval required for ALL requests)

| Case | Method / credentials | Expected |
| --- | --- | --- |
| 1 allowed preflight | OPTIONS, wreach.no, requested POST and five headers, no auth | 204; exact ACAO and narrow methods/headers |
| 2 denied preflight | OPTIONS, https://canary.invalid, same requested method/headers | 403; no ACAO |
| 3 unsupported method | GET, allowed origin, no auth | handler 405 METHOD_NOT_ALLOWED or gateway 401; never success |
| 4 missing JWT | POST, allowed origin, no auth/key/body | 401 |
| 5 invalid JWT | POST, allowed origin, deliberately invalid non-credential, no key/body | gateway 401; handler must not be reached |
| 6 authorized pre-RPC rejection | POST, real AAL2 active admin, no key, empty body | handler 400 INVALID_REQUEST, no operationId |
| 7 retired invalid JWT | POST to admin-provision-company, invalid non-credential, no body | gateway 401 |
| 8 retired authorized | POST to admin-provision-company, real authorized session, no body | 410 LEGACY_PROVISIONING_RETIRED |

Cases 7/8 are permitted only AFTER independently verifying deployed tombstone
revision; never send an authorized canary to the old provisioning implementation.
Tombstone has four allowed headers (no idempotency-key). It performs no body
parsing, client construction, Auth/DB/email/audit writes. Its Bearer-presence
check is NOT JWT verification; the configured gateway must verify JWTs.

For EVERY case record status, ACAO, ACAM, ACAH, Vary, Cache-Control, Content-Type
and safely exposed request/revision identifiers. Normalize header names, set
ordering and Vary tokens; Origin must be present (additional tokens allowed).
Require no-store and non-permissive CORS also on gateway-generated errors;
upstream header differences are findings, not automatic exceptions. Do not log
Authorization, cookies, raw bodies, tokens, keys or PII. Record only expected
safe error codes. No redirect following, automatic retries or payload fallback.

## Pre-RPC proof and limits

`supabase/functions/admin-create-company/index.ts` currently executes:
method/origin/OPTIONS checks (22–32), `requireAal2` (35), key read (45), missing
or invalid UUID rejection (46), body read (47), structure validation (48), then
user-JWT `security_v2_create_company` RPC (51). Missing key therefore returns
400 BEFORE body consumption and BEFORE the only create RPC. It cannot allocate
an operation or company package through this path. The focused test executes
the real handler with a successful auth stub and forbidden body/RPC stubs.
That test proves the branch, NOT real hosted authentication. Existing C0/Edge
tests cover the separate Auth gates. The unchanged guard reads Auth, profile
and platform-admin state; it constructs but does not use a privileged client.
No new company audit is emitted before RPC. Auth itself may have session/log
side effects; this is a no-BUSINESS-write guarantee, not zero provider telemetry.

Guarantee is conditional on verified deployed source/config parity, without
middleware rewriting keys/body. No valid key is generated, and no company
payload is sent. Unexpected response or revision invalidates the proof: STOP.

## Future authentication and zero-write evidence

Separate explicit approval is required for hosted requests, existing-admin
password/TOTP login and production read-only database verification. A future
reviewed isolated tool should authenticate a real existing authorized Wreach
admin with real TOTP, require current AAL2, retain the session only in memory
with persistence/refresh disabled, never print tokens or use shell arguments,
and discard/sign out afterward as separately approved. No new Auth user,
service role, forged JWT, disk/session storage or credential export. P3 does
not implement this tool or obtain credentials.

Before/after case 6 (and separately case 8), obtain consistent read-only
snapshots scoped to the authorized actor and a bounded test window: operation
IDs/counts, attributed company IDs, company.create success audit IDs/counts,
and associated contacts, services, settings, assignments. Require zero new
attributable rows/packages, not merely an unchanged global count. Use existing
audit/operation relationships, no PII. Independently verify no email/invitation
operation for tombstone. Approve a quiet actor window to exclude concurrent
creates; otherwise attribution is inconclusive and cutover stays blocked.
There is intentionally no valid canary key to correlate. Missing read access,
ambiguous attribution or insufficient retention means INCONCLUSIVE, not PASS.
No production queries or snapshot files are generated by this helper.

## Cutover gates, stops and recovery

Required: (1) Phase A/B production state verified; (2) reviewed create Edge
revision deployed; (3) hosted no-write canary and zero-write proof PASS;
(4) legacy tombstone deployed and verified; (5) production artifact verified;
(6) rollback/recovery approved. Production legacy access mapping remains a
separate P2 gate before any legacy read-policy removal.

STOP on wildcard ACAO, permissive denied origin, broad preflight methods/headers,
missing required Vary/no-store, approved-origin rejection, invalid JWT admitted
to handler, failed AAL2/admin enforcement, revision/config mismatch, unexpected
operation/company/audit, non-deterministic case 6 response or tombstone writes.
Do not relax tests, automatically repair hosted configuration or retry creates.

If create fails: no frontend cutover; preserve Phase A/B and revoked raw browser
inserts; separately approve a forward Edge/gateway/config fix and repeat gates.
If tombstone fails: do not expose old UI or restore service-role provisioning;
forward-fix the tombstone. No rollback deployment or mutation is automated here.
