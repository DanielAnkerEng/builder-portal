# New Customer V1 — Phase A schema foundation

This phase is **not** the complete New Customer backend. It adds one migration,
schema tests and read-access boundaries only. No create/status/assignee RPC,
Edge Function, wizard, invitation, Auth change, membership, website, draft,
publication or security key is created.

## Company metadata

All five new text columns are nullable, without defaults or backfill:
organization_number, external_website_url, contact_email, contact_phone, address.
Existing nullable name and is_active semantics are unchanged.

- Organization number: exactly nine ASCII digits, Norwegian mod-11 checksum,
  rejects all zeros, partial unique index when present. No registry lookup.
- URL: at most 2048 characters; conservative http/https DNS-host grammar,
  optional port 1–65535; no whitespace, controls, backslash or userinfo.
  IP literals and single-label hosts are deliberately outside this V1 grammar.
  This is not a full URL parser; Phase B/Edge must perform stronger normalization.
- Email: ordinary ASCII dot-atom mailbox/DNS domain, no whitespace or controls;
  at most 254 characters and 64 in the local part. No uniqueness or identity link.
- Phone: stored international format matching ^[+][1-9][0-9]{7,14}$.
- Address: 1–500 characters when present, at most four LF-separated lines;
  no other control characters or whitespace-only address. Normalize CRLF later
  before storage, rather than silently rewriting existing data.

The three pure public.new_customer_*_valid(text) helpers are IMMUTABLE, STRICT,
SECURITY INVOKER, with empty search_path. They read no data. PUBLIC/anon execution
is revoked. authenticated/service_role may evaluate them because existing
company writes remain supported in Phase A. They are not trusted write RPCs.

These companies fields inherit EXISTING company read access. Store only shared
business contact details here, not confidential personal contact information.

## Tables and privacy

- company_contacts: company FK RESTRICT; name 1–200, optional email/phone/title
  (title 1–120); text name/title must be trimmed and contain no control characters.
  Multiple contacts, at most one primary via partial unique index. No linked_user_id.
- company_services: company/service composite primary key; 11 explicit service
  codes checked as text; created_by Auth FK RESTRICT. No customer read in V1.
- company_internal_settings: company primary/FK RESTRICT, lifecycle allowlist
  onboarding/active/paused/ended, default onboarding ONLY when explicitly inserted.
  No internal_note. Existing company without row is unknown/unconfigured.
- company_assignments: company/responsibility composite primary key;
  account/seo/marketing/content; assignee FK to platform_admins. Phase A guarantees
  referenced identity exists, NOT active qualification. Phase B must validate and
  lock active admin/profile state transactionally. Assignment never grants access.
- private.provisioning_operations: scoped actor/type/idempotency uniqueness,
  32-byte fingerprint storage, pending/completed/failed consistency constraints.
  No raw payload. Error code is bounded uppercase machine-code text; actual
  operation error allowlist and fingerprint generation are deferred to Phase B.
  No status RPC, retention job, retry implementation or direct client access.

All new company FKs use RESTRICT. Actor/creator FKs use RESTRICT. No automatic
delete cascade or historical data fabrication. Timestamps default to now();
updated_at is not an automatic update trigger.

## Read/write boundary

The four new public tables ENABLE and FORCE RLS. authenticated receives SELECT
only. Each policy requires auth.uid(), AAL2, active platform_admin via the existing
predicate, AND the caller's active profile. Existing helpers are not changed.

PUBLIC, anon, authenticated and service_role privileges are explicitly revoked
before the narrow SELECT grant. No browser write policies. No new service-role
access. private.provisioning_operations ENABLE/FORCE RLS has no grants/policies
for these roles; existing private schema permissions are not broadened.

FORCE RLS does not constrain superusers/BYPASSRLS. Privileged local SQL fixtures
are not an application authorization path.

## TEMPORARY legacy boundaries — Phase B blockers

Phase A deliberately leaves companies grants and policies unchanged:

- "Admins can create companies" + authenticated INSERT is still a direct
  AAL2 active-platform-admin write path. It bypasses the FUTURE package/audit/
  idempotency operation. Phase B must remove it before New Customer V1 is complete.
- Broad legacy grants (including TRUNCATE) are not endorsed or fixed here.
- "Customers can read own company" still permits profiles.company_id-based reads.
  Removing it requires explicit access mapping, not guessed memberships.
- Existing admin-provision-company still has its old multi-step side effects.
  This schema migration does not repair, replace or expand it.

The RLS test explicitly demonstrates the two legacy paths so their presence is
not confused with a completed final write/read boundary.

## Verification

New transactional, rollback-only pgTAP files:
- supabase/tests/new_customer_v1_schema.sql
- supabase/tests/new_customer_v1_rls.sql

They cover constraints, all allowlisted values, nullable/zero-child behavior,
FKs, unique scopes, operation-state combinations, RLS/privileges, active and
inactive profiles/admins, private-table denial and known legacy paths.
No production fixtures or credentials are used.

At implementation time Docker's local socket was unavailable. pgTAP/migration
application/database lint could not be runtime-verified; Supabase CLI attempts
also encountered a sandbox-denied telemetry-file write. No production substitute
was used. These tests MUST run against the complete local migration chain before
any deployment. Existing JavaScript tests: 100 passed, 0 failed. Existing static
security scripts: 9 passed, 0 failed, including current dist artifact inspection
(no rebuild).

Authenticated local AAL2 Admin V2 runtime smoke testing remains pending and must
be completed before production deployment. Phase B+ is not implemented here.
