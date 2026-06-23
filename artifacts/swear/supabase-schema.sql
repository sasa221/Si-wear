-- S! Wear - Supabase Schema
-- Paste this into Supabase SQL Editor and run it once.

create extension if not exists pgcrypto;

-- Products keep basic product info only. Stock lives in product_variants.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null check (category in ('T-Shirts', 'Shirts', 'Pants')),
  price_egp integer not null check (price_egp > 0),
  description text not null default '',
  images jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  active boolean not null default true,
  is_new boolean not null default false,
  is_best_seller boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  size text not null,
  color text not null,
  stock int4 default 0 check (stock >= 0),
  sku text,
  active boolean default true,
  created_at timestamptz default now(),
  unique (product_id, size, color)
);

alter table products add column if not exists is_new boolean not null default false;
alter table products add column if not exists is_best_seller boolean not null default false;
alter table products add column if not exists active boolean not null default true;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  role text default 'customer' check (role in ('customer', 'admin')),
  blocked boolean default false,
  is_active boolean default true,
  last_login_at timestamptz,
  created_at timestamptz default now()
);

alter table profiles add column if not exists role text default 'customer';
alter table profiles add column if not exists blocked boolean default false;
alter table profiles add column if not exists is_active boolean default true;
alter table profiles add column if not exists last_login_at timestamptz;
alter table profiles add column if not exists created_at timestamptz default now();

-- Orders
create table if not exists orders (
  id text primary key,
  user_id text,
  customer_name text not null,
  phone text not null,
  governorate text not null,
  city_area text not null,
  full_address text not null,
  notes text,
  subtotal_egp integer not null,
  shipping_egp integer not null default 0,
  total_egp integer not null,
  discount_code text,
  discount_amount integer default 0,
  payment_method text default 'Cash on Delivery',
  status text default 'Pending',
  admin_notes text,
  cancellation_requested boolean default false,
  cancellation_status text default null,
  cancellation_reason text,
  cancellation_requested_at timestamptz,
  cancellation_resolved_at timestamptz,
  cancellation_reviewed_at timestamptz,
  cancellation_reviewed_by uuid references profiles(id),
  cancellation_admin_note text,
  created_at timestamptz default now()
);

-- Preserve existing order rows. This only ensures the column exists and changes
-- the default for future inserts away from the old hardcoded 60 EGP value.
alter table orders add column if not exists shipping_egp integer not null default 0;
alter table orders alter column shipping_egp set default 0;
alter table orders add column if not exists admin_notes text;
alter table orders add column if not exists cancellation_requested boolean default false;
alter table orders add column if not exists cancellation_status text default null;
alter table orders alter column cancellation_status drop default;
alter table orders add column if not exists cancellation_reason text;
alter table orders add column if not exists cancellation_requested_at timestamptz;
alter table orders add column if not exists cancellation_resolved_at timestamptz;
alter table orders add column if not exists cancellation_reviewed_at timestamptz;
alter table orders add column if not exists cancellation_reviewed_by uuid references profiles(id);
alter table orders add column if not exists cancellation_admin_note text;

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text references orders(id) on delete cascade,
  product_id text not null,
  variant_id uuid references product_variants(id) on delete set null,
  product_name text not null,
  size text not null,
  color text not null,
  quantity integer not null check (quantity > 0),
  price_egp integer not null check (price_egp > 0)
);

alter table order_items add column if not exists variant_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'variant_id'
      and udt_name = 'uuid'
  )
  and not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.conrelid = 'public.order_items'::regclass
      and c.confrelid = 'public.product_variants'::regclass
      and a.attname = 'variant_id'
  )
  and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_variant_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_variant_id_fkey
      foreign key (variant_id)
      references public.product_variants(id)
      on delete set null;
  end if;
end $$;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  order_id text references orders(id) on delete cascade,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  customer_name text,
  customer_email text,
  customer_phone text,
  subject text not null,
  message text not null,
  order_id text,
  status text not null default 'open' check (status in ('open', 'customer_replied', 'pending_admin', 'admin_replied', 'closed')),
  admin_reply text,
  replied_by text,
  replied_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references profiles(id),
  last_reply_at timestamptz,
  last_reply_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table contact_messages add column if not exists closed_at timestamptz;
