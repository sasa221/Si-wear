-- S! Wear - Flexible product categories migration
-- Run this in Supabase SQL Editor.
-- Non-destructive: removes the old check constraint that limited categories to
-- T-Shirts, Shirts, and Pants. Existing categories/products/orders are kept.

alter table public.categories
  drop constraint if exists categories_name_allowed;

alter table public.categories
  alter column name set not null;

create index if not exists categories_slug_idx
  on public.categories (slug);

create index if not exists categories_active_idx
  on public.categories (active);

create index if not exists categories_sort_order_idx
  on public.categories (sort_order);
