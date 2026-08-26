drop extension if exists "pg_net";


  create table "public"."companies" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "name" text,
    "is_active" boolean not null default true
      );


alter table "public"."companies" enable row level security;


  create table "public"."company_security" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "company_id" uuid,
    "code_hash" text,
    "is_active" boolean default true
      );


alter table "public"."company_security" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "full_name" text,
    "role" text,
    "project_name" text,
    "email" text,
    "company_id" uuid
      );


alter table "public"."profiles" enable row level security;

CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id);

CREATE UNIQUE INDEX company_security_company_id_key ON public.company_security USING btree (company_id);

CREATE UNIQUE INDEX company_security_pkey ON public.company_security USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY using index "companies_pkey";

alter table "public"."company_security" add constraint "company_security_pkey" PRIMARY KEY using index "company_security_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."company_security" add constraint "company_security_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."company_security" validate constraint "company_security_company_id_fkey";

alter table "public"."company_security" add constraint "company_security_company_id_key" UNIQUE using index "company_security_company_id_key";

alter table "public"."profiles" add constraint "profiles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_company_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_company_security_code(p_company_id uuid, p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin

  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if length(p_code) < 12 then
    raise exception 'Security code must be at least 12 characters';
  end if;

  insert into public.company_security (
    company_id,
    code_hash,
    is_active
  )
  values (
    p_company_id,
    extensions.crypt(p_code, extensions.gen_salt('bf')),
    true
  )
  on conflict (company_id)
  do update set
    code_hash = extensions.crypt(p_code, extensions.gen_salt('bf')),
    is_active = true;

end;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_company_security_code(p_company_id uuid, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  stored_hash text;
  caller_company_id uuid;
begin

  -- Admin kan verifisere for alle selskaper
  if not public.is_admin() then

    select company_id
    into caller_company_id
    from public.profiles
    where id = auth.uid();

    -- Vanlig bruker får bare verifisere sitt eget selskap
    if caller_company_id is null or caller_company_id <> p_company_id then
      return false;
    end if;

  end if;

  select code_hash
  into stored_hash
  from public.company_security
  where company_id = p_company_id
    and is_active = true;

  if stored_hash is null then
    return false;
  end if;

  return extensions.crypt(p_code, stored_hash) = stored_hash;

end;
$function$
;

grant delete on table "public"."companies" to "anon";

grant insert on table "public"."companies" to "anon";

grant references on table "public"."companies" to "anon";

grant select on table "public"."companies" to "anon";

grant trigger on table "public"."companies" to "anon";

grant truncate on table "public"."companies" to "anon";

grant update on table "public"."companies" to "anon";

grant delete on table "public"."companies" to "authenticated";

grant insert on table "public"."companies" to "authenticated";

grant references on table "public"."companies" to "authenticated";

grant select on table "public"."companies" to "authenticated";

grant trigger on table "public"."companies" to "authenticated";

grant truncate on table "public"."companies" to "authenticated";

grant update on table "public"."companies" to "authenticated";

grant delete on table "public"."companies" to "service_role";

grant insert on table "public"."companies" to "service_role";

grant references on table "public"."companies" to "service_role";

grant select on table "public"."companies" to "service_role";

grant trigger on table "public"."companies" to "service_role";

grant truncate on table "public"."companies" to "service_role";

grant update on table "public"."companies" to "service_role";

grant delete on table "public"."company_security" to "anon";

grant insert on table "public"."company_security" to "anon";

grant references on table "public"."company_security" to "anon";

grant select on table "public"."company_security" to "anon";

grant trigger on table "public"."company_security" to "anon";

grant truncate on table "public"."company_security" to "anon";

grant update on table "public"."company_security" to "anon";

grant delete on table "public"."company_security" to "authenticated";

grant insert on table "public"."company_security" to "authenticated";

grant references on table "public"."company_security" to "authenticated";

grant select on table "public"."company_security" to "authenticated";

grant trigger on table "public"."company_security" to "authenticated";

grant truncate on table "public"."company_security" to "authenticated";

grant update on table "public"."company_security" to "authenticated";

grant delete on table "public"."company_security" to "service_role";

grant insert on table "public"."company_security" to "service_role";

grant references on table "public"."company_security" to "service_role";

grant select on table "public"."company_security" to "service_role";

grant trigger on table "public"."company_security" to "service_role";

grant truncate on table "public"."company_security" to "service_role";

grant update on table "public"."company_security" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";


  create policy "Admins can create companies"
  on "public"."companies"
  as permissive
  for insert
  to authenticated
with check (public.is_admin());



  create policy "Admins can read all companies"
  on "public"."companies"
  as permissive
  for select
  to authenticated
using (public.is_admin());



  create policy "Customers can read own company"
  on "public"."companies"
  as permissive
  for select
  to authenticated
using ((id = ( SELECT profiles.company_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "Admins can read all profiles"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (public.is_admin());



  create policy "Users can read own profile"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = id));



