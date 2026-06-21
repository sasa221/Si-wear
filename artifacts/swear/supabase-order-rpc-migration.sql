-- S! Wear - Secure Order Placement RPC
-- Run this in Supabase SQL Editor.
-- Non-destructive: creates/replaces one function and tightens direct order_items insert access.
-- Existing orders, order_items, products, variants, notifications, users, and profiles are preserved.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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
create index if not exists products_slug_idx on public.products(slug);
create index if not exists product_variants_product_id_idx on public.product_variants(product_id);
create index if not exists product_variants_lookup_idx on public.product_variants(product_id, color, size);

alter table public.products enable row level security;
alter table public.product_variants enable row level security;

create or replace function public.place_order_with_items(
  order_payload jsonb,
  items_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id text := auth.uid()::text;
  order_id text := order_payload->>'id';
  order_item jsonb;
  variant_uuid uuid;
  variant_row public.product_variants%rowtype;
  product_status text;
  item_quantity int;
  item_price int;
  variant_column_type text;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to place an order.';
  end if;

  if order_id is null or btrim(order_id) = '' then
    raise exception 'Order id is required.';
  end if;

  if coalesce(order_payload->>'user_id', '') <> current_user_id then
    raise exception 'You can only place orders for your own account.';
  end if;

  if jsonb_typeof(items_payload) <> 'array' or jsonb_array_length(items_payload) = 0 then
    raise exception 'Order must include at least one item.';
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
    current_user_id,
    order_payload->>'customer_name',
    order_payload->>'phone',
    order_payload->>'governorate',
    order_payload->>'city_area',
    order_payload->>'full_address',
    nullif(order_payload->>'notes', ''),
    coalesce((order_payload->>'subtotal_egp')::int, 0),
    coalesce((order_payload->>'shipping_egp')::int, 0),
    coalesce((order_payload->>'total_egp')::int, 0),
    nullif(order_payload->>'discount_code', ''),
    coalesce((order_payload->>'discount_amount')::int, 0),
    'Cash on Delivery',
    'Pending',
    coalesce((order_payload->>'created_at')::timestamptz, now())
  );

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
    item_price := coalesce((order_item->>'price_egp')::int, 0);

    if item_quantity <= 0 then
      raise exception 'Order item quantity must be greater than 0.';
    end if;

    if item_price <= 0 then
      raise exception 'Order item price must be greater than 0.';
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

    select status
    into product_status
    from public.products
    where id = variant_row.product_id;

    if product_status is distinct from 'active' then
      raise exception 'Selected product is not available for ordering.';
    end if;

    if coalesce(variant_row.stock, 0) < item_quantity then
      raise exception '% / % has only % left.', variant_row.color, variant_row.size, coalesce(variant_row.stock, 0);
    end if;

    update public.product_variants
    set stock = greatest(0, coalesce(stock, 0) - item_quantity)
    where id = variant_uuid;

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
        order_item->>'product_name',
        variant_row.size,
        variant_row.color,
        item_quantity,
        item_price
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
        order_item->>'product_name',
        variant_row.size,
        variant_row.color,
        item_quantity,
        item_price
      );
    end if;
  end loop;

  return jsonb_build_object('id', order_id);
end;
$$;

revoke all on function public.place_order_with_items(jsonb, jsonb) from public;
grant execute on function public.place_order_with_items(jsonb, jsonb) to authenticated;

revoke insert on table public.order_items from authenticated;

drop policy if exists "order_items_insert_own_order_or_admin" on public.order_items;
drop policy if exists "order_items_insert_admin_only" on public.order_items;

-- Keep order_items inserts inside public.place_order_with_items() so stock and order rows stay consistent.
