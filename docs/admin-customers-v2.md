# Customers V2 — frontend review notes

## Authorization and data

`admin.js` still awaits `requireAal2({platformAdmin:true})` before mounting the shell or Customers. The new read-only loader runs on first entry to Customers. It uses the existing authenticated browser client, never a privileged key.

Existing repository schema evidence: `20260826130200_security_v2_content_credentials_audit.sql` defines the restrictive companies AAL2 SELECT policy and the member/platform-admin SELECT policy (lines 74–76). Existing websites policies likewise require AAL2 and authorized membership/platform administration. No policy or grant is changed. This is repository-based verification, not a fresh production inspection.

Reads are restricted to:
- `companies`: `id,name`
- `websites`: `id,company_id,name,public_slug,current_publication_id`

Both sources are read in ID order in pages of 500. A failed page invalidates the entire customer result, rather than returning partial counts. A defensive 100-page limit fails visibly. The two queries are not a transactional snapshot; concurrent changes may require a page reload. Data is held only in module memory for this page lifetime. Reload the page to refresh successful data; failed reads provide a retry action.

The list includes all returned companies, including internal/test companies if present. No customer lifecycle or account responsibility is inferred. Companies with zero websites remain visible. Websites are grouped by actual company UUID, never by name. Missing/unknown company references are counted in a notice and excluded from customer grouping; nothing is assigned or written. These websites remain available through the unchanged Dashboard data path where authorized.

## Routes and states

- `admin.html#customers`: list
- `admin.html#customer/<companyUuid>`: overview
- `admin.html#customer/<companyUuid>/<tab>`: customer workspace

UUIDs and tab names are validated. Tabs are: overview, websites, seo, marketing, content, leads, analytics, tasks, approvals, integrations, billing, activity. Only overview and websites have real content. Unknown UUIDs show unavailable; malformed routes show an error. Route values never authorize a user or trigger a route-specific database request. Browser visibility is not authorization; backend RLS and existing Builder/Edge Function guards remain authoritative.

Search is local, case-insensitive and whitespace-normalized. Norwegian ascending/descending name sorting and website publication filters operate on loaded company aggregates. Website publication is not customer lifecycle. Future lifecycle/service/responsibility controls and New Customer are disabled.

Loading, real data, empty, no-results, unavailable and error are distinct. Backend error details are neither shown nor logged by the new modules. Rendering uses DOM text nodes. Builder and live links reuse the existing project-row renderer; live requires publication ID and public slug.

## Verification boundary

The isolated `tests/fixtures/admin-customers.html#customers` fixture contains clearly labelled DEMO DATA, no Auth client and no backend access. Builder/live navigation is prevented there. It is excluded from production artifacts.

Authenticated local AAL2 Admin V2 runtime smoke test remains pending because local Docker/Supabase was unavailable. It must be completed before production deployment.

Before deployment, verify Customers and its direct-read RLS path with an existing authorized local test administrator, including companies with zero/multiple websites, denied sessions, and query failures. Presentation fixtures and unit tests do not substitute for this test. No new users, provisioning, publishing, security-key operations or production changes are part of this phase.
