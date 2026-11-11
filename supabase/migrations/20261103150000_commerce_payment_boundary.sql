-- Isolate historical simulation from Stripe; preserve every existing order and entitlement.
begin;
alter table public.commerce_stores add column payment_mode text not null default 'simulation'
  check(payment_mode in ('simulation','stripe_test'));
alter table public.commerce_stores add column stripe_account_id text;
alter table public.commerce_orders add column payment_provider text not null default 'simulation'
  check(payment_provider in ('simulation','stripe_test'));
update public.commerce_orders o set payment_provider=p.provider from public.commerce_payments p where p.order_id=o.id;

-- One entitlement identity can have independent payment proofs. Its original order is retained.
alter table public.commerce_payments add column payment_intent_id text unique;
create table public.commerce_entitlement_proofs (
  entitlement_id uuid not null references public.commerce_entitlements(id),
  order_id uuid not null references public.commerce_orders(id),
  provider text not null check(provider in ('simulation','stripe_test')),
  created_at timestamptz not null default now(), primary key(entitlement_id,provider), unique(order_id,entitlement_id)
);
alter table public.commerce_entitlement_proofs enable row level security;
alter table public.commerce_entitlement_proofs force row level security;
revoke all on public.commerce_entitlement_proofs from public,anon,authenticated;
grant all on public.commerce_entitlement_proofs to service_role;
insert into public.commerce_entitlement_proofs(entitlement_id,order_id,provider)
  select e.id,e.order_id,p.provider from public.commerce_entitlements e
  join public.commerce_payments p on p.order_id=e.order_id and p.status='paid'
  join public.commerce_orders o on o.id=e.order_id and o.status='paid' and o.buyer_id=e.buyer_id;

