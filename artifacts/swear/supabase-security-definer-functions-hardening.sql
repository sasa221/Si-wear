-- S! Wear - Security Definer Function Hardening
-- Run this in Supabase SQL Editor.
-- Non-destructive: changes function permissions, one trigger helper definition, and specific RLS policy expressions.
-- No table rows or customer/order data are changed.

-- 1) Inspect current function definitions.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin',
    'prevent_customer_notification_field_update',
    'prevent_customer_notification_field_updates'
  )
order by p.proname;

-- 2) Inspect policies that currently depend on public.is_admin().
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ilike '%is_admin%'
    or coalesce(with_check, '') ilike '%is_admin%'
  )
order by tablename, policyname;

-- 3) Inspect triggers that use the notification field guard.
select
  trigger_name,
  event_object_schema,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and action_statement ilike '%prevent_customer_notification_field_update%'
order by event_object_table, trigger_name;

alter table public.profiles add column if not exists role text default 'customer';

-- Keep this helper for existing policies outside the order/notification hardening scope.
-- It remains SECURITY DEFINER because profile policies can need an RLS-safe admin check.
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

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_admin() from authenticated;

-- The trigger helper does not need elevated privileges. Convert it to SECURITY INVOKER
-- and use an inline profiles.role check instead of public.is_admin().
create or replace function public.prevent_customer_notification_field_updates()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) then
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

revoke execute on function public.prevent_customer_notification_field_updates() from public;
revoke execute on function public.prevent_customer_notification_field_updates() from anon;
revoke execute on function public.prevent_customer_notification_field_updates() from authenticated;

-- Some projects may have the older singular helper name from a previous iteration.
do $$
begin
  if to_regprocedure('public.prevent_customer_notification_field_update()') is not null then
    execute $fn$
      create or replace function public.prevent_customer_notification_field_update()
      returns trigger
      language plpgsql
      security invoker
      set search_path = public
      as $body$
      begin
        if exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        ) then
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
      $body$;
    $fn$;

    execute 'revoke execute on function public.prevent_customer_notification_field_update() from public';
    execute 'revoke execute on function public.prevent_customer_notification_field_update() from anon';
    execute 'revoke execute on function public.prevent_customer_notification_field_update() from authenticated';
  end if;
end $$;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;

-- 4) Replace public.is_admin() usage in order/notification policies with inline role checks.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_select_own_or_admin'
  ) then
    execute $policy$
      alter policy "orders_select_own_or_admin"
      on public.orders
      using (
        user_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  else
    execute $policy$
      create policy "orders_select_own_or_admin"
      on public.orders
      for select
      to authenticated
      using (
        user_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_update_admin_only'
  ) then
    execute $policy$
      alter policy "orders_update_admin_only"
      on public.orders
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  else
    execute $policy$
      create policy "orders_update_admin_only"
      on public.orders
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'order_items' and policyname = 'order_items_select_own_order_or_admin'
  ) then
    execute $policy$
      alter policy "order_items_select_own_order_or_admin"
      on public.order_items
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
        or exists (
          select 1
          from public.orders
          where orders.id = order_items.order_id
            and orders.user_id = auth.uid()::text
        )
      )
    $policy$;
  else
    execute $policy$
      create policy "order_items_select_own_order_or_admin"
      on public.order_items
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
        or exists (
          select 1
          from public.orders
          where orders.id = order_items.order_id
            and orders.user_id = auth.uid()::text
        )
      )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_select_own_or_admin'
  ) then
    execute $policy$
      alter policy "notifications_select_own_or_admin"
      on public.notifications
      using (
        customer_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  else
    execute $policy$
      create policy "notifications_select_own_or_admin"
      on public.notifications
      for select
      to authenticated
      using (
        customer_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_insert_admin_only'
  ) then
    execute $policy$
      alter policy "notifications_insert_admin_only"
      on public.notifications
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  else
    execute $policy$
      create policy "notifications_insert_admin_only"
      on public.notifications
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_update_own_read_or_admin'
  ) then
    execute $policy$
      alter policy "notifications_update_own_read_or_admin"
      on public.notifications
      using (
        customer_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        customer_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  else
    execute $policy$
      create policy "notifications_update_own_read_or_admin"
      on public.notifications
      for update
      to authenticated
      using (
        customer_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        customer_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  end if;
end $$;

-- 5) If older broad-but-role-scoped policy names still exist, remove public.is_admin() usage from them too.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'Orders own or admin'
  ) then
    execute $policy$
      alter policy "Orders own or admin"
      on public.orders
      using (
        user_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        user_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'order_items' and policyname = 'Order items own order or admin'
  ) then
    execute $policy$
      alter policy "Order items own order or admin"
      on public.order_items
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
        or exists (
          select 1
          from public.orders
          where orders.id = order_items.order_id
            and orders.user_id = auth.uid()::text
        )
      )
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
        or exists (
          select 1
          from public.orders
          where orders.id = order_items.order_id
            and orders.user_id = auth.uid()::text
        )
      )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Notifications own or admin'
  ) then
    execute $policy$
      alter policy "Notifications own or admin"
      on public.notifications
      using (
        customer_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        customer_id = auth.uid()::text
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  end if;
end $$;

-- 6) Inspect final function execute grants and policy references.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin',
    'prevent_customer_notification_field_update',
    'prevent_customer_notification_field_updates'
  )
order by p.proname;

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
