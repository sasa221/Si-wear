-- S! Wear - Safe Missing Tables Migration
-- Run this in Supabase SQL Editor.
-- Non-destructive: only creates missing structures and adds missing columns/indexes/policies.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  role text default 'customer',
  blocked boolean default false,
  is_active boolean default true,
  last_login_at timestamptz,
  created_at timestamptz default now()
);

alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists role text default 'customer';
alter table profiles add column if not exists blocked boolean default false;
alter table profiles add column if not exists is_active boolean default true;
alter table profiles add column if not exists last_login_at timestamptz;
alter table profiles add column if not exists created_at timestamptz default now();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and coalesce(profiles.blocked, false) = false
      and coalesce(profiles.is_active, true) = true
  );
$$;

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  customer_name text,
  customer_email text,
  customer_phone text,
  subject text not null,
  message text not null,
  order_id text,
  status text default 'open',
  admin_reply text,
  replied_by text,
  replied_at timestamptz,
  created_at timestamptz default now()
);

alter table contact_messages add column if not exists customer_id text;
alter table contact_messages add column if not exists customer_name text;
alter table contact_messages add column if not exists customer_email text;
alter table contact_messages add column if not exists customer_phone text;
alter table contact_messages add column if not exists subject text;
alter table contact_messages add column if not exists message text;
alter table contact_messages add column if not exists order_id text;
alter table contact_messages add column if not exists status text default 'open';
alter table contact_messages add column if not exists admin_reply text;
alter table contact_messages add column if not exists replied_by text;
alter table contact_messages add column if not exists replied_at timestamptz;
alter table contact_messages add column if not exists created_at timestamptz default now();

create table if not exists discount_codes (
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

alter table discount_codes add column if not exists code text;
alter table discount_codes add column if not exists discount_type text;
alter table discount_codes add column if not exists discount_value int;
alter table discount_codes add column if not exists minimum_order_egp int default 0;
alter table discount_codes add column if not exists usage_limit int;
alter table discount_codes add column if not exists used_count int default 0;
alter table discount_codes add column if not exists expires_at timestamptz;
alter table discount_codes add column if not exists active boolean default true;
alter table discount_codes add column if not exists created_at timestamptz default now();

create table if not exists shipping_zones (
  id uuid primary key default gen_random_uuid(),
  governorate text not null,
  city_area text,
  delivery_fee_egp int not null,
  free_shipping_min_egp int,
  active boolean default true,
  created_at timestamptz default now()
);

alter table shipping_zones add column if not exists governorate text;
alter table shipping_zones add column if not exists city_area text;
alter table shipping_zones add column if not exists delivery_fee_egp int;
alter table shipping_zones add column if not exists free_shipping_min_egp int;
alter table shipping_zones add column if not exists active boolean default true;
alter table shipping_zones add column if not exists created_at timestamptz default now();

create table if not exists return_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id text,
  user_id text,
  order_id text,
  order_number text,
  request_type text,
  preferred_action text,
  reason text,
  message text,
  status text default 'Pending',
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table return_requests add column if not exists customer_id text;
alter table return_requests add column if not exists user_id text;
alter table return_requests add column if not exists order_id text;
alter table return_requests add column if not exists order_number text;
alter table return_requests add column if not exists request_type text;
alter table return_requests add column if not exists preferred_action text;
alter table return_requests add column if not exists reason text;
alter table return_requests add column if not exists message text;
alter table return_requests add column if not exists status text default 'Pending';
alter table return_requests add column if not exists admin_note text;
alter table return_requests add column if not exists created_at timestamptz default now();
alter table return_requests add column if not exists updated_at timestamptz default now();

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  label text,
  governorate text,
  city_area text,
  full_address text,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table if not exists store_settings (
  id text primary key default 'default',
  whatsapp_number text,
  announcement_text text,
  store_location text,
  instagram_url text,
  tiktok_url text,
  free_shipping_message text,
  default_shipping_note text,
  updated_at timestamptz default now()
);

alter table addresses add column if not exists customer_id text;
alter table addresses add column if not exists label text;
alter table addresses add column if not exists governorate text;
alter table addresses add column if not exists city_area text;
alter table addresses add column if not exists full_address text;
alter table addresses add column if not exists is_default boolean default false;
alter table addresses add column if not exists created_at timestamptz default now();

alter table store_settings add column if not exists whatsapp_number text;
alter table store_settings add column if not exists announcement_text text;
alter table store_settings add column if not exists store_location text;
alter table store_settings add column if not exists instagram_url text;
alter table store_settings add column if not exists tiktok_url text;
alter table store_settings add column if not exists free_shipping_message text;
alter table store_settings add column if not exists default_shipping_note text;
alter table store_settings add column if not exists updated_at timestamptz default now();

create table if not exists orders (
  id text primary key,
  user_id text,
  customer_name text,
  phone text,
  governorate text,
  city_area text,
  full_address text,
  notes text,
  subtotal_egp int default 0,
  shipping_egp int default 0,
  total_egp int default 0,
  discount_code text,
  discount_amount int default 0,
  payment_method text default 'Cash on Delivery',
  status text default 'Pending',
  created_at timestamptz default now()
);

alter table orders add column if not exists user_id text;
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists phone text;
alter table orders add column if not exists governorate text;
alter table orders add column if not exists city_area text;
alter table orders add column if not exists full_address text;
alter table orders add column if not exists notes text;
alter table orders add column if not exists subtotal_egp int default 0;
alter table orders add column if not exists shipping_egp int default 0;
alter table orders add column if not exists total_egp int default 0;
alter table orders add column if not exists discount_code text;
alter table orders add column if not exists discount_amount int default 0;
alter table orders add column if not exists payment_method text default 'Cash on Delivery';
alter table orders add column if not exists status text default 'Pending';
alter table orders add column if not exists created_at timestamptz default now();

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text references orders(id) on delete cascade,
  product_id text,
  variant_id text,
  product_name text,
  size text,
  color text,
  quantity int default 1,
  price_egp int default 0,
  created_at timestamptz default now()
);