alter table contact_messages add column if not exists closed_by uuid references profiles(id);
alter table contact_messages add column if not exists last_reply_at timestamptz;
alter table contact_messages add column if not exists last_reply_by uuid references profiles(id);
alter table contact_messages alter column status set default 'open';

update contact_messages
set status = case lower(btrim(coalesce(status, '')))
  when 'replied' then 'admin_replied'
  when 'admin_replied' then 'admin_replied'
  when 'customer_replied' then 'customer_replied'
  when 'pending_admin' then 'pending_admin'
  when 'closed' then 'closed'
  else 'open'
end;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.contact_messages'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.contact_messages drop constraint %I', constraint_name);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact_messages'::regclass
      and conname = 'contact_messages_status_check'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_status_check
      check (status in ('open', 'customer_replied', 'pending_admin', 'admin_replied', 'closed'));
  end if;
end $$;

alter table contact_messages alter column status set not null;

create table if not exists contact_message_replies (
  id uuid primary key default gen_random_uuid(),
  contact_message_id uuid not null references contact_messages(id) on delete cascade,
  sender_id uuid,
  sender_role text not null check (sender_role in ('customer', 'admin')),
  message text not null,
  created_at timestamptz not null default now()
);

insert into contact_message_replies (
  contact_message_id,
  sender_id,
  sender_role,
  message,
  created_at
)
select
  cm.id,
  case
    when cm.replied_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then cm.replied_by::uuid
    else null
  end,
  'admin',
  btrim(cm.admin_reply),
  coalesce(cm.replied_at, cm.last_reply_at, cm.created_at, now())
from contact_messages cm
where nullif(btrim(coalesce(cm.admin_reply, '')), '') is not null
  and not exists (
    select 1
    from contact_message_replies r
    where r.contact_message_id = cm.id
      and r.sender_role = 'admin'
      and btrim(r.message) = btrim(cm.admin_reply)
  );

with latest_reply as (
  select distinct on (r.contact_message_id)
    r.contact_message_id,
    r.sender_id,
    r.created_at
  from contact_message_replies r
  order by r.contact_message_id, r.created_at desc, r.id desc
)
update contact_messages cm
set
  last_reply_at = latest_reply.created_at,
  last_reply_by = latest_reply.sender_id
from latest_reply
where cm.id = latest_reply.contact_message_id
  and (cm.last_reply_at is null or latest_reply.created_at > cm.last_reply_at);

alter table notifications add column if not exists contact_message_id uuid references contact_messages(id) on delete cascade;

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  minimum_order_egp integer not null default 0 check (minimum_order_egp >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id text references orders(id) on delete cascade,
  order_number text not null,
  user_id text not null,
  reason text not null,
  message text not null,
  preferred_action text not null check (preferred_action in ('return', 'exchange')),
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Rejected', 'Completed')),
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists shipping_zones (
  id uuid primary key default gen_random_uuid(),
  governorate text not null,
  city_area text,
  delivery_fee_egp integer not null check (delivery_fee_egp >= 0),
  free_shipping_min_egp integer check (free_shipping_min_egp is null or free_shipping_min_egp >= 0),
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null,
  cover_image_url text,
  active boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table categories add column if not exists name text;
alter table categories add column if not exists slug text;
alter table categories add column if not exists cover_image_url text;
alter table categories add column if not exists active boolean not null default true;
alter table categories add column if not exists sort_order integer not null default 1;
alter table categories add column if not exists created_at timestamptz default now();
alter table categories add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categories'
      and column_name = 'display_name'
  ) then
    execute $sql$
      update categories
      set name = display_name
      where (name is null or btrim(name) = '')
        and display_name is not null
        and btrim(display_name) <> ''
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categories'
      and column_name = 'cover_image'
  ) then
    execute $sql$
      update categories
      set cover_image_url = cover_image
      where cover_image_url is null
        and cover_image is not null
        and btrim(cover_image) <> ''
    $sql$;
  end if;
end $$;

