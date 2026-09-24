-- Complete affiliate history: every audited change that concerns an affiliate
-- (their own record, beneficiaries, payments, receipts, credits, abonos, documents
-- and notes) is tagged with affiliate_id so the Historial tab can show one timeline.

alter table public.audit_events add column affiliate_id uuid;

-- Resolves which affiliate a changed row belongs to. Abonos reach it through their
-- credit; documents and notes owned by a beneficiary, through the beneficiary.
create or replace function private.audit_affiliate_id(p_table text, p_row jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_affiliate uuid;
begin
  if p_row is null then
    return null;
  end if;
  if p_table = 'affiliates' then
    return (p_row ->> 'id')::uuid;
  end if;
  if p_table = 'credit_installments' then
    select affiliate_id into v_affiliate from public.credits where id = (p_row ->> 'credit_id')::uuid;
    return v_affiliate;
  end if;
  if nullif(p_row ->> 'affiliate_id', '') is not null then
    return (p_row ->> 'affiliate_id')::uuid;
  end if;
  if nullif(p_row ->> 'beneficiary_id', '') is not null then
    select affiliate_id into v_affiliate from public.beneficiaries where id = (p_row ->> 'beneficiary_id')::uuid;
    return v_affiliate;
  end if;
  return null;
end;
$$;

create or replace function private.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_events (actor_id, table_name, record_id, operation, old_data, new_data, affiliate_id)
  values (
    (select auth.uid()),
    tg_table_name,
    v_row ->> 'id',
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    private.audit_affiliate_id(tg_table_name, v_row)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Documents and notes were not audited at all.
create trigger member_documents_audit after insert or update or delete on public.member_documents
for each row execute function private.record_audit_event();
create trigger member_notes_audit after insert or update or delete on public.member_notes
for each row execute function private.record_audit_event();

-- Backfill: tag existing events...
update public.audit_events
set affiliate_id = private.audit_affiliate_id(table_name, coalesce(new_data, old_data))
where affiliate_id is null
  and table_name in ('affiliates', 'beneficiaries', 'payments', 'payment_receipts', 'credits', 'credit_installments');

-- Abonos of credits that were later deleted: take the affiliate from the credit's
-- own audit events.
update public.audit_events i
set affiliate_id = c.affiliate_id
from (
  select distinct on (record_id) record_id, affiliate_id
  from public.audit_events
  where table_name = 'credits' and affiliate_id is not null
  order by record_id, occurred_at
) c
where i.table_name = 'credit_installments'
  and i.affiliate_id is null
  and c.record_id = coalesce(i.new_data, i.old_data) ->> 'credit_id';

-- ...and record the creation of documents and notes that predate their triggers,
-- with their real author and date.
insert into public.audit_events (actor_id, table_name, record_id, operation, new_data, occurred_at, affiliate_id)
select d.uploaded_by, 'member_documents', d.id::text, 'INSERT', to_jsonb(d), d.uploaded_at,
  private.audit_affiliate_id('member_documents', to_jsonb(d))
from public.member_documents d;

insert into public.audit_events (actor_id, table_name, record_id, operation, new_data, occurred_at, affiliate_id)
select n.created_by, 'member_notes', n.id::text, 'INSERT', to_jsonb(n), n.created_at,
  private.audit_affiliate_id('member_notes', to_jsonb(n))
from public.member_notes n;

create index audit_events_affiliate_idx on public.audit_events (affiliate_id, occurred_at desc)
where affiliate_id is not null;

-- Timeline for the Historial tab. Readable by anyone who can read the affiliate,
-- like get_record_history; the full audit log still requires audit.read.
create or replace function public.get_affiliate_history(p_affiliate_id uuid, p_limit integer default 300)
returns table (
  id bigint,
  table_name text,
  record_id text,
  actor_name text,
  operation text,
  occurred_at timestamptz,
  old_data jsonb,
  new_data jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('affiliates.read') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select e.id, e.table_name, e.record_id, p.display_name, e.operation, e.occurred_at, e.old_data, e.new_data
  from public.audit_events e
  left join public.profiles p on p.id = e.actor_id
  where e.affiliate_id = p_affiliate_id
  order by e.occurred_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end;
$$;

grant execute on function public.get_affiliate_history(uuid, integer) to authenticated;
