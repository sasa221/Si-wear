-- S! Wear - Place Order Security Hardening
-- Run this in Supabase SQL Editor.
-- Non-destructive: creates/replaces one RPC function and changes execute permissions only.
-- Existing orders, order_items, products, variants, stock, notifications, users, and profiles are preserved.

-- 1) Inspect current RPC definitions and grants.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
  exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) as public_can_execute,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'place_order_with_items'
order by arguments;

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text,
  slug text,
  category text,
  price_egp int,
  description text default '',
  images jsonb default '[]'::jsonb,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.products add column if not exists name text;
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists price_egp int;
alter table public.products add column if not exists description text default '';
alter table public.products add column if not exists images jsonb default '[]'::jsonb;
alter table public.products add column if not exists status text default 'active';
alter table public.products add column if not exists created_at timestamptz default now();

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  size text,
  color text,
  stock int4 default 0,
  sku text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.product_variants add column if not exists product_id uuid references public.products(id) on delete cascade;
alter table public.product_variants add column if not exists size text;
alter table public.product_variants add column if not exists color text;
alter table public.product_variants add column if not exists stock int4 default 0;
alter table public.product_variants add column if not exists sku text;
alter table public.product_variants add column if not exists active boolean default true;
alter table public.product_variants add column if not exists created_at timestamptz default now();

create index if not exists products_status_idx on public.products(status);
create index if not exists product_variants_product_id_idx on public.product_variants(product_id);
create index if not exists product_variants_lookup_idx on public.product_variants(product_id, color, size);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null,
  discount_value int not null,
  minimum_order_egp int default 0,
  usage_limit int,
  used_count int default 0,
  expires_at timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.discount_codes add column if not exists code text;
alter table public.discount_codes add column if not exists discount_type text;
alter table public.discount_codes add column if not exists discount_value int;
alter table public.discount_codes add column if not exists minimum_order_egp int default 0;
alter table public.discount_codes add column if not exists usage_limit int;
alter table public.discount_codes add column if not exists used_count int default 0;
alter table public.discount_codes add column if not exists expires_at timestamptz;
alter table public.discount_codes add column if not exists active boolean default true;
alter table public.discount_codes add column if not exists created_at timestamptz default now();

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  governorate text not null,
  city_area text,
  delivery_fee_egp int not null,
  free_shipping_min_egp int,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.shipping_zones add column if not exists governorate text;
alter table public.shipping_zones add column if not exists city_area text;
alter table public.shipping_zones add column if not exists delivery_fee_egp int;
alter table public.shipping_zones add column if not exists free_shipping_min_egp int;
alter table public.shipping_zones add column if not exists active boolean default true;
alter table public.shipping_zones add column if not exists created_at timestamptz default now();

create index if not exists discount_codes_code_idx on public.discount_codes(code);
create index if not exists discount_codes_active_idx on public.discount_codes(active);
create index if not exists shipping_zones_lookup_idx on public.shipping_zones(governorate, city_area);
create index if not exists shipping_zones_active_idx on public.shipping_zones(active);

