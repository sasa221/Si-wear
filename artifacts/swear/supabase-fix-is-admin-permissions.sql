-- S! Wear - Fix is_admin() Function Permissions
-- Run this in Supabase SQL Editor.
-- This migration restores execute permissions for public.is_admin() to allow RLS policies to function correctly.
-- Non-destructive: only grants execute permissions, does not modify data or drop objects.

-- The is_admin() function must be executable by authenticated users for RLS policies like
-- "Profiles select own or admin" and "Orders own or admin" to work.
--
-- The function has SECURITY DEFINER set, which means it executes with the creator's (service role) privileges,
-- not the caller's privileges. This allows authenticated users to safely check admin status without
-- needing direct access to the profiles table.

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

-- Verify the function exists and permissions are now set correctly
-- (run this SELECT to confirm after migration completes)
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_admin';

-- Notify Supabase to reload the schema cache
select pg_notify('pgrst', 'reload schema');