update categories
set slug = case name
  when 'T-Shirts' then 't-shirts'
  when 'Shirts' then 'shirts'
  when 'Pants' then 'pants'
  else regexp_replace(lower(btrim(coalesce(name, ''))), '[^a-z0-9]+', '-', 'g')
end
where slug is null or btrim(slug) = '';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'categories_name_allowed'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table categories
      drop constraint categories_name_allowed;
  end if;
end $$;

create table if not exists store_settings (
  id text primary key default 'default',
  brand_name text not null default 'S! Wear',
  whatsapp_number text not null default '201220172714',
  announcement_bar_text text not null default '',
  instagram_url text not null default '',
  tiktok_url text not null default '',
  facebook_url text not null default '',
  store_location text not null default 'Gate 1, 113D Pyramids Gardens, Giza, Egypt',
  shipping_note text not null default 'Delivery fee is calculated by governorate and city/area at checkout.',
  returns_policy_text text not null default '7-day exchange policy for delivered orders.',
  support_info text not null default '+20 122 017 2714',
  updated_at timestamptz default now()
);

alter table store_settings add column if not exists brand_name text not null default 'S! Wear';
alter table store_settings add column if not exists whatsapp_number text not null default '201220172714';
alter table store_settings add column if not exists announcement_bar_text text not null default '';
alter table store_settings add column if not exists instagram_url text not null default '';
alter table store_settings add column if not exists tiktok_url text not null default '';
alter table store_settings add column if not exists facebook_url text not null default '';
alter table store_settings add column if not exists store_location text not null default 'Gate 1, 113D Pyramids Gardens, Giza, Egypt';
alter table store_settings add column if not exists shipping_note text not null default 'Delivery fee is calculated by governorate and city/area at checkout.';
alter table store_settings add column if not exists returns_policy_text text not null default '7-day exchange policy for delivered orders.';
alter table store_settings add column if not exists support_info text not null default '+20 122 017 2714';
alter table store_settings add column if not exists updated_at timestamptz default now();

insert into store_settings (id)
values ('default')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
set public = excluded.public;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'product-images';

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
  );
$$;

-- Open RLS policies for this custom localStorage-auth app.
-- Production hardening should replace these with real authenticated policies.
-- Because this app does not use Supabase Auth yet, Supabase cannot identify
-- the current localStorage user/admin role from the anon key alone.
alter table products enable row level security;
alter table product_variants enable row level security;
alter table profiles enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table notifications enable row level security;
alter table contact_messages enable row level security;
alter table contact_message_replies enable row level security;
alter table discount_codes enable row level security;
alter table return_requests enable row level security;
alter table shipping_zones enable row level security;
alter table categories enable row level security;
alter table store_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products' and policyname = 'Allow all on products'
  ) then
    create policy "Allow all on products" on products for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_variants' and policyname = 'Allow all on product_variants'
  ) then
    create policy "Allow all on product_variants" on product_variants for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles select own'
  ) then
    create policy "Profiles select own" on profiles for select using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles insert own'
  ) then
    create policy "Profiles insert own" on profiles for insert with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles update own'
  ) then
    create policy "Profiles update own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'Allow all on orders'
  ) then
    create policy "Allow all on orders" on orders for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'order_items' and policyname = 'Allow all on order_items'
  ) then
    create policy "Allow all on order_items" on order_items for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Allow all on notifications'
  ) then
    create policy "Allow all on notifications" on notifications for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_messages' and policyname = 'Allow all on contact_messages'
  ) then
    create policy "Allow all on contact_messages" on contact_messages for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'discount_codes' and policyname = 'Allow all on discount_codes'
  ) then
    create policy "Allow all on discount_codes" on discount_codes for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'return_requests' and policyname = 'Allow all on return_requests'
  ) then
    create policy "Allow all on return_requests" on return_requests for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shipping_zones' and policyname = 'Allow all on shipping_zones'
  ) then
    create policy "Allow all on shipping_zones" on shipping_zones for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'Allow all on categories'
  ) then
    create policy "Allow all on categories"
      on categories
      for all
      using (active = true or public.is_admin())
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_settings' and policyname = 'Allow all on store_settings'
  ) then
    create policy "Allow all on store_settings" on store_settings for all using (true) with check (true);
  end if;
end $$;