-- 2) New service-role-only function signature. The API server verifies the customer's
-- JWT and passes the verified user id as customer_user_id.
create or replace function public.place_order_with_items(
  customer_user_id text,
  order_payload jsonb,
  items_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_id text := order_payload->>'id';
  order_item jsonb;
  variant_uuid uuid;
  variant_row public.product_variants%rowtype;
  product_row public.products%rowtype;
  discount_row public.discount_codes%rowtype;
  shipping_zone_row public.shipping_zones%rowtype;
  item_quantity int;
  item_price int;
  computed_subtotal int := 0;
  requested_subtotal int := coalesce((order_payload->>'subtotal_egp')::int, -1);
  shipping_egp int := 0;
  requested_shipping_egp int := coalesce((order_payload->>'shipping_egp')::int, -1);
  discount_code text := upper(btrim(coalesce(order_payload->>'discount_code', '')));
  discount_amount int := 0;
  requested_discount_amount int := coalesce((order_payload->>'discount_amount')::int, 0);
  requested_total int := coalesce((order_payload->>'total_egp')::int, -1);
  expected_total int;
  subtotal_after_discount int;
  governorate_text text := btrim(coalesce(order_payload->>'governorate', ''));
  city_area_text text := btrim(coalesce(order_payload->>'city_area', ''));
  variant_column_type text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the S! Wear server can place orders.';
  end if;

  if customer_user_id is null or btrim(customer_user_id) = '' then
    raise exception 'Verified customer id is required.';
  end if;

  if order_id is null or btrim(order_id) = '' then
    raise exception 'Order id is required.';
  end if;

  if jsonb_typeof(items_payload) <> 'array' or jsonb_array_length(items_payload) = 0 then
    raise exception 'Order must include at least one item.';
  end if;

  if requested_shipping_egp < 0 then
    raise exception 'Shipping total is invalid.';
  end if;

  if requested_discount_amount < 0 then
    raise exception 'Discount amount is invalid.';
  end if;

  select data_type
  into variant_column_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'order_items'
    and column_name = 'variant_id';

  for order_item in select * from jsonb_array_elements(items_payload)
  loop
    variant_uuid := nullif(order_item->>'variant_id', '')::uuid;
    item_quantity := coalesce((order_item->>'quantity')::int, 0);

    if variant_uuid is null then
      raise exception 'Variant id is required.';
    end if;

    if item_quantity <= 0 then
      raise exception 'Order item quantity must be greater than 0.';
    end if;

    select *
    into variant_row
    from public.product_variants
    where id = variant_uuid
      and active = true
    for update;

    if not found then
      raise exception 'Selected product variant is no longer available.';
    end if;

    select *
    into product_row
    from public.products
    where id = variant_row.product_id;

    if not found or lower(coalesce(product_row.status, '')) <> 'active' then
      raise exception 'Selected product is not available for ordering.';
    end if;

    item_price := coalesce(product_row.price_egp, 0);
    if item_price <= 0 then
      raise exception 'Selected product price is invalid.';
    end if;

    if coalesce(variant_row.stock, 0) < item_quantity then
      raise exception '% / % has only % left.', variant_row.color, variant_row.size, coalesce(variant_row.stock, 0);
    end if;

    computed_subtotal := computed_subtotal + (item_price * item_quantity);
  end loop;

  if requested_subtotal <> computed_subtotal then
    raise exception 'Order subtotal is invalid.';
  end if;

  if discount_code <> '' then
    select *
    into discount_row
    from public.discount_codes
    where upper(code) = discount_code
      and active = true;

    if not found then
      raise exception 'Discount code is invalid.';
    end if;

    if discount_row.expires_at is not null and discount_row.expires_at < now() then
      raise exception 'Discount code has expired.';
    end if;

    if computed_subtotal < coalesce(discount_row.minimum_order_egp, 0) then
      raise exception 'Order total is below the discount minimum.';
    end if;

    if discount_row.usage_limit is not null and coalesce(discount_row.used_count, 0) >= discount_row.usage_limit then
      raise exception 'Discount code has reached its usage limit.';
    end if;

    if lower(discount_row.discount_type) = 'percentage' then
      discount_amount := round((computed_subtotal * coalesce(discount_row.discount_value, 0))::numeric / 100)::int;
    elsif lower(discount_row.discount_type) = 'fixed' then
      discount_amount := least(coalesce(discount_row.discount_value, 0), computed_subtotal);
    else
      raise exception 'Discount code type is invalid.';
    end if;
  end if;

  if requested_discount_amount <> discount_amount then
    raise exception 'Discount amount is invalid.';
  end if;

  subtotal_after_discount := greatest(0, computed_subtotal - discount_amount);

  if governorate_text = '' then
    raise exception 'Governorate is required.';
  end if;

  if city_area_text <> '' then
    select *
    into shipping_zone_row
    from public.shipping_zones
    where active = true
      and lower(btrim(governorate)) = lower(governorate_text)
      and lower(btrim(coalesce(city_area, ''))) = lower(city_area_text)
    order by created_at desc
    limit 1;
  end if;

  if shipping_zone_row.id is null then
    select *
    into shipping_zone_row
    from public.shipping_zones
    where active = true
      and lower(btrim(governorate)) = lower(governorate_text)
      and btrim(coalesce(city_area, '')) = ''
    order by created_at desc
    limit 1;
  end if;

  if shipping_zone_row.id is null then
    select *
    into shipping_zone_row
    from public.shipping_zones
    where active = true
      and lower(btrim(governorate)) = 'other governorates'
      and btrim(coalesce(city_area, '')) = ''
    order by created_at desc
    limit 1;
  end if;

  if shipping_zone_row.id is null then
    raise exception 'Delivery fee will be confirmed by customer support.';
  end if;

  if shipping_zone_row.free_shipping_min_egp is not null
    and shipping_zone_row.free_shipping_min_egp > 0
    and subtotal_after_discount >= shipping_zone_row.free_shipping_min_egp then
    shipping_egp := 0;
  else
    shipping_egp := coalesce(shipping_zone_row.delivery_fee_egp, -1);
  end if;

  if shipping_egp < 0 or requested_shipping_egp <> shipping_egp then
    raise exception 'Shipping total is invalid.';
  end if;

  expected_total := subtotal_after_discount + shipping_egp;

  if requested_total <> expected_total then
    raise exception 'Order total is invalid.';
  end if;

  insert into public.orders (
    id,
    user_id,
    customer_name,
    phone,
    governorate,
    city_area,
    full_address,
    notes,
    subtotal_egp,
    shipping_egp,
    total_egp,
    discount_code,
    discount_amount,
    payment_method,
    status,
    created_at
  ) values (
    order_id,
    customer_user_id,
    order_payload->>'customer_name',
    order_payload->>'phone',
    order_payload->>'governorate',
    order_payload->>'city_area',
    order_payload->>'full_address',
    nullif(order_payload->>'notes', ''),
    computed_subtotal,
    shipping_egp,
    expected_total,
    nullif(order_payload->>'discount_code', ''),
    discount_amount,
    'Cash on Delivery',
    'Pending',
    coalesce((order_payload->>'created_at')::timestamptz, now())
  );

  for order_item in select * from jsonb_array_elements(items_payload)
  loop
    variant_uuid := nullif(order_item->>'variant_id', '')::uuid;
    item_quantity := coalesce((order_item->>'quantity')::int, 0);

    select *
    into variant_row
    from public.product_variants
    where id = variant_uuid
    for update;

    select *
    into product_row
    from public.products
    where id = variant_row.product_id;

    update public.product_variants
    set stock = stock - item_quantity
    where id = variant_uuid
      and stock >= item_quantity;

    if not found then
      raise exception 'Stock changed while placing the order. Please try again.';
    end if;

    if variant_column_type = 'uuid' then
      insert into public.order_items (
        order_id,
        product_id,
        variant_id,
        product_name,
        size,
        color,
        quantity,
        price_egp
      ) values (
        order_id,
        variant_row.product_id::text,
        variant_uuid,
        product_row.name,
        variant_row.size,
        variant_row.color,
        item_quantity,
        product_row.price_egp
      );
    else
      insert into public.order_items (
        order_id,
        product_id,
        variant_id,
        product_name,
        size,
        color,
        quantity,
        price_egp
      ) values (
        order_id,
        variant_row.product_id::text,
        variant_uuid::text,
        product_row.name,
        variant_row.size,
        variant_row.color,
        item_quantity,
        product_row.price_egp
      );
    end if;
  end loop;

  return jsonb_build_object('id', order_id);
end;
$$;

-- 3) Remove direct browser execution. Keep execute only for service_role.
do $$
begin
  if to_regprocedure('public.place_order_with_items(jsonb, jsonb)') is not null then
    revoke execute on function public.place_order_with_items(jsonb, jsonb) from public;
    revoke execute on function public.place_order_with_items(jsonb, jsonb) from anon;
    revoke execute on function public.place_order_with_items(jsonb, jsonb) from authenticated;
    revoke execute on function public.place_order_with_items(jsonb, jsonb) from service_role;
  end if;
end $$;

revoke execute on function public.place_order_with_items(text, jsonb, jsonb) from public;
revoke execute on function public.place_order_with_items(text, jsonb, jsonb) from anon;
revoke execute on function public.place_order_with_items(text, jsonb, jsonb) from authenticated;
grant execute on function public.place_order_with_items(text, jsonb, jsonb) to service_role;

-- 4) Inspect final RPC grants.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
  exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'place_order_with_items'
order by arguments;
