-- S! Wear - Product archive/delete support
-- Non-destructive: preserves products, variants, orders, and order_items.

alter table public.products
  add column if not exists active boolean not null default true;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%active%'
      and pg_get_constraintdef(oid) ilike '%draft%'
      and pg_get_constraintdef(oid) not ilike '%archived%'
  loop
    execute format('alter table public.products drop constraint %I', constraint_row.conname);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_status_check'
  ) then
    alter table public.products
      add constraint products_status_check
      check (status in ('active', 'draft', 'archived')) not valid;
  end if;
end $$;

create index if not exists products_active_status_idx
  on public.products(active, status);

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'Allow all on products'
  ) then
    alter policy "Allow all on products"
    on public.products
    using (
      public.is_admin()
      or (
        status = 'active'
        and coalesce(active, true) = true
      )
    )
    with check (public.is_admin());
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_variants'
      and policyname = 'Allow all on product_variants'
  ) then
    alter policy "Allow all on product_variants"
    on public.product_variants
    using (
      public.is_admin()
      or (
        active = true
        and exists (
          select 1
          from public.products
          where products.id = product_variants.product_id
            and products.status = 'active'
            and coalesce(products.active, true) = true
        )
      )
    )
    with check (public.is_admin());
  end if;
end $$;
