-- S! Wear - Categories migration
-- Run this in Supabase SQL Editor.
-- Non-destructive and idempotent: preserves existing category rows, backfills
-- legacy columns, and upserts the canonical categories by unique name.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('T-Shirts', 'Shirts', 'Pants')),
  slug text not null,
  cover_image_url text,
  active boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.categories add column if not exists name text;
alter table public.categories add column if not exists slug text;
alter table public.categories add column if not exists cover_image_url text;
alter table public.categories add column if not exists active boolean not null default true;
alter table public.categories add column if not exists sort_order integer not null default 1;
alter table public.categories add column if not exists created_at timestamptz default now();
alter table public.categories add column if not exists updated_at timestamptz default now();

-- Normalize legacy display/image columns when they exist.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categories'
      and column_name = 'display_name'
  ) then
    execute $sql$
      update public.categories
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
      update public.categories
      set cover_image_url = cover_image
      where cover_image_url is null
        and cover_image is not null
        and btrim(cover_image) <> ''
    $sql$;
  end if;
end $$;

-- Backfill slug before creating/using slug indexes.
update public.categories
set slug = case name
  when 'T-Shirts' then 't-shirts'
  when 'Shirts' then 'shirts'
  when 'Pants' then 'pants'
  else regexp_replace(lower(btrim(coalesce(name, ''))), '[^a-z0-9]+', '-', 'g')
end
where slug is null or btrim(slug) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_name_allowed'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_name_allowed
      check (name in ('T-Shirts', 'Shirts', 'Pants')) not valid;
  end if;
end $$;

-- Existing projects already have categories_name_key. Fresh projects get the
-- same uniqueness guarantee from the CREATE TABLE statement above.
create index if not exists categories_slug_idx on public.categories(slug);
create index if not exists categories_active_idx on public.categories(active);
create index if not exists categories_sort_order_idx on public.categories(sort_order);

insert into public.categories (name, slug, sort_order, active)
values
  ('T-Shirts', 't-shirts', 1, true),
  ('Shirts', 'shirts', 2, true),
  ('Pants', 'pants', 3, true)
on conflict (name) do update
set
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  active = true,
  cover_image_url = coalesce(public.categories.cover_image_url, excluded.cover_image_url),
  updated_at = now();

alter table public.categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'Allow all on categories'
  ) then
    create policy "Allow all on categories"
      on public.categories
      for all
      using (active = true or public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

alter policy "Allow all on categories" on public.categories
  using (active = true or public.is_admin())
  with check (public.is_admin());
