-- Buyer reservations and optimistic product updates. Existing rows and grants are preserved.
begin;

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
  -- The buyer/store lock also covers payment transitions. A cancelled return,
  -- a missing session response or an old timestamp cannot release a payable order.
  select pending.* into o
    from public.commerce_orders pending
    where pending.buyer_id = auth.uid() and pending.store_id = s.id
      and pending.payment_provider = s.payment_mode and pending.status = 'pending'
      and exists (
        select 1 from public.commerce_order_items item
        join jsonb_array_elements(normalized) requested
          on item.product_id = (requested->>'product_id')::uuid
        where item.order_id = pending.id and item.kind = 'digital'
      )
    order by pending.created_at, pending.id limit 1;
  if found then
    raise exception using message = 'OPEN_DIGITAL_ORDER', detail = o.id::text;
  end if;

  insert into public.commerce_orders(store_id,company_id,buyer_id,request_key,cart,total,fulfillment,payment_provider)
    values(s.id,s.company_id,auth.uid(),p_key,normalized,total,case when physical then 'awaiting_payment' else 'not_required' end,s.payment_mode) returning * into o;
  insert into public.commerce_order_items(order_id,store_id,company_id,product_id,name,kind,game_key,quantity,unit_amount)
    select o.id,s.id,s.company_id,product.id,product.name,product.kind,product.game_key,(cart_item->>'quantity')::integer,product.unit_amount
    from jsonb_array_elements(normalized) cart_item join public.commerce_products product on product.id=(cart_item->>'product_id')::uuid;
  return o;
end $$;

-- The HTTP checkout path requires this migration even when a server is
-- upgraded before its local database. Older direct RPC callers keep their ACLs.
create or replace function public.commerce_reserve_checkout(p_store uuid, p_key uuid, p_cart jsonb)
returns public.commerce_orders language sql security invoker set search_path='' as $$
  select * from public.commerce_reserve_order(p_store,p_key,p_cart);
$$;
revoke all on function public.commerce_reserve_checkout(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.commerce_reserve_checkout(uuid,uuid,jsonb) to authenticated;

create or replace function public.commerce_record_payment(p_event text,p_order uuid,p_session text,p_provider text,p_status text,p_amount integer,p_currency text,p_company uuid,p_buyer uuid,p_intent text) returns boolean
language plpgsql security definer set search_path='' as $$
declare existing text;
begin
  -- Acquire the same lock, in the same order, as commerce_reserve_order.
  perform pg_advisory_xact_lock(hashtextextended(o.buyer_id::text || o.store_id::text, 0))
    from public.commerce_orders o where o.id = p_order;
  perform public.commerce_bind_payment(p_order,p_session,p_provider);
  if p_status='paid' and (p_intent is null or p_intent !~ '^pi_') then raise exception 'PAYMENT_INTENT_REQUIRED'; end if;
  select payment_intent_id into existing from public.commerce_payments where order_id=p_order;
  if p_intent is not null then
    if p_intent !~ '^pi_' or (existing is not null and existing<>p_intent) then raise exception 'PAYMENT_INTENT_CONFLICT'; end if;
    update public.commerce_payments set payment_intent_id=p_intent where order_id=p_order;
  end if;
  return public.commerce_apply_payment(p_event,p_order,p_session,p_provider,p_status,p_amount,p_currency,p_company,p_buyer);
end $$;

create or replace function public.commerce_save_product(p_store uuid,p_product uuid,p_revision integer,p_data jsonb) returns public.commerce_products
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
    if p.id is null or p_revision is null or p_revision < 1 or p.revision is distinct from p_revision then raise exception 'REVISION_CONFLICT'; end if;
    if p.kind<>p_data->>'kind' or p.game_key is distinct from p_data->>'game_key' then raise exception 'PRODUCT_TYPE_IMMUTABLE'; end if;
    update public.commerce_products set name=p_data->>'name',description=p_data->>'description',unit_amount=(p_data->>'unit_amount')::integer,
      active=(p_data->>'active')::boolean,revision=revision+1,updated_at=now() where id=p.id returning * into p;
  end if;
  insert into public.audit_events(actor_user_id,company_id,event_type,result,target_type,target_id,authorization_requirements,request_correlation_id)
    values(auth.uid(),s.company_id,'commerce.product.save','success','product',p.id,array['aal2','company_editor'],gen_random_uuid());
  return p;
end $$;

notify pgrst, 'reload schema';
commit;
