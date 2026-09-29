# P1 legacy provisioning retirement (local, not deployed)

`admin-provision-company` is a no-write tombstone. Registered configuration keeps
`verify_jwt=true`; a gateway-admitted request receives 410 with
`LEGACY_PROVISIONING_RETIRED`. Explicit preflights remain narrow; handler responses
use no-store and Vary: Origin. Gateway-generated responses need separate hosted
verification. The known local Kong mutation is not fixed here.

Admin no longer contains the combined project/account modal or invokes this
endpoint. New Customer V1 creates company data only. Website creation and portal
invitation are future separate trusted UI workflows; the existing create-customer
backend is not newly wired or changed by P1.

The tombstone is not a fallback. Future cutover must replace the deployed legacy
function as well as deploy the frontend: a frontend-only change cannot retire the
remote endpoint. Rollback must NOT automatically reactivate legacy provisioning.

The profiles.company_id read-policy/data-mapping gate remains unchanged.
Hosted CORS/JWT/cache canary and production verification remain required.
Handler tests do not prove real gateway JWT validation. No production deployment
or invitation is part of P1.
