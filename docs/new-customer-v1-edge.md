# New Customer V1 — Phase C HTTP boundary

**Local function/runtime and Auth/MFA + DB/RPC verification PASS. Local Kong
CORS remains a known infrastructure failure; hosted gateway remains unverified.
Not production-verified. No frontend wizard or production deployment.**

## Route and authorization

`admin-create-company` accepts POST and preflight OPTIONS only. Its config
enables `verify_jwt = true`; existing functions' config is unchanged.
POST calls the unchanged C0 `requireAal2(req, { platformAdmin: true })`:
Auth-verified Bearer JWT, current AAL2, active profile and active platform admin.
It invokes only `userClient.rpc('security_v2_create_company',
{ p_idempotency_key, p_payload })`. The user's JWT is preserved; no privileged
write, direct insert, Auth Admin call, invitation, membership, website, draft,
publication or security-key creation is performed by this HTTP layer.

Phase B remains authoritative for semantic validation, normalization,
authorization, idempotency, atomic package writes and audit. Pure company
record creation does not require a personal/company security key. Existing
key-protected operations are unchanged.

## Input and transport

- POST requires application/json, optionally charset=utf-8 (quoted accepted).
- The stream is bounded to 16384 actual bytes. Content-Length is only an early
  rejection hint; it cannot bypass the streaming count. UTF-8 decoding is fatal
  for invalid byte sequences.
- A bounded recursive-descent JSON syntax walk rejects duplicate decoded keys
  independently within every object before constructing the payload. Escaped
  Unicode keys are compared after decoding. Arrays of separate objects may
  reuse field names. Malformed JSON, trailing content and nesting over 32 are
  rejected. This is not regex-only duplicate detection.
- Required Idempotency-Key is lowercase canonical UUID v4, passed unchanged.
  No server-generated fallback key exists.
- Root/company/contact/internal/assignment fields and structural types are
  checked. Unknown fields are rejected. Business allowlists, trimming and other
  normalization remain in Phase B.

## Function-generated CORS and cache headers

Allowed origins: https://wreach.no, http://127.0.0.1:4175 and
http://localhost:4175. Local origins come from existing config.toml Auth URLs.
No wildcard/reflection; unapproved origins are rejected. Originless server
POSTs still require complete authorization. OPTIONS requires an allowed origin,
POST requested method and approved requested headers, and never calls Auth/RPC.

Allowed headers: Authorization, apikey, Content-Type, Idempotency-Key and
x-client-info. The latter is supplied by the inspected installed supabase-js
2.112.4 src/lib/constants.ts SDK defaults. Allowed methods: POST, OPTIONS.
Function-generated success/error/preflight responses carry Vary: Origin and
Cache-Control: no-store. These guarantees do not control responses generated
or overwritten by a gateway before/after the function runs (see blocker).

## Safe responses

Success/replay: HTTP 200, ok:true, operationId, companyId, status:completed.
Only allowlisted fields are copied, with UUID validation. Phase B's internal
error:null and any extra response fields are not exposed.

Failure: ok:false, optional validated operationId, error:{code}.

- 400 INVALID_REQUEST: syntax, duplicate keys, structure or header errors.
- 400: Phase B INVALID_IDEMPOTENCY_KEY, INVALID_PAYLOAD,
  INVALID_ORGANIZATION_NUMBER, INVALID_URL, INVALID_EMAIL, INVALID_PHONE,
  INVALID_ADDRESS, INVALID_CONTACT, INVALID_SERVICE, DUPLICATE_SERVICE,
  INVALID_LIFECYCLE, INVALID_ASSIGNMENT, DUPLICATE_ASSIGNMENT, INVALID_ASSIGNEE.
- 401 UNAUTHENTICATED; 403 MFA_REQUIRED / PROFILE_INACTIVE / NOT_AUTHORIZED.
  Profile missing/read failure maps fail-closed to PROFILE_INACTIVE as well.
- 405 METHOD_NOT_ALLOWED; 413 PAYLOAD_TOO_LARGE; 415 UNSUPPORTED_MEDIA_TYPE.
- 409 IDEMPOTENCY_CONFLICT / ORGANIZATION_NUMBER_EXISTS.
- 503 RETRY_SAME_REQUEST: thrown RPC transport failure or SDK status 0. The
  outcome may already have committed: repeat identical payload and SAME key.
- 500 OPERATION_FAILED: SQL/internal/unknown/malformed RPC results. No raw
  database message is exposed. Phase B P0001 remains a generic 500.

There is no application logging of payloads, credentials, personal data,
fingerprints or raw errors, and no duplicate Edge audit. Audit remains atomic
in Phase B.

## Verification results (2026-09-28)

- New Edge unit/transport/security tests: 68 PASS / 0 FAIL.
- Full JS suite: 203 PASS / 0 FAIL / 4 opt-in SKIP (207 total).
- Nine existing static security suites: PASS.
- Local db reset: PASS. pgTAP: 460 PASS / 0 FAIL. Local lint: 0 findings.
- Explicit local concurrency: 6 PASS / 0 FAIL.
- Existing real local C0 password/TOTP/Edge regression: 6 PASS / 0 FAIL.
- Deno 2.1.4 typecheck of new endpoint/helper: PASS.

