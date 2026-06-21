-- S! Wear - RLS Security Hardening for Orders, Order Items, Notifications
-- Run this in Supabase SQL Editor.
-- Non-destructive: this changes only schema permissions, helper function, and RLS policies.
-- It does not change table rows or customer/order data.

-- 1) Inspect current policies before changing them.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items', 'notifications')
order by tablename, policyname;

-- 2) Ensure profile role support exists for admin checks.
alter table public.profiles add column if not exists role text default 'customer';

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

-- 3) Make sure row level security is enabled.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;

-- 4) Tighten table privileges for API roles. RLS policies below still decide row access.
revoke all on table public.orders from anon;
revoke all on table public.order_items from anon;
revoke all on table public.notifications from anon;
revoke all on table public.orders from public;
revoke all on table public.order_items from public;
revoke all on table public.notifications from public;

grant select, insert, update on table public.orders to authenticated;
grant select, insert on table public.order_items to authenticated;
grant select, insert, update on table public.notifications to authenticated;

-- 5) Drop only the known broad/legacy policy names and this migration's target policy names.
-- These are policy objects only; no data is touched.
drop policy if exists "Allow all on orders" on public.orders;
drop policy if exists "Allow all on order_items" on public.order_items;
drop policy if exists "Allow all on notifications" on public.notifications;

drop policy if exists "Orders own or admin" on public.orders;
drop policy if exists "Order items own order or admin" on public.order_items;
drop policy if exists "Notifications own or admin" on public.notifications;

drop policy if exists "orders_select_own_or_admin" on public.orders;
drop policy if exists "orders_insert_own_customer" on public.orders;
drop policy if exists "orders_update_admin_only" on public.orders;

drop policy if exists "order_items_select_own_order_or_admin" on public.order_items;
drop policy if exists "order_items_insert_own_order_or_admin" on public.order_items;

drop policy if exists "notifications_select_own_or_admin" on public.notifications;
drop policy if exists "notifications_insert_admin_only" on public.notifications;
drop policy if exists "notifications_update_own_read_or_admin" on public.notifications;

-- 6) Secure orders policies.
create policy "orders_select_own_or_admin"
on public.orders
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()::text
);

create policy "orders_insert_own_customer"
on public.orders
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()::text
);

create policy "orders_update_admin_only"
on public.orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 7) Secure order_items policies.
create policy "order_items_select_own_order_or_admin"
on public.order_items
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()::text
  )
);

create policy "order_items_insert_own_order_or_admin"
on public.order_items
for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()::text
  )
);

-- 8) Prevent customer notification updates from changing anything except read status.
create or replace function public.prevent_customer_notification_field_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.customer_id is distinct from old.customer_id
    or new.order_id is distinct from old.order_id
    or new.contact_message_id is distinct from old.contact_message_id
    or new.message is distinct from old.message
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Customers can only update notification read status.';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'prevent_customer_notification_field_updates'
      and tgrelid = 'public.notifications'::regclass
  ) then
    create trigger prevent_customer_notification_field_updates
    before update on public.notifications
    for each row
    execute function public.prevent_customer_notification_field_updates();
  end if;
end $$;

-- 9) Secure notifications policies.
create policy "notifications_select_own_or_admin"
on public.notifications
for select
to authenticated
using (
  public.is_admin()
  or customer_id = auth.uid()::text
);

create policy "notifications_insert_admin_only"
on public.notifications
for insert
to authenticated
with check (public.is_admin());

create policy "notifications_update_own_read_or_admin"
on public.notifications
for update
to authenticated
using (
  public.is_admin()
  or customer_id = auth.uid()::text
)
with check (
  public.is_admin()
  or customer_id = auth.uid()::text
);

-- 10) Inspect final policies after hardening.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items', 'notifications')
order by tablename, policyname;
