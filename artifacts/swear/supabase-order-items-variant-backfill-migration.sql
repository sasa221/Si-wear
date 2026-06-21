-- S! Wear - Safe order_items.variant_id uuid migration and backfill
-- Run this in Supabase SQL Editor.
--
-- Fully non-destructive and idempotent:
-- - Detects the current public.order_items.variant_id type.
-- - Adds variant_id as uuid when missing.
-- - Converts legacy text variant_id through a temporary uuid column without
--   casting invalid strings.
-- - Preserves old non-empty text values in legacy_variant_id_text when needed.
-- - Clears only invalid/orphan variant_id references after preserving them, so
--   the final FK can be added safely.
-- - Backfills missing variant_id from product_id + normalized size/color using
--   a deterministic product_variants ordering.

create temporary table if not exists order_items_variant_id_migration_report (
  detected_variant_id_type text,
  final_variant_id_type text,
  invalid_legacy_variant_id_text_count bigint,
  fk_exists boolean,
  fk_can_be_added boolean,
  note text
);

delete from order_items_variant_id_migration_report;

do $$
declare
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  detected_type text;
  detected_udt_name text;
  final_type text;
  final_udt_name text;
  invalid_legacy_count bigint := 0;
  orphan_uuid_count bigint := 0;
  fk_exists boolean := false;
begin
  select c.data_type, c.udt_name
    into detected_type, detected_udt_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'order_items'
    and c.column_name = 'variant_id';

  if detected_udt_name is null then
    raise notice 'public.order_items.variant_id is missing; adding uuid nullable column.';
    alter table public.order_items add column variant_id uuid;
    detected_type := 'missing';
    detected_udt_name := 'missing';
  elsif detected_udt_name = 'uuid' then
    raise notice 'public.order_items.variant_id is already uuid; leaving type unchanged.';
  elsif detected_udt_name in ('text', 'varchar', 'bpchar') then
    raise notice 'public.order_items.variant_id is %, converting safely to uuid.', detected_udt_name;

    alter table public.order_items add column if not exists variant_id_uuid uuid;

    update public.order_items
    set variant_id_uuid = variant_id::uuid
    where variant_id_uuid is null
      and variant_id ~* uuid_pattern;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'order_items'
        and column_name = 'legacy_variant_id_text'
    ) then
      alter table public.order_items rename column variant_id to legacy_variant_id_text;
    else
      update public.order_items
      set legacy_variant_id_text = variant_id
      where nullif(btrim(variant_id), '') is not null
        and nullif(btrim(coalesce(legacy_variant_id_text, '')), '') is null;

      alter table public.order_items drop column variant_id;
    end if;

    alter table public.order_items rename column variant_id_uuid to variant_id;
  else
    raise exception 'Unsupported public.order_items.variant_id type %.%. Expected missing, text, varchar, char, or uuid.',
      detected_type,
      detected_udt_name;
  end if;

  select c.data_type, c.udt_name
    into final_type, final_udt_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'order_items'
    and c.column_name = 'variant_id';

  if final_udt_name <> 'uuid' then
    raise exception 'public.order_items.variant_id final type is %, expected uuid.', final_udt_name;
  end if;

  select count(*)
    into orphan_uuid_count
  from public.order_items oi
  where oi.variant_id is not null
    and not exists (
      select 1
      from public.product_variants pv
      where pv.id = oi.variant_id
    );

  if orphan_uuid_count > 0 then
    raise notice 'Preserving and clearing % orphan order_items.variant_id UUID values before FK creation.', orphan_uuid_count;
    alter table public.order_items add column if not exists legacy_variant_id_text text;

    update public.order_items oi
    set legacy_variant_id_text = oi.variant_id::text
    where oi.variant_id is not null
      and not exists (
        select 1
        from public.product_variants pv
        where pv.id = oi.variant_id
      )
      and nullif(btrim(coalesce(oi.legacy_variant_id_text, '')), '') is null;

    update public.order_items oi
    set variant_id = null
    where oi.variant_id is not null
      and not exists (
        select 1
        from public.product_variants pv
        where pv.id = oi.variant_id
      );
  end if;

  update public.order_items oi
  set variant_id = (
    select pv.id
    from public.product_variants pv
    where pv.product_id = case
        when oi.product_id::text ~* uuid_pattern then oi.product_id::text::uuid
        else null::uuid
      end
      and lower(btrim(pv.size)) = lower(btrim(oi.size))
      and lower(btrim(pv.color)) = lower(btrim(oi.color))
    order by
      coalesce(pv.active, true) desc,
      coalesce(pv.stock, 0) desc,
      pv.id::text asc
    limit 1
  )
  where oi.variant_id is null
    and exists (
      select 1
      from public.product_variants pv
      where pv.product_id = case
          when oi.product_id::text ~* uuid_pattern then oi.product_id::text::uuid
          else null::uuid
        end
        and lower(btrim(pv.size)) = lower(btrim(oi.size))
        and lower(btrim(pv.color)) = lower(btrim(oi.color))
    );

  select exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.conrelid = 'public.order_items'::regclass
      and c.confrelid = 'public.product_variants'::regclass
      and a.attname = 'variant_id'
  )
    into fk_exists;

  if not fk_exists
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.order_items'::regclass
         and conname = 'order_items_variant_id_fkey'
     ) then
    alter table public.order_items
      add constraint order_items_variant_id_fkey
      foreign key (variant_id)
      references public.product_variants(id)
      on delete set null;

    fk_exists := true;
  end if;

  select count(*)
    into invalid_legacy_count
  from public.order_items oi
  where nullif(btrim(to_jsonb(oi) ->> 'legacy_variant_id_text'), '') is not null
    and not ((to_jsonb(oi) ->> 'legacy_variant_id_text') ~* uuid_pattern);

  insert into order_items_variant_id_migration_report (
    detected_variant_id_type,
    final_variant_id_type,
    invalid_legacy_variant_id_text_count,
    fk_exists,
    fk_can_be_added,
    note
  )
  values (
    detected_type || ' / ' || detected_udt_name,
    final_type || ' / ' || final_udt_name,
    invalid_legacy_count,
    fk_exists,
    final_udt_name = 'uuid',
    case
      when invalid_legacy_count > 0 then 'Invalid legacy text values were preserved in legacy_variant_id_text.'
      else 'No invalid legacy text values detected.'
    end
  );
end $$;

create index if not exists order_items_variant_id_idx
  on public.order_items(variant_id);

-- Migration summary. In the current reported production state this should show
-- detected_variant_id_type = text / text and final_variant_id_type = USER-DEFINED / uuid.
select
  detected_variant_id_type,
  final_variant_id_type,
  invalid_legacy_variant_id_text_count,
  fk_exists,
  fk_can_be_added,
  note
from order_items_variant_id_migration_report;

-- Review any rows returned here. They still have no matched variant after the
-- safe conversion and deterministic product/size/color backfill.
select
  oi.id as order_item_id,
  oi.order_id,
  oi.product_id,
  oi.product_name,
  oi.size,
  oi.color,
  oi.quantity,
  to_jsonb(oi) ->> 'legacy_variant_id_text' as legacy_variant_id_text
from public.order_items oi
where oi.variant_id is null
order by oi.order_id, oi.id;
