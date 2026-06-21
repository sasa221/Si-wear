-- S! Wear - Admin Panel Safe Profile/Admin Migration
-- Run this in Supabase SQL Editor.
-- Non-destructive: creates missing profile structure/columns and promotes an existing Auth user only if it exists.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id),
  email text,
  full_name text,
  phone text,
  role text default 'customer',
  blocked boolean default false,
  is_active boolean default true,
  last_login_at timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text default 'customer';
alter table public.profiles add column if not exists blocked boolean default false;
alter table public.profiles add column if not exists is_active boolean default true;
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz default now();

-- Optional admin promotion.
-- Before running this block, create/sign up the admin Auth user first,
-- or replace admin@swear.com with your real admin email.
insert into public.profiles (id, email, full_name, phone, role, blocked, is_active, created_at)
select
  auth.users.id,
  auth.users.email,
  coalesce(auth.users.raw_user_meta_data->>'full_name', 'Admin'),
  coalesce(auth.users.raw_user_meta_data->>'phone', '01220172714'),
  'admin',
  false,
  true,
  now()
from auth.users
where auth.users.email = 'admin@swear.com'
on conflict (id) do update
set
  role = 'admin',
  blocked = false,
  is_active = true,
  email = excluded.email;
