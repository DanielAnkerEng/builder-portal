# Wreach Security V2

## Security invariants

1. **NO NORMAL PROTECTED SESSION BELOW AAL2.**
2. **NO AUTHORIZATION TRUSTS LOCALSTORAGE.**
3. **NO CUSTOMER MAY ACCESS ANOTHER COMPANY'S DATA.**
4. **SAVE CHANGES DRAFT ONLY.**
5. **SAVE DOES NOT REQUIRE PERSONAL SECURITY KEY.**
6. **PUBLISH REQUIRES PERSONAL SECURITY KEY.**
7. **PUBLIC WEBSITE READS PUBLISHED SNAPSHOT ONLY.**
8. **PUBLISH AUTHORIZATION AND PUBLICATION OCCUR SERVER-SIDE.**
9. **CRITICAL COMPANY OPERATIONS REQUIRE PERSONAL + COMPANY SECURITY KEY.**
10. **NO RAW SECURITY SECRET IS STORED.**
11. **NO CLIENT MAY READ SECURITY HASHES.**
12. **FULL AUDIT IS WREACH-ADMIN ONLY.**
13. **CUSTOMERS RECEIVE ONLY SANITIZED ACTIVITY.**

These are architectural requirements, not UI conventions. RLS, database functions, and authenticated Edge Functions must continue to enforce them when browser code is bypassed.

## Current implementation status

Security V2 is being introduced additively on `security-auth-upgrade`. The production application still contains a legacy browser-local account and website model. The authorization foundation migration creates individual profiles, trusted platform administrators, company memberships, AAL2-aware authorization helpers, and a human-reviewed backfill surface. It intentionally does not promote any existing user.

Production deployment is not authorized during this implementation phase.

## Secrets

- The Supabase publishable key may be present in browser code; it is not an authorization secret.
- Service-role/secret keys, database credentials, TOTP enrollment secrets, passwords, personal security keys, company security keys, and access/refresh tokens must never be committed or logged.
- Security keys will be stored only as salted pgcrypto/bcrypt hashes with algorithm/version and rotation/lockout metadata.

## Custom code boundary

The legacy builder can store custom HTML and JavaScript and currently renders it on the portal origin. This is unsafe. Security V2 will preserve the stored data but disable arbitrary JavaScript execution until an isolated origin or sandbox without access to Wreach cookies, localStorage, Supabase sessions, or portal DOM exists. HTML sanitization alone is not considered sufficient for arbitrary JavaScript.

## Reporting

Do not include secrets or production identifiers in issue reports. Record the affected component, expected security invariant, reproduction steps using local/test identities, and the relevant request correlation ID when available.

