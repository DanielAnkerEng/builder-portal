# Wreach Security V2 architecture

## Trust boundaries

The browser is untrusted. It may request actions but may not assert a user ID, platform role, company membership, security-key verification, or publication state. Trusted identity is `auth.uid()` from a validated Supabase user JWT. Protected access requires the JWT `aal` claim to be `aal2`.

The database is authoritative for platform administrators, company memberships, permissions, drafts, publications, credential hashes, and audit events. Edge Functions validate user JWTs and coordinate sensitive operations. Service-role access is limited to the smallest required operation.

## Identity model

- `profiles`: one row per Supabase Auth user; display identity only.
- `platform_admins`: trusted Wreach-wide privilege, separate from legacy `profiles.role`.
- `company_memberships`: many-to-many user/company membership with an explicit role and lifecycle state.
- One person has one Auth identity, one TOTP configuration, one personal security key, and immutable audit attribution.

No migration may infer the two initial platform administrators from an email address, username, or legacy role without human confirmation of the exact Auth UUIDs.

## Authorization helpers

- `is_aal2()` checks the authenticated JWT assurance level.
- `is_platform_admin()` requires AAL2 and an active `platform_admins` row.
- `is_active_company_member(company_id)` requires AAL2 and active membership.
- `has_company_role(company_id, roles)` requires AAL2, active membership, and an allowlisted role.

The helpers are `SECURITY DEFINER` only where protected membership lookup is required, have an empty `search_path`, and are not executable by anonymous users.

## Backfill gate

The confirmed backfill migration records the two explicitly approved platform administrators. A company with exactly one valid legacy `profiles.company_id` link receives an owner membership. The migration aborts instead of guessing when a company has multiple linked profiles or a non-platform profile lacks a valid company. Legacy role and company columns remain in place for compatibility. Production execution still requires a separate review and approval.

## Target request rules

| Operation | Required controls |
|---|---|
| Protected portal access | Password + verified TOTP, AAL2 |
| Edit | AAL2 + company membership |
| Save draft | AAL2 + editor-or-higher role |
| Publish | AAL2 + publisher role + actor's personal security key |
| Critical company action | AAL2 + privileged company role + personal key + company key |

Saving modifies private draft state only. Publishing creates an immutable snapshot, changes the active publication, and writes an audit event in one database transaction. Failure leaves the previous publication active.

## Audit privacy

Internal audit events contain actor, company, time, event, result, target, required authorization controls, correlation ID, and allowlisted metadata. Raw IP addresses are not stored by default. Full audit is visible only to active AAL2 platform administrators. Customers receive a separate sanitized activity projection without internal UUIDs, MFA/key diagnostics, network data, or request IDs.

`get_customer_activity` derives the caller from the AAL2 JWT, checks company membership server-side, exposes only allowlisted successful business events, and returns only timestamp, display name, human-readable action, and an optional safe resource name.

## Local verification

- pgTAP covers AAL1 rejection, role restrictions, cross-company access, draft/public separation, credential isolation, stale revisions, wrong-key failures, atomic publication, audit privacy, and anonymous public reads.
- Static checks reject browser-local auth state, demo credentials, service-role secrets, and `document.write` in active frontend files.
- Every Edge Function compiles locally and rejects missing or invalid user sessions.

## Deployment boundary

Local implementation may create migrations, Edge Functions, tests, commits, and branch pushes. It must not push the linked production database, deploy production Edge Functions, modify production Auth users/data, merge to `main`, or perform destructive migrations without separate approval.
