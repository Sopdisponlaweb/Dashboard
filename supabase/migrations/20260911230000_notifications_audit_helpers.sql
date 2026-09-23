-- Generic permission-check RPC so the UI can gate controls (e.g. who may broadcast a
-- notification, manage announcements) without duplicating private.has_permission's logic
-- or exposing the private schema itself.
create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission(permission_key);
$$;

grant execute on function public.has_permission(text) to authenticated;

-- audit_events only had an index shaped for "history of one record" lookups
-- (table_name, record_id, occurred_at). The audit UI needs a global feed ordered
-- by time, and mora refreshes can write 100k+ rows in a single sweep, so a plain
-- ORDER BY occurred_at desc would degrade fast without a dedicated index.
create index if not exists audit_events_occurred_idx on public.audit_events (occurred_at desc);
create index if not exists audit_events_actor_idx on public.audit_events (actor_id, occurred_at desc) where actor_id is not null;
