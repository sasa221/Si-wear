-- S! Wear - Product flags migration
-- Run this in Supabase SQL Editor.
-- Non-destructive: adds missing product flag columns only. Existing products are preserved.

alter table public.products
  add column if not exists is_new boolean not null default false;

alter table public.products
  add column if not exists is_best_seller boolean not null default false;
