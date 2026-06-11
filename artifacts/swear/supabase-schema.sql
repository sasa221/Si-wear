-- S! Wear — Supabase Schema
-- Paste this into your Supabase project's SQL Editor and click "Run".
-- Dashboard → SQL Editor → New query → paste below → Run

-- ─── orders ───────────────────────────────────────────────────────────────────
create table if not exists orders (
  id              text primary key,
  user_id         text,
  customer_name   text not null,
  phone           text not null,
  governorate     text not null,
  city_area       text not null,
  full_address    text not null,
  notes           text,
  subtotal_egp    integer not null,
  shipping_egp    integer not null default 60,
  total_egp       integer not null,
  discount_code   text,
  discount_amount integer default 0,
  payment_method  text default 'Cash on Delivery',
  status          text default 'Pending',
  created_at      timestamptz default now()
);

-- ─── order_items ─────────────────────────────────────────────────────────────
create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     text references orders(id) on delete cascade,
  product_id   text not null,
  product_name text not null,
  size         text not null,
  color        text not null,
  quantity     integer not null,
  price_egp    integer not null
);

-- ─── notifications ────────────────────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  customer_id text not null,
  order_id    text references orders(id) on delete cascade,
  message     text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ─── Row Level Security (open policies for this app) ─────────────────────────
-- This app uses its own auth system, so we allow all operations via anon key.
-- For a production hardening step, tie policies to a JWT claim.

alter table orders      enable row level security;
alter table order_items enable row level security;
alter table notifications enable row level security;

create policy "Allow all on orders"        on orders        for all using (true) with check (true);
create policy "Allow all on order_items"   on order_items   for all using (true) with check (true);
create policy "Allow all on notifications" on notifications for all using (true) with check (true);

-- ─── Indexes (for performance) ───────────────────────────────────────────────
create index if not exists orders_user_id_idx       on orders(user_id);
create index if not exists orders_status_idx        on orders(status);
create index if not exists notifications_cust_idx   on notifications(customer_id);
create index if not exists order_items_order_id_idx on order_items(order_id);