Direct-runtime integration: 16 subtests PASS; Node reports 17 PASS / 0 FAIL
including the parent, with 1 separate Kong suite skipped. Kong integration:
9 subtests PASS, 1 CORS subtest FAIL; Node reports 9 PASS / 2 FAIL including
the parent, with 1 separate direct suite skipped. Real password AAL1 was rejected;
real TOTP-upgraded AAL2 created a company/contact/service/internal-settings/
assignment package and exactly one success audit with actual operation/company
IDs. Same-key replay returned the same IDs without extra package/audit.
Changed-payload replay and duplicate organization number safely conflicted.
Malformed and duplicate-key (including Unicode-escaped keys) bodies created no
operations; invalid JWT was denied. Direct preflight verified all three approved
origins, exact ACAO, POST/OPTIONS only, the five approved headers, no-store and
Vary containing Origin (additional Accept-Encoding is permitted). Unapproved
origins and invalid preflight methods/headers were rejected. POST validation/
origin errors preserved the policy and created no operations.
The disposable local identity and its owned package/operation/audit rows were
cleaned up. Only fixed loopback Supabase and local Docker database are used.

## C1: separate direct-runtime HTTP test transport

`tests/security/helpers/local-edge-http.mjs` targets only
`http://supabase_edge_runtime_webbyra-demo-github:8081/admin-create-company`.
It uses the existing local Studio container's Node runtime to issue real HTTP
on the existing Docker network. No new container, port, listener or gateway
configuration is created. Request values travel via stdin, not process arguments.
Response status/headers/body return over a private process pipe with bounded
sizes/timeouts; diagnostics and sensitive input are not printed. There is no
response-header rewriting, CORS repair or automatic redirect following.

The transport accepts no target URL and rejects host/forwarded/internal-header
overrides. It requires explicit WREACH_LOCAL_DIRECT_EDGE_TESTS=1. Auth signup,
password login and TOTP still use fixed loopback Auth; only the Edge request
bypasses Kong. The existing Edge router's JWT verification, unchanged C0 helper,
user-JWT RPC and actual Phase B database path remain exercised. Test cleanup
removes only that run's local identity and owned rows, and asserts identity and
operation removal. The required local database reset was also run separately.

Run the direct suite with WREACH_LOCAL_DIRECT_EDGE_TESTS=1 and Node --test
tests/security/new-customer-edge-local.test.mjs. Run the unchanged-expectation
Kong path separately with WREACH_LOCAL_AUTH_TESTS=1 and the same test file.
Without opt-in both runtime suites are skipped; neither is claimed as passing
merely because the default unit-test command succeeds.

This proves function/direct-runtime CORS and real local Auth/MFA + DB/RPC. It
does NOT prove browser UI behavior, Kong conformance, hosted gateway response
headers, production deployment configuration or headers on runtime-generated
JWT rejection responses that stop before the function is invoked.

## Known infrastructure finding: local Kong overwrites function CORS

The separate Kong integration test deliberately remains failing: replies contain
Access-Control-Allow-Origin: * instead of the function's exact allowed origin.
Read-only inspection confirms the local functions route has Kong's default CORS
plugin; its response header filter sets wildcard when no origins are configured.
An unauthenticated OPTIONS probe with an unapproved origin also returned 200,
wildcard ACAO, broad methods and no Cache-Control, generated by Kong before the
function's preflight handler. Thus end-to-end CORS/no-store preflight requirements
are NOT verified by this local stack despite passing function-level tests.

No gateway configuration or production infrastructure was changed to hide this.
The approved direct-runtime test is separate and does not repair Kong. Hosted/
production gateway CORS remains NOT YET VERIFIED; production was not accessed.
CORS is not authorization and passing direct tests do not resolve this finding.

During the earlier Phase C read-only diagnostics an overly broad gateway-config excerpt exposed
auto-generated local gateway credentials in tool output. They were not written
into source/docs or used against production. Do not copy that output into review
artifacts. No credential rotation was attempted within this task.

## Other outstanding items

Existing save-draft/index.ts:18 TS2698 (`...data`) reproduced again, with the file
and C0 helper unchanged from committed HEAD. Not a Phase C regression or fixed
here. Full browser password/TOTP smoke testing remains required before rollout.
Legacy admin-provision-company still exists and requires coordinated retirement;
legacy profiles.company_id read access remains unchanged. No migration, RLS,
Phase A/B RPC, existing Edge operation, frontend or Auth settings were changed.
No commit, push, merge, deployment or production operation was performed.
> P1 current status: legacy provisioning is retired locally as a no-write 410
> tombstone; historical observations below describe the earlier implementation.
> See [retirement/cutover notes](legacy-provisioning-retirement.md). Not deployed.