-- Called only after a read-only Stripe account preflight, using the private server credential.
create function public.commerce_activate_stripe_test(p_store uuid,p_account text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.commerce_stores;
begin
  select * into s from public.commerce_stores where id=p_store for update;
  if s.id is null or p_account is null or p_account !~ '^acct_[A-Za-z0-9]+$' then raise exception 'INVALID_TEST_ACCOUNT'; end if;
  if s.stripe_account_id is not null and s.stripe_account_id<>p_account then raise exception 'STRIPE_ACCOUNT_LOCKED'; end if;
  update public.commerce_stores set payment_mode='stripe_test',stripe_account_id=p_account where id=s.id;
end $$;
revoke all on function public.commerce_activate_stripe_test(uuid,text) from public,anon,authenticated;
grant execute on function public.commerce_activate_stripe_test(uuid,text) to service_role;

create or replace function public.commerce_reserve_order(p_store uuid,p_key uuid,p_cart jsonb) returns public.commerce_orders
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
  select * into s from public.commerce_stores where id=p_store and status='local_preview'
    and exists(select 1 from public.companies where id=company_id and is_active) for share;
  if s.id is null then raise exception 'STORE_UNAVAILABLE'; end if;
  select * into o from public.commerce_orders where buyer_id=auth.uid() and store_id=p_store and request_key=p_key;
  if found then
    if o.payment_provider<>s.payment_mode then raise exception 'PAYMENT_MODE_CONFLICT'; end if;
    if o.status='pending' and exists(select 1 from public.commerce_order_items item_row join public.commerce_products catalog_product on catalog_product.id=item_row.product_id where item_row.order_id=o.id and not catalog_product.active) then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if o.cart<>normalized then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return o;
  end if;
  for i in select value from jsonb_array_elements(normalized) loop
    select * into p from public.commerce_products where id=(i->>'product_id')::uuid and store_id=s.id and active for share;
    if p.id is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    qty:=(i->>'quantity')::integer;
    if p.kind='digital' and qty<>1 then raise exception 'DIGITAL_QUANTITY'; end if;
    if p.kind='digital' and exists(select 1 from public.commerce_entitlements e join public.commerce_entitlement_proofs proof on proof.entitlement_id=e.id where e.buyer_id=auth.uid() and e.product_id=p.id and e.active and proof.provider=s.payment_mode) then raise exception 'ALREADY_OWNED'; end if;
    total:=total+p.unit_amount*qty; physical:=physical or p.kind='physical';
  end loop;
  -- Same cart in flight cannot create a second order, even with a new browser request key.
  select * into o from public.commerce_orders where buyer_id=auth.uid() and store_id=p_store and cart=normalized and status='pending' and payment_provider=s.payment_mode
    order by created_at desc limit 1;
  if found then return o; end if;
  insert into public.commerce_orders(store_id,company_id,buyer_id,request_key,cart,total,fulfillment,payment_provider)
    values(s.id,s.company_id,auth.uid(),p_key,normalized,total,case when physical then 'awaiting_payment' else 'not_required' end,s.payment_mode) returning * into o;
  insert into public.commerce_order_items(order_id,store_id,company_id,product_id,name,kind,game_key,quantity,unit_amount)
    select o.id,s.id,s.company_id,product.id,product.name,product.kind,product.game_key,(cart_item->>'quantity')::integer,product.unit_amount
    from jsonb_array_elements(normalized) cart_item join public.commerce_products product on product.id=(cart_item->>'product_id')::uuid;
  return o;
end $$;

create or replace function public.commerce_bind_payment(p_order uuid,p_session text,p_provider text) returns void
language plpgsql security definer set search_path='' as $$
declare existing public.commerce_payments; o public.commerce_orders; s public.commerce_stores;
begin
  select * into o from public.commerce_orders where id=p_order for update;
  select * into s from public.commerce_stores where id=o.store_id for share;
  if o.id is null or p_provider is null or p_provider<>o.payment_provider or p_provider<>s.payment_mode or p_session is null or p_session !~ '^cs_test_' or p_provider not in ('stripe_test','simulation') then raise exception 'INVALID_PAYMENT'; end if;
  select * into existing from public.commerce_payments where order_id=p_order;
  if found and (existing.session_id<>p_session or existing.provider<>p_provider) then raise exception 'PAYMENT_CONFLICT'; end if;
  insert into public.commerce_payments(order_id,session_id,provider) values(p_order,p_session,p_provider) on conflict(order_id) do nothing;
end $$;

create or replace function public.commerce_apply_payment(p_event text,p_order uuid,p_session text,p_provider text,p_status text,p_amount integer,p_currency text,p_company uuid,p_buyer uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.commerce_orders; payment public.commerce_payments;
begin
  select * into o from public.commerce_orders where id=p_order for update;
  if p_status is null or p_amount is null or p_currency is null or p_company is null or p_buyer is null or o.id is null or o.total<>p_amount or o.currency<>p_currency or o.company_id<>p_company or o.buyer_id<>p_buyer
    or p_status not in ('pending','paid','failed','expired') or p_event is null or length(p_event) not between 1 and 200 then raise exception 'PAYMENT_MISMATCH'; end if;
  perform public.commerce_bind_payment(p_order,p_session,p_provider);
  if exists(select 1 from public.commerce_payment_events where event_id=p_event) then
    if not exists(select 1 from public.commerce_payment_events where event_id=p_event and order_id=p_order and provider=p_provider) then raise exception 'EVENT_CONFLICT'; end if;
    return false;
  end if;
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
    insert into public.commerce_entitlement_proofs(entitlement_id,order_id,provider)
      select e.id,o.id,p_provider from public.commerce_order_items i
      join public.commerce_entitlements e on e.buyer_id=o.buyer_id and e.product_id=i.product_id
      where i.order_id=o.id and i.kind='digital'
      on conflict(entitlement_id,provider) do nothing;
  end if;
  return true;
end $$;

-- Persist the validated PaymentIntent and its order transition in one transaction.
create function public.commerce_record_payment(p_event text,p_order uuid,p_session text,p_provider text,p_status text,p_amount integer,p_currency text,p_company uuid,p_buyer uuid,p_intent text) returns boolean
language plpgsql security definer set search_path='' as $$
declare existing text;
begin
  perform public.commerce_bind_payment(p_order,p_session,p_provider);
  if p_status='paid' and (p_intent is null or p_intent !~ '^pi_') then raise exception 'PAYMENT_INTENT_REQUIRED'; end if;
  select payment_intent_id into existing from public.commerce_payments where order_id=p_order;
  if p_intent is not null then
    if p_intent !~ '^pi_' or (existing is not null and existing<>p_intent) then raise exception 'PAYMENT_INTENT_CONFLICT'; end if;
    update public.commerce_payments set payment_intent_id=p_intent where order_id=p_order;
  end if;
  return public.commerce_apply_payment(p_event,p_order,p_session,p_provider,p_status,p_amount,p_currency,p_company,p_buyer);
end $$;
revoke all on function public.commerce_apply_payment(text,uuid,text,text,text,integer,text,uuid,uuid) from service_role;
revoke all on function public.commerce_record_payment(text,uuid,text,text,text,integer,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.commerce_record_payment(text,uuid,text,text,text,integer,text,uuid,uuid,text) to service_role;
notify pgrst, 'reload schema';
commit;