alter table order_items add column if not exists order_id text;
alter table order_items add column if not exists product_id text;
alter table order_items add column if not exists variant_id text;
alter table order_items add column if not exists product_name text;
alter table order_items add column if not exists size text;
alter table order_items add column if not exists color text;
alter table order_items add column if not exists quantity int default 1;
alter table order_items add column if not exists price_egp int default 0;
alter table order_items add column if not exists created_at timestamptz default now();

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  order_id text,
  contact_message_id uuid,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table notifications add column if not exists customer_id text;
alter table notifications add column if not exists order_id text;
alter table notifications add column if not exists contact_message_id uuid;
alter table notifications add column if not exists message text;
alter table notifications add column if not exists read boolean default false;
alter table notifications add column if not exists created_at timestamptz default now();
alter table orders add column if not exists admin_notes text;
alter table orders add column if not exists cancellation_requested boolean default false;
alter table orders add column if not exists cancellation_status text default 'None';
alter table orders add column if not exists cancellation_reason text;
alter table orders add column if not exists cancellation_requested_at timestamptz;
alter table orders add column if not exists cancellation_resolved_at timestamptz;
alter table orders add column if not exists cancellation_admin_note text;

create index if not exists profiles_email_idx on profiles(email);
create index if not exists profiles_phone_idx on profiles(phone);
create index if not exists profiles_role_idx on profiles(role);
create index if not exists profiles_status_idx on profiles(blocked, is_active);
create index if not exists contact_messages_customer_id_idx on contact_messages(customer_id);
create index if not exists contact_messages_status_idx on contact_messages(status);
create index if not exists contact_messages_created_at_idx on contact_messages(created_at);
create index if not exists discount_codes_code_idx on discount_codes(code);
create index if not exists discount_codes_active_idx on discount_codes(active);
create index if not exists shipping_zones_lookup_idx on shipping_zones(governorate, city_area);
create index if not exists shipping_zones_active_idx on shipping_zones(active);
create index if not exists return_requests_customer_id_idx on return_requests(customer_id);
create index if not exists return_requests_user_id_idx on return_requests(user_id);
create index if not exists return_requests_order_id_idx on return_requests(order_id);
create index if not exists return_requests_status_idx on return_requests(status);
create index if not exists addresses_customer_id_idx on addresses(customer_id);
create index if not exists orders_user_id_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists notifications_customer_id_idx on notifications(customer_id);
create index if not exists notifications_contact_message_id_idx on notifications(contact_message_id);

