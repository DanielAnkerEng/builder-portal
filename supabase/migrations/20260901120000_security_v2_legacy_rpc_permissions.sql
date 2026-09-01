-- Close legacy browser-callable company-key paths. Security V2 trusted RPCs
-- and the RLS event-trigger function itself remain unchanged.

revoke all on function public.set_company_security_code(uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function public.verify_company_security_code(uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function public.rls_auto_enable()
  from public, anon, authenticated;
