-- Additive, local pilot only. No publishing, customer onboarding or legacy ACL changes.
begin;
alter table public.websites add constraint websites_company_identity unique(company_id,id);
create table public.commerce_stores (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  website_id uuid not null unique, slug text not null unique check(slug ~ '^[a-z0-9-]{1,60}$'),
  name text not null, status text not null default 'local_preview' check(status in ('local_preview','disabled')),
  created_at timestamptz not null default now(), unique(id,company_id),
  foreign key(company_id,website_id) references public.websites(company_id,id)
);
create table public.commerce_products (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, company_id uuid not null,
  name text not null check(length(btrim(name)) between 1 and 120), description text not null check(length(description)<=3000),
  kind text not null check(kind in ('digital','physical')), game_key text,
  unit_amount integer not null check(unit_amount between 100 and 1000000), currency text not null default 'nok' check(currency='nok'),
  active boolean not null default true, revision integer not null default 1, updated_at timestamptz not null default now(),
  check((kind='digital' and game_key='bli-stogg-classic') or (kind='physical' and game_key is null)),
  foreign key(store_id,company_id) references public.commerce_stores(id,company_id), unique(id,store_id,company_id)
);
create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, company_id uuid not null,
  buyer_id uuid not null references auth.users(id), request_key uuid not null, cart jsonb not null,
  total integer not null check(total>0), currency text not null default 'nok' check(currency='nok'),
  status text not null default 'pending' check(status in ('pending','paid','failed','expired')),
  fulfillment text not null check(fulfillment in ('not_required','awaiting_payment','test_only_not_shipped')),
  created_at timestamptz not null default now(), paid_at timestamptz,
  foreign key(store_id,company_id) references public.commerce_stores(id,company_id),
  unique(buyer_id,store_id,request_key), unique(id,store_id,company_id)
);
create table public.commerce_order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null, store_id uuid not null, company_id uuid not null,
  product_id uuid not null, name text not null, kind text not null check(kind in ('digital','physical')), game_key text,
  quantity integer not null check(quantity between 1 and 10), unit_amount integer not null check(unit_amount>0),
  foreign key(order_id,store_id,company_id) references public.commerce_orders(id,store_id,company_id),
  foreign key(product_id,store_id,company_id) references public.commerce_products(id,store_id,company_id),
  unique(order_id,product_id)
);
create table public.commerce_payments (
  order_id uuid primary key references public.commerce_orders(id), session_id text unique,
  status text not null default 'pending' check(status in ('pending','paid','failed','expired')),
  provider text not null check(provider in ('stripe_test','simulation')), updated_at timestamptz not null default now()
);
create table public.commerce_entitlements (
  id uuid primary key default gen_random_uuid(), buyer_id uuid not null references auth.users(id),
  product_id uuid not null references public.commerce_products(id), order_id uuid not null references public.commerce_orders(id),
  active boolean not null default true, created_at timestamptz not null default now(), unique(buyer_id,product_id)
);
create table public.commerce_game_sessions (
  id uuid primary key default gen_random_uuid(), entitlement_id uuid not null references public.commerce_entitlements(id),
  buyer_id uuid not null references auth.users(id), players jsonb not null, deck jsonb not null,
  position integer not null default 0, version integer not null default 1, skipped integer not null default 0, ended_early boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.commerce_payment_events (
  event_id text primary key, order_id uuid not null references public.commerce_orders(id),
  provider text not null, status text not null, created_at timestamptz not null default now()
);

create function public.commerce_can_manage(p_company uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_aal2() and exists(select 1 from public.profiles where id=auth.uid() and status='active')
  and exists(select 1 from public.companies where id=p_company and is_active)
  and (public.is_platform_admin() or public.has_company_role(p_company,array['owner','company_admin','editor']));
$$;

do $$ declare t text; begin
  foreach t in array array['commerce_stores','commerce_products','commerce_orders','commerce_order_items',
    'commerce_payments','commerce_entitlements','commerce_game_sessions','commerce_payment_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant select on public.commerce_stores,public.commerce_products,public.commerce_orders,public.commerce_order_items,
  public.commerce_payments,public.commerce_entitlements to authenticated;
create policy commerce_store_admin on public.commerce_stores for select to authenticated using(public.commerce_can_manage(company_id));
create policy commerce_product_admin on public.commerce_products for select to authenticated using(public.commerce_can_manage(company_id));
create policy commerce_order_read on public.commerce_orders for select to authenticated using(buyer_id=auth.uid() or public.commerce_can_manage(company_id));
create policy commerce_item_read on public.commerce_order_items for select to authenticated using(exists(select 1 from public.commerce_orders o where o.id=order_id));
create policy commerce_payment_read on public.commerce_payments for select to authenticated using(exists(select 1 from public.commerce_orders o where o.id=order_id));
create policy commerce_entitlement_read on public.commerce_entitlements for select to authenticated using(buyer_id=auth.uid());

create function public.commerce_create_store(p_company uuid,p_name text,p_slug text,p_content jsonb) returns public.commerce_stores
language plpgsql security definer set search_path='' as $$
declare w uuid; s public.commerce_stores;
begin
  if not public.commerce_can_manage(p_company) or not public.is_platform_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if length(btrim(p_name)) not between 1 and 160 then raise exception 'INVALID_NAME'; end if;
  perform private.require_valid_site_content(p_content);
  perform pg_advisory_xact_lock(hashtextextended(p_slug,0));
  select * into s from public.commerce_stores where slug=p_slug;
  if found then
    if s.company_id<>p_company then raise exception 'STORE_CONFLICT'; end if;
    return s;
  end if;
  insert into public.websites(company_id,name,public_slug,created_by) values(p_company,p_name,p_slug,auth.uid()) returning id into w;
  insert into public.website_drafts(website_id,content,updated_by) values(w,p_content,auth.uid());
  insert into public.commerce_stores(company_id,website_id,slug,name) values(p_company,w,p_slug,p_name) returning * into s;
  insert into public.audit_events(actor_user_id,company_id,event_type,result,target_type,target_id,authorization_requirements,request_correlation_id)
    values(auth.uid(),p_company,'commerce.store.create','success','website',w,array['aal2','platform_admin'],gen_random_uuid());
  return s;
end $$;

create function public.commerce_save_product(p_store uuid,p_product uuid,p_revision integer,p_data jsonb) returns public.commerce_products
language plpgsql security definer set search_path='' as $$
declare s public.commerce_stores; p public.commerce_products;
begin
  select * into s from public.commerce_stores where id=p_store;
  if s.id is null or not public.commerce_can_manage(s.company_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if jsonb_typeof(p_data)<>'object' or p_data-array['name','description','kind','game_key','unit_amount','active']<>'{}'::jsonb
    or not p_data ?& array['name','description','kind','unit_amount','active'] or jsonb_typeof(p_data->'active')<>'boolean'
    or jsonb_typeof(p_data->'name')<>'string' or jsonb_typeof(p_data->'description')<>'string'
    or (p_data->>'unit_amount') !~ '^[0-9]{3,7}$' then raise exception 'INVALID_PRODUCT'; end if;
  if p_product is null then
    insert into public.commerce_products(store_id,company_id,name,description,kind,game_key,unit_amount,active)
    values(s.id,s.company_id,p_data->>'name',p_data->>'description',p_data->>'kind',p_data->>'game_key',(p_data->>'unit_amount')::integer,(p_data->>'active')::boolean) returning * into p;
  else
    select * into p from public.commerce_products where id=p_product and store_id=p_store for update;
    if p.id is null or p.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
    if p.kind<>p_data->>'kind' or p.game_key is distinct from p_data->>'game_key' then raise exception 'PRODUCT_TYPE_IMMUTABLE'; end if;
    update public.commerce_products set name=p_data->>'name',description=p_data->>'description',unit_amount=(p_data->>'unit_amount')::integer,
      active=(p_data->>'active')::boolean,revision=revision+1,updated_at=now() where id=p.id returning * into p;
  end if;
  insert into public.audit_events(actor_user_id,company_id,event_type,result,target_type,target_id,authorization_requirements,request_correlation_id)
    values(auth.uid(),s.company_id,'commerce.product.save','success','product',p.id,array['aal2','company_editor'],gen_random_uuid());
  return p;
end $$;

create function public.commerce_reserve_order(p_store uuid,p_key uuid,p_cart jsonb) returns public.commerce_orders
language plpgsql security definer set search_path='' as $$
declare s public.commerce_stores; o public.commerce_orders; p public.commerce_products; i jsonb; normalized jsonb; total integer:=0; qty integer; physical boolean:=false;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and is_anonymous=false)
    then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_key is null or p_cart is null or jsonb_typeof(p_cart)<>'array' or jsonb_array_length(p_cart) not between 1 and 20 then raise exception 'INVALID_CART'; end if;
  for i in select value from jsonb_array_elements(p_cart) loop
    if jsonb_typeof(i)<>'object' or i-array['product_id','quantity']<>'{}'::jsonb or not i ?& array['product_id','quantity']
      or jsonb_typeof(i->'quantity')<>'number' or (i->>'quantity') !~ '^(10|[1-9])$'
      or (i->>'product_id') !~ '^[0-9a-f-]{36}$' then raise exception 'INVALID_CART'; end if;
  end loop;
  if (select count(*)<>count(distinct value->>'product_id') from jsonb_array_elements(p_cart)) then raise exception 'DUPLICATE_PRODUCT'; end if;
  select jsonb_agg(value order by value->>'product_id') into normalized from jsonb_array_elements(p_cart);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_store::text,0));
  select * into o from public.commerce_orders where buyer_id=auth.uid() and store_id=p_store and request_key=p_key;
  if found then
    if o.cart<>normalized then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return o;
  end if;
  select * into s from public.commerce_stores where id=p_store and status='local_preview'
    and exists(select 1 from public.companies where id=company_id and is_active);
  if s.id is null then raise exception 'STORE_UNAVAILABLE'; end if;
  for i in select value from jsonb_array_elements(normalized) loop
    select * into p from public.commerce_products where id=(i->>'product_id')::uuid and store_id=s.id and active for share;
    if p.id is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    qty:=(i->>'quantity')::integer;
    if p.kind='digital' and qty<>1 then raise exception 'DIGITAL_QUANTITY'; end if;
    if p.kind='digital' and exists(select 1 from public.commerce_entitlements where buyer_id=auth.uid() and product_id=p.id and active) then raise exception 'ALREADY_OWNED'; end if;
    total:=total+p.unit_amount*qty; physical:=physical or p.kind='physical';
  end loop;
  -- Same cart in flight cannot create a second order, even with a new browser request key.
  select * into o from public.commerce_orders where buyer_id=auth.uid() and store_id=p_store and cart=normalized and status='pending'
    order by created_at desc limit 1;
  if found then return o; end if;
  insert into public.commerce_orders(store_id,company_id,buyer_id,request_key,cart,total,fulfillment)
    values(s.id,s.company_id,auth.uid(),p_key,normalized,total,case when physical then 'awaiting_payment' else 'not_required' end) returning * into o;
  insert into public.commerce_order_items(order_id,store_id,company_id,product_id,name,kind,game_key,quantity,unit_amount)
    select o.id,s.id,s.company_id,product.id,product.name,product.kind,product.game_key,(cart_item->>'quantity')::integer,product.unit_amount
    from jsonb_array_elements(normalized) cart_item join public.commerce_products product on product.id=(cart_item->>'product_id')::uuid;
  return o;
end $$;

create function public.commerce_bind_payment(p_order uuid,p_session text,p_provider text) returns void
language plpgsql security definer set search_path='' as $$
declare existing public.commerce_payments;
begin
  perform 1 from public.commerce_orders where id=p_order for update;
  if not found or p_session !~ '^cs_test_' or p_provider not in ('stripe_test','simulation') then raise exception 'INVALID_PAYMENT'; end if;
  select * into existing from public.commerce_payments where order_id=p_order;
  if found and (existing.session_id<>p_session or existing.provider<>p_provider) then raise exception 'PAYMENT_CONFLICT'; end if;
  insert into public.commerce_payments(order_id,session_id,provider) values(p_order,p_session,p_provider) on conflict(order_id) do nothing;
end $$;

create function public.commerce_apply_payment(p_event text,p_order uuid,p_session text,p_provider text,p_status text,p_amount integer,p_currency text,p_company uuid,p_buyer uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.commerce_orders; payment public.commerce_payments;
begin
  select * into o from public.commerce_orders where id=p_order for update;
  if o.id is null or o.total<>p_amount or o.currency<>p_currency or o.company_id<>p_company or o.buyer_id<>p_buyer
    or p_status not in ('pending','paid','failed','expired') or p_event is null or length(p_event)>200 then raise exception 'PAYMENT_MISMATCH'; end if;
  perform public.commerce_bind_payment(p_order,p_session,p_provider);
  if exists(select 1 from public.commerce_payment_events where event_id=p_event) then return false; end if;
  insert into public.commerce_payment_events(event_id,order_id,provider,status) values(p_event,p_order,p_provider,p_status);
  -- A late failure or unpaid completion never revokes a confirmed payment.
  if o.status='paid' then return false; end if;
  if p_status='pending' and o.status in ('failed','expired') then return false; end if;
  update public.commerce_payments set status=p_status,updated_at=now() where order_id=o.id;
  update public.commerce_orders set status=p_status,paid_at=case when p_status='paid' then now() else null end,
    fulfillment=case when p_status='paid' and fulfillment='awaiting_payment' then 'test_only_not_shipped' else fulfillment end where id=o.id;
  if p_status='paid' then
    insert into public.commerce_entitlements(buyer_id,product_id,order_id)
      select o.buyer_id,product_id,o.id from public.commerce_order_items where order_id=o.id and kind='digital'
      on conflict(buyer_id,product_id) do nothing;
  end if;
  return true;
end $$;

revoke all on function public.commerce_can_manage(uuid),public.commerce_create_store(uuid,text,text,jsonb),
  public.commerce_save_product(uuid,uuid,integer,jsonb),public.commerce_reserve_order(uuid,uuid,jsonb),
  public.commerce_bind_payment(uuid,text,text),public.commerce_apply_payment(text,uuid,text,text,text,integer,text,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.commerce_can_manage(uuid),public.commerce_create_store(uuid,text,text,jsonb),
  public.commerce_save_product(uuid,uuid,integer,jsonb),public.commerce_reserve_order(uuid,uuid,jsonb) to authenticated;
grant execute on function public.commerce_bind_payment(uuid,text,text),public.commerce_apply_payment(text,uuid,text,text,text,integer,text,uuid,uuid) to service_role;
commit;