-- Tighten legacy broad policies now that the app uses Supabase Auth tokens.
-- These ALTER POLICY statements are non-destructive: they only change access rules.
alter policy "Allow all on products" on products
  using (
    public.is_admin()
    or (
      status = 'active'
      and coalesce(active, true) = true
    )
  )
  with check (public.is_admin());

alter policy "Allow all on product_variants" on product_variants
  using (
    public.is_admin()
    or (
      active = true
      and exists (
        select 1 from products
        where products.id = product_variants.product_id
          and products.status = 'active'
          and coalesce(products.active, true) = true
      )
    )
  )
  with check (public.is_admin());

alter policy "Allow all on orders" on orders
  using (public.is_admin() or user_id = auth.uid()::text)
  with check (public.is_admin() or user_id = auth.uid()::text);

alter policy "Allow all on order_items" on order_items
  using (
    public.is_admin()
    or exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()::text
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()::text
    )
  );

alter policy "Allow all on notifications" on notifications
  using (public.is_admin() or customer_id = auth.uid()::text)
  with check (public.is_admin() or customer_id = auth.uid()::text);

alter policy "Allow all on contact_messages" on contact_messages
  using (public.is_admin() or customer_id = auth.uid()::text)
  with check (public.is_admin() or customer_id = auth.uid()::text);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_message_replies'
      and policyname = 'Contact replies select own or admin'
  ) then
    create policy "Contact replies select own or admin"
      on contact_message_replies
      for select
      using (
        public.is_admin()
        or exists (
          select 1
          from contact_messages cm
          where cm.id = contact_message_replies.contact_message_id
            and cm.customer_id = auth.uid()::text
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_message_replies'
      and policyname = 'Contact replies insert own or admin'
  ) then
    create policy "Contact replies insert own or admin"
      on contact_message_replies
      for insert
      with check (
        public.is_admin()
        or (
          sender_role = 'customer'
          and sender_id = auth.uid()
          and exists (
            select 1
            from contact_messages cm
            where cm.id = contact_message_replies.contact_message_id
              and cm.customer_id = auth.uid()::text
              and cm.status <> 'closed'
          )
        )
      );
  end if;
end $$;

alter policy "Allow all on return_requests" on return_requests
  using (public.is_admin() or user_id = auth.uid()::text)
  with check (public.is_admin() or user_id = auth.uid()::text);

alter policy "Allow all on shipping_zones" on shipping_zones
  using (active = true or public.is_admin())
  with check (public.is_admin());

alter policy "Allow all on categories" on categories
  using (active = true or public.is_admin())
  with check (public.is_admin());

alter policy "Allow all on store_settings" on store_settings
  using (true)
  with check (public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read product images'
  ) then
    create policy "Public read product images"
      on storage.objects for select
      using (bucket_id = 'product-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admin upload product images'
  ) then
    create policy "Admin upload product images"
      on storage.objects for insert
      with check (
        bucket_id = 'product-images'
        and exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admin update product images'
  ) then
    create policy "Admin update product images"
      on storage.objects for update
      using (
        bucket_id = 'product-images'
        and exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        bucket_id = 'product-images'
        and exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      );
  end if;
end $$;

-- Indexes
create index if not exists products_category_idx on products(category);
create index if not exists products_status_idx on products(status);
create index if not exists product_variants_product_id_idx on product_variants(product_id);
create index if not exists product_variants_lookup_idx on product_variants(product_id, color, size);
create index if not exists profiles_phone_idx on profiles(phone);
create index if not exists profiles_role_idx on profiles(role);
create index if not exists profiles_status_idx on profiles(blocked, is_active);
create index if not exists orders_user_id_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_cancellation_status_idx on orders(cancellation_status);
create index if not exists orders_cancellation_pending_idx on orders(created_at desc)
  where cancellation_requested is true or lower(coalesce(cancellation_status, '')) = 'pending';
create index if not exists notifications_cust_idx on notifications(customer_id);
create index if not exists notifications_contact_message_id_idx on notifications(contact_message_id);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists order_items_variant_id_idx on order_items(variant_id);
create index if not exists contact_messages_customer_id_idx on contact_messages(customer_id);
create index if not exists contact_messages_status_idx on contact_messages(status);
create index if not exists contact_messages_created_at_idx on contact_messages(created_at);
create index if not exists contact_messages_last_reply_at_idx on contact_messages(last_reply_at desc);
create index if not exists contact_message_replies_message_idx on contact_message_replies(contact_message_id, created_at asc);
create index if not exists contact_message_replies_sender_role_idx on contact_message_replies(sender_role);
create index if not exists discount_codes_code_idx on discount_codes(code);
create index if not exists discount_codes_active_idx on discount_codes(active);
create index if not exists return_requests_order_id_idx on return_requests(order_id);
create index if not exists return_requests_user_id_idx on return_requests(user_id);
create index if not exists return_requests_status_idx on return_requests(status);
create index if not exists shipping_zones_lookup_idx on shipping_zones(governorate, city_area);
create index if not exists shipping_zones_active_idx on shipping_zones(active);
create index if not exists categories_slug_idx on categories(slug);
create index if not exists categories_active_idx on categories(active);
create index if not exists categories_sort_order_idx on categories(sort_order);

-- Realtime: required for live customer status and notification updates.
alter table orders replica identity full;
alter table notifications replica identity full;
alter table contact_messages replica identity full;
alter table contact_message_replies replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    ) then
      alter publication supabase_realtime add table orders;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table notifications;
    end if;

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
        and tablename = 'contact_message_replies'
    ) then
      alter publication supabase_realtime add table contact_message_replies;
    end if;
  end if;
