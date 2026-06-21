-- S! Wear - Persistent cancellation request workflow
-- Run this in Supabase SQL Editor.
-- Non-destructive: adds missing columns/indexes and changes only the future
-- default for cancellation_status. Existing orders, stock, users, RLS policies,
-- and cancellation values are preserved.

alter table public.orders add column if not exists cancellation_requested boolean default false;
alter table public.orders add column if not exists cancellation_status text default null;
alter table public.orders alter column cancellation_status drop default;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists cancellation_requested_at timestamptz;
alter table public.orders add column if not exists cancellation_resolved_at timestamptz;
alter table public.orders add column if not exists cancellation_reviewed_at timestamptz;
alter table public.orders add column if not exists cancellation_reviewed_by uuid references public.profiles(id);
alter table public.orders add column if not exists cancellation_admin_note text;

create index if not exists orders_cancellation_status_idx
  on public.orders(cancellation_status);

create index if not exists orders_cancellation_pending_idx
  on public.orders(created_at desc)
  where cancellation_requested is true
    or lower(coalesce(cancellation_status, '')) = 'pending';

