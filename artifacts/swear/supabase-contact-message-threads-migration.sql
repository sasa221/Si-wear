-- S! Wear - Contact message support threads
-- Run this in Supabase SQL Editor.
--
-- Non-destructive and idempotent:
-- - Keeps existing contact_messages rows and legacy admin_reply fields.
-- - Adds a real contact_message_replies thread table.
-- - Backfills old admin_reply values into the thread table without duplicates.
-- - Allows multiple customer/admin replies until an admin closes the thread.

create extension if not exists pgcrypto;

alter table public.contact_messages add column if not exists closed_at timestamptz;
alter table public.contact_messages add column if not exists closed_by uuid references public.profiles(id);
alter table public.contact_messages add column if not exists last_reply_at timestamptz;
alter table public.contact_messages add column if not exists last_reply_by uuid references public.profiles(id);
alter table public.contact_messages alter column status set default 'open';

update public.contact_messages
set status = case lower(btrim(coalesce(status, '')))
  when 'replied' then 'admin_replied'
  when 'admin_replied' then 'admin_replied'
  when 'customer_replied' then 'customer_replied'
  when 'pending_admin' then 'pending_admin'
  when 'closed' then 'closed'
  else 'open'
end;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.contact_messages'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.contact_messages drop constraint %I', constraint_name);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact_messages'::regclass
      and conname = 'contact_messages_status_check'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_status_check
      check (status in ('open', 'customer_replied', 'pending_admin', 'admin_replied', 'closed'));
  end if;
end $$;

alter table public.contact_messages alter column status set not null;

create table if not exists public.contact_message_replies (
  id uuid primary key default gen_random_uuid(),
  contact_message_id uuid not null references public.contact_messages(id) on delete cascade,
  sender_id uuid,
  sender_role text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_message_replies add column if not exists contact_message_id uuid;
alter table public.contact_message_replies add column if not exists sender_id uuid;
alter table public.contact_message_replies add column if not exists sender_role text;
alter table public.contact_message_replies add column if not exists message text;
alter table public.contact_message_replies add column if not exists created_at timestamptz default now();

update public.contact_message_replies
set sender_role = 'customer'
where sender_role is null;

update public.contact_message_replies
set message = ''
where message is null;

update public.contact_message_replies
set created_at = now()
where created_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact_message_replies'::regclass
      and contype = 'f'
      and conname = 'contact_message_replies_contact_message_id_fkey'
  ) then
    alter table public.contact_message_replies
      add constraint contact_message_replies_contact_message_id_fkey
      foreign key (contact_message_id)
      references public.contact_messages(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact_message_replies'::regclass
      and conname = 'contact_message_replies_sender_role_check'
  ) then
    alter table public.contact_message_replies
      add constraint contact_message_replies_sender_role_check
      check (sender_role in ('customer', 'admin'));
  end if;
end $$;

alter table public.contact_message_replies alter column contact_message_id set not null;
alter table public.contact_message_replies alter column sender_role set not null;
alter table public.contact_message_replies alter column message set not null;
alter table public.contact_message_replies alter column created_at set default now();
alter table public.contact_message_replies alter column created_at set not null;

insert into public.contact_message_replies (
  contact_message_id,
  sender_id,
  sender_role,
  message,
  created_at
)
select
  cm.id,
  case
    when cm.replied_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then cm.replied_by::uuid
    else null
  end,
  'admin',
  btrim(cm.admin_reply),
  coalesce(cm.replied_at, cm.last_reply_at, cm.created_at, now())
from public.contact_messages cm
where nullif(btrim(coalesce(cm.admin_reply, '')), '') is not null
  and not exists (
    select 1
    from public.contact_message_replies r
    where r.contact_message_id = cm.id
      and r.sender_role = 'admin'
      and btrim(r.message) = btrim(cm.admin_reply)
  );

with latest_reply as (
  select distinct on (r.contact_message_id)
    r.contact_message_id,
    r.sender_id,
    r.created_at
  from public.contact_message_replies r
  order by r.contact_message_id, r.created_at desc, r.id desc
)
update public.contact_messages cm
set
  last_reply_at = latest_reply.created_at,
  last_reply_by = latest_reply.sender_id
from latest_reply
where cm.id = latest_reply.contact_message_id
  and (cm.last_reply_at is null or latest_reply.created_at > cm.last_reply_at);

update public.contact_messages
set status = 'admin_replied'
where status = 'open'
  and nullif(btrim(coalesce(admin_reply, '')), '') is not null;

create index if not exists contact_message_replies_message_idx
  on public.contact_message_replies(contact_message_id, created_at asc);

create index if not exists contact_message_replies_sender_role_idx
  on public.contact_message_replies(sender_role);

create index if not exists contact_messages_last_reply_at_idx
  on public.contact_messages(last_reply_at desc);

alter table public.contact_message_replies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_message_replies'
      and policyname = 'Contact replies select own or admin'
  ) then
    create policy "Contact replies select own or admin"
      on public.contact_message_replies
      for select
      using (
        public.is_admin()
        or exists (
          select 1
          from public.contact_messages cm
          where cm.id = contact_message_replies.contact_message_id
            and cm.customer_id = auth.uid()::text
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_message_replies'
      and policyname = 'Contact replies insert own or admin'
  ) then
    create policy "Contact replies insert own or admin"
      on public.contact_message_replies
      for insert
      with check (
        public.is_admin()
        or (
          sender_role = 'customer'
          and sender_id = auth.uid()
          and exists (
            select 1
            from public.contact_messages cm
            where cm.id = contact_message_replies.contact_message_id
              and cm.customer_id = auth.uid()::text
              and cm.status <> 'closed'
          )
        )
      );
  end if;
end $$;

alter table public.contact_message_replies replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'contact_message_replies'
     ) then
    alter publication supabase_realtime add table public.contact_message_replies;
  end if;
end $$;

select
  (select count(*) from public.contact_message_replies) as thread_reply_count,
  (select count(*) from public.contact_messages where status = 'customer_replied') as customer_replied_count,
  (select count(*) from public.contact_messages where status = 'admin_replied') as admin_replied_count,
  (select count(*) from public.contact_messages where status = 'closed') as closed_count;
