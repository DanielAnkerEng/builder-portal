# Wreach Security V2 guardrails

These rules apply to the whole repository.

- Work only on `security-auth-upgrade` unless a human explicitly approves another branch.
- Never run `supabase db push`, deploy Edge Functions, alter production Auth users, or modify production data without separate human approval.
- Never merge to `main`, force-push, or rewrite Git history.
- All schema changes must be additive, versioned migrations under `supabase/migrations/` until a separately approved cleanup phase.
- Never guess platform administrator user IDs. Platform-admin backfill requires two human-confirmed Supabase Auth UUIDs.
- Never commit service-role keys, database credentials, security keys, TOTP secrets, access tokens, or `.env` files containing secrets.
- Browser state is untrusted. Authorization must derive from Supabase Auth and server-side database state.
- Normal protected access requires AAL2. Save writes draft only. Publish requires the authenticated user's personal security key. Critical company operations require personal and company security keys.
- Security-key verification and the protected action must occur in one trusted server-side operation.
- Public rendering may read only the active immutable publication.
- Full audit data is platform-admin only. Customer activity must be sanitized.
- Arbitrary custom JavaScript must not execute in the authenticated portal origin.
- Run local migrations and security tests before each security milestone commit. If Docker/local Supabase is unavailable, document that limitation and do not substitute production testing.

