# P2: stored company access mapping

This audit is not a claim about live sessions or current runtime access. It
reports structural relationships only. No remediation is automatic.

## Local use and safety

Run `node scripts/audit-company-access-mapping.mjs` from the repository.
No arguments/connection strings are accepted. The fixed local Docker socket and
`supabase_db_webbyra-demo-github` are used; container identity/running state is
checked. psql ignores startup files (-X). A repeatable-read READ ONLY transaction,
statement timeout and ROLLBACK protect the SELECT-only extraction. No HTTP keys,
Auth API, writes or schema changes. CLI errors with raw diagnostics are withheld.
Default output includes UUIDs/statuses only, never names/emails/Auth metadata.
UUIDs remain sensitive mapping identifiers: keep the report internal.

## Classification and decisions

Primary category precedence: INVALID_PROFILE_COMPANY, BOTH_MATCH, BOTH_MISMATCH,
LEGACY_ONLY for non-null links; MEMBERSHIP_ONLY or NEITHER for null links.
Additional flags identify non-active matching memberships (including invited),
multiple active memberships, inactive/missing profiles, active/inactive admins,
invalid membership references and unexpected status/duplicate relationships.
Active admin is an independent flag, never a reason to hide a legacy mismatch.

| Evidence | Future human decision |
|---|---|
| BOTH_MATCH | Candidate for independence from legacy policy, after runtime tests |
| LEGACY_ONLY | Explicitly decide intended membership or intended removal of access |
| BOTH_MISMATCH | Investigate each user/company pair; do not guess |
| Non-active membership + legacy link | Security-sensitive review; never auto-backfill |
| INVALID_PROFILE_COMPANY | Resolve evidence/FK state before removal |
| MEMBERSHIP_ONLY | Usually compatible; verify runtime access |
| NEITHER | Review intended access; do not invent companies |
| PLATFORM_ADMIN | Separate platform access; do not manufacture memberships |
| Inactive profile / multiple memberships | Review status and all company relationships |

## Current policy source of truth

20260826121540_remote_schema.sql: permissive SELECT policies
"Customers can read own company" (profile.company_id = company.id) and
"Admins can read all companies" (is_admin()).
20260826130100_security_v2_confirmed_identity_backfill.sql: is_admin delegates to
is_platform_admin.
20260826130200_security_v2_content_credentials_audit.sql: permissive
"Security V2 members read companies" uses is_active_company_member(id) OR
is_platform_admin(); restrictive "Security V2 companies require AAL2" uses is_aal2().
Helpers defined in 20260826130000_security_v2_authorization_foundation.sql check
AAL2 plus active membership/active platform admin. They do not themselves require
an active profile. Profile SELECT has its own restrictive AAL2 policy.
Effective company SELECT shape, subject to grants/profile visibility:
AAL2 AND (legacy profile link OR active membership OR active platform admin).
Inactive profile flags are review evidence, not proof that SQL denies access.
supabase/tests/new_customer_v1_rls.sql explicitly preserves legacy-only read.

## Later production gate (NOT implemented)

Separate explicit approval and a separately reviewed connection mechanism are
required. Execute the same minimal SELECT projection in a read-only consistent
snapshot; record deployed policy/helper definitions and grants too. Do not use
this local CLI with a substituted host. Production credentials/config are not
part of P2. Map legacy-only/matching/mismatched/revoked/invalid/admin/inactive and
multi-membership cases. Resolve every intended-access decision explicitly and
re-audit immediately before the policy change. Local fixtures are not production
truth. No memberships, Auth identities or policies may be changed by the audit.

## Future migration design only

After approved mapping and access tests, a new versioned migration would DROP
only "Customers can read own company" on public.companies. Keep company_id,
all unrelated policies, the membership/admin policy and restrictive AAL2 gate.
Tests must cover AAL1 denial, matching/member-only access, company isolation,
legacy-only and mismatch denial after removal, revoked membership denial,
multiple memberships, inactive profiles and active/inactive platform admins.
Expected inactive-profile behavior must be explicitly reviewed, not invented.
No policy-removal migration is created by P2. Rollback must not casually restore
revoked access; prefer reviewed mapping correction and forward-fix.
