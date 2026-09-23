create table public.mcp_write_proposals (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  affiliate_id uuid not null references public.affiliates (id) on delete restrict,
  payload jsonb not null,
  summary text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  result jsonb,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  confirmed_at timestamptz
);

create index mcp_write_proposals_created_by_idx on public.mcp_write_proposals (created_by, created_at desc);

alter table public.mcp_write_proposals enable row level security;

-- append-only: nunca se borra, solo se actualiza al confirmar/cancelar.
revoke delete on public.mcp_write_proposals from authenticated;

create policy mcp_write_proposals_select on public.mcp_write_proposals for select to authenticated
using (created_by = (select auth.uid()));

create policy mcp_write_proposals_insert on public.mcp_write_proposals for insert to authenticated
with check (created_by = (select auth.uid()));

create policy mcp_write_proposals_update on public.mcp_write_proposals for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create trigger mcp_write_proposals_audit after insert or update on public.mcp_write_proposals
for each row execute function private.record_audit_event();