end $$;

-- Seed products
insert into products (id, name, slug, category, price_egp, description, images, status) values
  (
    '11111111-1111-4111-8111-111111111111',
    'Oversized Heavy Cotton T-Shirt',
    'oversized-heavy-cotton-tshirt',
    'T-Shirts',
    299,
    '320GSM heavyweight cotton. Oversized street fit with dropped shoulders and a ribbed collar. Pre-washed for everyday comfort.',
    '["https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop","https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&h=750&fit=crop","https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=750&fit=crop"]'::jsonb,
    'active'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Boxy Fit Shirt',
    'boxy-fit-shirt',
    'Shirts',
    399,
    'Premium cotton shirt with a boxy silhouette, dropped shoulders, and a clean open collar. Easy to layer or wear alone.',
    '["https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=750&fit=crop","https://images.unsplash.com/photo-1555274175-6cbf6f3b137b?w=600&h=750&fit=crop","https://images.unsplash.com/photo-1516826957135-700dedea698c?w=600&h=750&fit=crop"]'::jsonb,
    'active'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Wide Leg Pant',
    'wide-leg-pant',
    'Pants',
    499,
    'Heavy twill wide-leg pant with a relaxed street silhouette, high waist, and practical pockets for everyday wear.',
    '["https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=750&fit=crop","https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&h=750&fit=crop","https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&h=750&fit=crop"]'::jsonb,
    'active'
  )
on conflict (id) do nothing;

