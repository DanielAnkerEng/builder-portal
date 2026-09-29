# New Customer V1 — Phase B trusted operations

Local implementation only; **not production-ready New Customer V1**. One new
migration, 20260923130000_new_customer_v1_operations.sql, follows Phase A.
Historical migrations and existing Security V2 functions remain unchanged.

## Contract and authorization

`security_v2_create_company(p_idempotency_key uuid, p_payload jsonb)` is VOLATILE,
SECURITY DEFINER, search_path=''. Actor is exclusively auth.uid(). It requires
AAL2, an active platform_admin and an active profile. Actor rows are locked FOR
SHARE during the operation. No personal/company key is required for pure record
creation; existing key-protected operations are not changed.

Payload requires schemaVersion=1, company, contact (object or null), services
(array), and internal containing lifecycleStatus and assignments. All object
levels reject unknown fields and unexpected types. The database rejects a
serialized jsonb payload above 16 KiB; Phase C must additionally bound the raw
HTTP body. jsonb has already collapsed duplicate JSON object keys, so raw
duplicate-key detection belongs to the future HTTP parser, not this RPC.

Company/contact names are required when applicable, trimmed and bounded.
Optional absent/null/empty text canonicalizes to null. Organization number
spaces are removed, then the Phase A checksum is enforced. URL is validated
without fetching; authority is lowercased, path/query preserved. Email domain
is lowercased; mailbox is not used for identity. Phone formatting spaces,
parentheses and hyphens are removed before international-format validation.
Address CRLF becomes LF. Controls, excessive lengths, invalid allowlists,
duplicate services and duplicate responsibility types are rejected.

Zero services/assignments and contact=null are valid. Lifecycle is required,
not silently inferred. Assignees must be active platform admins with active
profiles, locked FOR SHARE in deterministic UUID order. Assignment grants no
role or membership. Deactivation after a completed transaction is still allowed;
the assignment is historical responsibility, not ongoing authorization.

The normalization helper is STABLE because PostgreSQL JSON construction and
aggregation routines are STABLE. The simple text helper is IMMUTABLE. Private
helpers are not executable by PUBLIC/anon/authenticated/service_role.

## Atomicity and idempotency

One transaction/subtransaction package creates:
company, optional primary contact, services, internal settings, assignments,
required success audit and completed operation.

There is no Auth/profile/membership/website/draft/publication/key/email write.

Scope is actor + company.create.v1 + idempotency key. SHA-256 is computed in the
database over a canonical JSON representation containing version, actor, key,
normalized values, sorted services and sorted assignments. No raw payload copy
is stored. Fingerprints are not exposed to callers.

INSERT ON CONFLICT plus SELECT FOR UPDATE serializes duplicate requests.
Completed replay returns the identical response and does not repeat success
audit. Different normalized payload conflicts. Classified failures
ORGANIZATION_NUMBER_EXISTS and INVALID_ASSIGNEE persist as terminal failed
operations; same-key replay returns that stored failure. A corrected request
uses a new explicit key. Validation failures before operation insertion do not
reserve a key.

Unknown failures raise safe P0001/OPERATION_FAILED and roll back the entire
operation, including its storage row. Retry after an unknown/lost response uses
the SAME key and payload. No polling claim is made about uncommitted pending.
A persistent pending row is not produced by this normal transaction path.
No retention/reaper is implemented.

## Audit and safe errors

Success company.create audit is required inside the atomic package.
Correlation ID is operationId; actor/company/target are derived by the server.
Metadata only: schema_version, operation_type, contact_created, service_count,
assignment_count. Failure metadata only: allowlisted error_code and stage.
No names, addresses, emails, URLs, payloads, fingerprints, keys or tokens.

A failure of required audit insertion aborts the package; audit fault injection
tests confirm rollback and safe error text. Failed replay does not add events.
Authorization/validation rejection before an operation is accepted returns
safe codes without a new persisted event. General pre-request denial/rate-limit
telemetry is not implemented here; Phase C may add bounded safe telemetry.
Existing service-role audit privileges/protections are not redesigned.

## Read RPCs

`security_v2_get_company_creation_status(uuid)`: same authorization, actor's
own operation only; operationId/status/companyId/errorCode only. Unknown or
another actor's key gives NOT_FOUND.

`security_v2_list_company_assignees()`: same authorization; returns eligible
active platform admins with active profiles as userId/displayName only.
No email, memberships or Auth metadata.

Both are STABLE SECURITY DEFINER with empty search_path.
All three public RPCs explicitly revoke PUBLIC/anon/service_role execution and
grant authenticated only. SECURITY DEFINER ownership follows the existing
migration-owner trusted-function pattern. Browser table write privileges are
not granted. A direct authenticated RPC call is subject to the complete boundary.

## Companies browser write boundary and deliberate legacy exceptions

The migration removes "Admins can create companies" and revokes ALL companies
privileges from PUBLIC/anon/authenticated, then grants authenticated SELECT.
No direct INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER is available to browser
roles. Phase A new-table/storage privileges remain unchanged.

Existing companies SELECT policies remain intact, including the legacy
profiles.company_id "Customers can read own company" path. Its removal requires
explicit access mapping and remains outstanding.

service_role privileges are not broadly altered. admin-provision-company still
exists as the privileged legacy backend path with historical side effects.
It has NOT been retired by this phase. Later coordinated cutover must handle it.
create-customer and all protected Edge Functions remain unchanged.

Phase A's three assertions expecting the old browser INSERT path were upgraded
to assert its removal/denial. The legacy read assertion remains. No migration or
security test was weakened to accommodate the new operation.

## Local verification (2026-09-28)

- supabase db reset --local --yes: full chain PASS.
- supabase test db --local: 7 files, 460 assertions PASS, 0 failures.
  New operations file contributes 102 assertions.
- supabase db lint --local: empty findings, no schema errors.
- Existing JS: 100 PASS, 0 FAIL. Opt-in concurrency parent is skipped in this run.
- Explicit concurrency run: 5 scenarios + parent = Node reports 6 PASS, 0 FAIL.
- Nine existing static security scripts PASS, including existing dist inspection.
- No production build or deployment.

Run concurrency only with WREACH_LOCAL_DB_TESTS=1 and Node's --test runner.
The harness pins the local Unix Docker socket and fixed
supabase_db_webbyra-demo-github container, uses separate psql connections,
accepts no remote DB URL, and cleans up only its random-UUID-owned fixtures.

Scenarios: identical concurrent replay; conflicting payload; two keys/same org;
assignment racing admin deactivation; discarded response then same-key retry.
The latter simulates losing the response by discarding it, not an actual network
disconnect. Profile deactivation race and every possible lock scheduling order
are not separately automated; inactive profiles are covered by SQL tests.

The historical full authenticated browser AAL2 Admin V2 smoke test is still a
separate outstanding verification item. SQL claims/fixtures test database
authorization, not real browser password/TOTP login.

No Edge Function, frontend wizard, invitation or website workflow is implemented.
No production inspection/change, commit, push, merge or deploy is part of Phase B.
> P1 current status: legacy provisioning is retired locally as a no-write 410
> tombstone; historical observations below describe the earlier implementation.
> See [retirement/cutover notes](legacy-provisioning-retirement.md). Not deployed.