alter table profiles enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table notifications enable row level security;
alter table contact_messages enable row level security;
alter table discount_codes enable row level security;
alter table shipping_zones enable row level security;
alter table return_requests enable row level security;
alter table addresses enable row level security;
alter table store_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles select own or admin') then
    create policy "Profiles select own or admin" on profiles for select using (auth.uid() = id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles insert own') then
    create policy "Profiles insert own" on profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles update own or admin') then
    create policy "Profiles update own or admin" on profiles for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'Orders own or admin') then
    create policy "Orders own or admin" on orders for all using (user_id = auth.uid()::text or public.is_admin()) with check (user_id = auth.uid()::text or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items' and policyname = 'Order items own order or admin') then
    create policy "Order items own order or admin" on order_items for all using (
      public.is_admin()
      or exists (
        select 1 from orders
        where orders.id = order_items.order_id
          and orders.user_id = auth.uid()::text
      )
    ) with check (
      public.is_admin()
      or exists (
        select 1 from orders
        where orders.id = order_items.order_id
          and orders.user_id = auth.uid()::text
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Notifications own or admin') then
    create policy "Notifications own or admin" on notifications for all using (customer_id = auth.uid()::text or public.is_admin()) with check (customer_id = auth.uid()::text or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contact_messages' and policyname = 'Contact messages own or admin') then
    create policy "Contact messages own or admin" on contact_messages for all using (customer_id = auth.uid()::text or public.is_admin()) with check (customer_id = auth.uid()::text or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discount_codes' and policyname = 'Discount codes readable active or admin') then
    create policy "Discount codes readable active or admin" on discount_codes for select using (active = true or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discount_codes' and policyname = 'Discount codes admin write') then
    create policy "Discount codes admin write" on discount_codes for all using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shipping_zones' and policyname = 'Shipping zones readable active or admin') then
    create policy "Shipping zones readable active or admin" on shipping_zones for select using (active = true or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shipping_zones' and policyname = 'Shipping zones admin write') then
    create policy "Shipping zones admin write" on shipping_zones for all using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'return_requests' and policyname = 'Return requests own or admin') then
    create policy "Return requests own or admin" on return_requests for all using (coalesce(customer_id, user_id) = auth.uid()::text or public.is_admin()) with check (coalesce(customer_id, user_id) = auth.uid()::text or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'addresses' and policyname = 'Addresses own or admin') then
    create policy "Addresses own or admin" on addresses for all using (customer_id = auth.uid()::text or public.is_admin()) with check (customer_id = auth.uid()::text or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'store_settings' and policyname = 'Store settings public read') then
    create policy "Store settings public read" on store_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'store_settings' and policyname = 'Store settings admin write') then
    create policy "Store settings admin write" on store_settings for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

alter table contact_messages replica identity full;
alter table return_requests replica identity full;
alter table notifications replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'contact_messages'
    ) then
      alter publication supabase_realtime add table contact_messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'return_requests'
    ) then
      alter publication supabase_realtime add table return_requests;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table notifications;
    end if;
  end if;
end $$;

with seed_zones (governorate, city_area, delivery_fee_egp, free_shipping_min_egp, active) as (
  values
    ('Giza', 'Hadayek Al Ahram', 40, null::int, true),
    ('Giza', null, 60, null::int, true),
    ('Cairo', null, 70, null::int, true),
    ('Alexandria', null, 90, null::int, true),
    ('Other governorates', null, 100, null::int, true)
)
insert into shipping_zones (governorate, city_area, delivery_fee_egp, free_shipping_min_egp, active)
select s.governorate, s.city_area, s.delivery_fee_egp, s.free_shipping_min_egp, s.active
from seed_zones s
where not exists (
  select 1
  from shipping_zones z
  where lower(z.governorate) = lower(s.governorate)
    and coalesce(lower(nullif(trim(z.city_area), '')), '') =
        coalesce(lower(nullif(trim(s.city_area), '')), '')
);