-- Seed variant stock matrices
insert into product_variants (id, product_id, size, color, stock, sku, active) values
  ('e7b69323-60dc-4648-8c1f-11fb1a69b347', '11111111-1111-4111-8111-111111111111', 'S', 'Black', 5, '11111111-black-s', true),
  ('b6b84904-8509-4170-8351-ac34095b3b84', '11111111-1111-4111-8111-111111111111', 'M', 'Black', 3, '11111111-black-m', true),
  ('316d71ea-e238-4006-810c-902ce43cbe5c', '11111111-1111-4111-8111-111111111111', 'L', 'Black', 0, '11111111-black-l', true),
  ('bf201e84-9969-4f36-8a56-7e1237dd749a', '11111111-1111-4111-8111-111111111111', 'XL', 'Black', 2, '11111111-black-xl', true),
  ('76685bdc-661f-46de-828d-a0623aefca2a', '11111111-1111-4111-8111-111111111111', '2XL', 'Black', 1, '11111111-black-2xl', true),
  ('41372046-46db-4007-8241-e5f1f8ea89d5', '11111111-1111-4111-8111-111111111111', 'S', 'White', 4, '11111111-white-s', true),
  ('21698db7-7313-44d0-8737-ef37e37674f3', '11111111-1111-4111-8111-111111111111', 'M', 'White', 0, '11111111-white-m', true),
  ('82c48bdd-cdf9-4a64-8dd3-91e903c6f4ad', '11111111-1111-4111-8111-111111111111', 'L', 'White', 1, '11111111-white-l', true),
  ('b32f42c6-a9b3-4b53-8fe0-9d05bffc97b9', '11111111-1111-4111-8111-111111111111', 'XL', 'White', 0, '11111111-white-xl', true),
  ('145ee771-acb1-400e-82f0-b5cf62a278eb', '11111111-1111-4111-8111-111111111111', '2XL', 'White', 0, '11111111-white-2xl', true),
  ('97706241-4bc1-4bab-8e35-f4ca30a6ad32', '11111111-1111-4111-8111-111111111111', 'S', 'Stone', 2, '11111111-stone-s', true),
  ('c7d713cd-f7d2-4544-837a-25b9d2d9b1bd', '11111111-1111-4111-8111-111111111111', 'M', 'Stone', 2, '11111111-stone-m', true),
  ('a8961337-4fc3-45a7-854e-79905edf71d0', '11111111-1111-4111-8111-111111111111', 'L', 'Stone', 3, '11111111-stone-l', true),
  ('3f5bfbe2-ca29-46f0-89c6-5b722cefb37a', '11111111-1111-4111-8111-111111111111', 'XL', 'Stone', 1, '11111111-stone-xl', true),
  ('45bc9a95-7e35-45ac-8143-1769dd62402d', '11111111-1111-4111-8111-111111111111', '2XL', 'Stone', 0, '11111111-stone-2xl', true),
  ('b2f8daf9-287c-42c6-86ce-6a8fa66818ab', '33333333-3333-4333-8333-333333333333', 'S', 'Black', 0, '33333333-black-s', true),
  ('8013a749-167b-44d4-845a-b48d2e746e61', '33333333-3333-4333-8333-333333333333', 'M', 'Black', 4, '33333333-black-m', true),
  ('d9562964-71bf-4fa9-83da-78bd89bc6951', '33333333-3333-4333-8333-333333333333', 'L', 'Black', 3, '33333333-black-l', true),
  ('0b781464-0438-43f7-84b3-77a30d18948f', '33333333-3333-4333-8333-333333333333', 'XL', 'Black', 2, '33333333-black-xl', true),
  ('29ec1a19-754a-4f0c-89f0-e085faf75939', '33333333-3333-4333-8333-333333333333', '2XL', 'Black', 1, '33333333-black-2xl', true),
  ('ec323bc0-83ad-42b2-898c-c9d25f92e75a', '33333333-3333-4333-8333-333333333333', 'S', 'Ivory', 2, '33333333-ivory-s', true),
  ('3c6a9fe7-f886-44c8-80cc-127f400e7e5b', '33333333-3333-4333-8333-333333333333', 'M', 'Ivory', 2, '33333333-ivory-m', true),
  ('7a4e2f01-2168-4d36-8b04-57072618d603', '33333333-3333-4333-8333-333333333333', 'L', 'Ivory', 1, '33333333-ivory-l', true),
  ('58415fba-3210-4e51-8247-367b8245f9c7', '33333333-3333-4333-8333-333333333333', 'XL', 'Ivory', 0, '33333333-ivory-xl', true),
  ('6a05dc9b-09bc-4a2a-82c0-a96168aae905', '33333333-3333-4333-8333-333333333333', '2XL', 'Ivory', 0, '33333333-ivory-2xl', true),
  ('34ddd2e3-8987-4a00-8e4e-5ff3832a881f', '33333333-3333-4333-8333-333333333333', 'S', 'Sage', 1, '33333333-sage-s', true),
  ('5735afcf-59e0-431e-80e6-058116fef9a5', '33333333-3333-4333-8333-333333333333', 'M', 'Sage', 2, '33333333-sage-m', true),
  ('c9182d76-b54e-45ef-8479-e2c9e6f8e50d', '33333333-3333-4333-8333-333333333333', 'L', 'Sage', 2, '33333333-sage-l', true),
  ('f18c9e8b-9059-4ba8-8449-b8339319c95f', '33333333-3333-4333-8333-333333333333', 'XL', 'Sage', 1, '33333333-sage-xl', true),
  ('8c46d025-a97e-4db9-8dea-44dcf0cf7bcc', '33333333-3333-4333-8333-333333333333', '2XL', 'Sage', 0, '33333333-sage-2xl', true),
  ('f2b859fc-cac6-4a96-8963-464a875874b2', '44444444-4444-4444-8444-444444444444', 'S', 'Black', 0, '44444444-black-s', true),
  ('dfe70672-3ddf-41d2-8f52-f5a0d8004020', '44444444-4444-4444-8444-444444444444', 'M', 'Black', 3, '44444444-black-m', true),
  ('3852170d-763a-4a21-8be3-a76c61409a9c', '44444444-4444-4444-8444-444444444444', 'L', 'Black', 3, '44444444-black-l', true),
  ('c263241a-74c9-4f25-8f06-9d8fc8b177ab', '44444444-4444-4444-8444-444444444444', 'XL', 'Black', 2, '44444444-black-xl', true),
  ('ad810e38-3392-4d4e-8c38-1a96fe24cbae', '44444444-4444-4444-8444-444444444444', '2XL', 'Black', 1, '44444444-black-2xl', true),
  ('491dfa6e-98a7-4d91-8866-2e4fb1c3e36b', '44444444-4444-4444-8444-444444444444', 'S', 'Olive', 1, '44444444-olive-s', true),
  ('5d46ac1b-c753-487f-858a-dd24f13a6e34', '44444444-4444-4444-8444-444444444444', 'M', 'Olive', 2, '44444444-olive-m', true),
  ('efea9868-601f-4980-86c0-096851aa0c08', '44444444-4444-4444-8444-444444444444', 'L', 'Olive', 2, '44444444-olive-l', true),
  ('08a452af-c01e-406e-84a4-e071b9bbbe55', '44444444-4444-4444-8444-444444444444', 'XL', 'Olive', 1, '44444444-olive-xl', true),
  ('0da00ecf-6acf-480e-8c44-64714981d255', '44444444-4444-4444-8444-444444444444', '2XL', 'Olive', 0, '44444444-olive-2xl', true),
  ('e5e392f3-53d7-4888-8f72-520b3f24d597', '44444444-4444-4444-8444-444444444444', 'S', 'Stone', 1, '44444444-stone-s', true),
  ('b4136dab-fce1-4893-8077-73b8e136c998', '44444444-4444-4444-8444-444444444444', 'M', 'Stone', 1, '44444444-stone-m', true),
  ('72d2dd30-3435-42b3-8d51-949367f5e33f', '44444444-4444-4444-8444-444444444444', 'L', 'Stone', 0, '44444444-stone-l', true),
  ('1956fa94-5c62-41be-865e-820a8fa49772', '44444444-4444-4444-8444-444444444444', 'XL', 'Stone', 1, '44444444-stone-xl', true),
  ('548072ef-30cf-4cf3-8e5f-4d5c42c0b64c', '44444444-4444-4444-8444-444444444444', '2XL', 'Stone', 0, '44444444-stone-2xl', true)
on conflict (product_id, size, color) do nothing;

-- Seed delivery zones only when a matching zone does not already exist.
-- This does not overwrite admin-edited fees or deactivate/reactivate existing zones.
with seed_zones (governorate, city_area, delivery_fee_egp, free_shipping_min_egp, active) as (
  values
    ('Giza', 'Hadayek Al Ahram', 40, null::integer, true),
    ('Giza', null, 60, null::integer, true),
    ('Cairo', null, 70, null::integer, true),
    ('Alexandria', null, 90, null::integer, true),
    ('Other governorates', null, 100, null::integer, true)
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

insert into categories (name, slug, sort_order, active)
values
  ('T-Shirts', 't-shirts', 1, true),
  ('Shirts', 'shirts', 2, true),
  ('Pants', 'pants', 3, true)
on conflict (name) do update
set
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  active = true,
  cover_image_url = coalesce(categories.cover_image_url, excluded.cover_image_url),
  updated_at = now();
