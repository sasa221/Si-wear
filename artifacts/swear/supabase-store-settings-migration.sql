-- S! Wear - Store settings migration
-- Run this in Supabase SQL Editor.
-- Non-destructive: creates one settings table and a default row. Existing data is preserved.

create table if not exists public.store_settings (
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

alter table public.store_settings add column if not exists brand_name text not null default 'S! Wear';
alter table public.store_settings add column if not exists whatsapp_number text not null default '201220172714';
alter table public.store_settings add column if not exists announcement_bar_text text not null default '';
alter table public.store_settings add column if not exists instagram_url text not null default '';
alter table public.store_settings add column if not exists tiktok_url text not null default '';
alter table public.store_settings add column if not exists facebook_url text not null default '';
alter table public.store_settings add column if not exists store_location text not null default 'Gate 1, 113D Pyramids Gardens, Giza, Egypt';
alter table public.store_settings add column if not exists shipping_note text not null default 'Delivery fee is calculated by governorate and city/area at checkout.';
alter table public.store_settings add column if not exists returns_policy_text text not null default '7-day exchange policy for delivered orders.';
alter table public.store_settings add column if not exists support_info text not null default '+20 122 017 2714';
alter table public.store_settings add column if not exists updated_at timestamptz default now();

insert into public.store_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.store_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_settings'
      and policyname = 'Allow all on store_settings'
  ) then
    create policy "Allow all on store_settings"
      on public.store_settings
      for all
      using (true)
      with check (public.is_admin());
  end if;
end $$;

alter policy "Allow all on store_settings" on public.store_settings
  using (true)
  with check (public.is_admin());
