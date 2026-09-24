-- Archive of long-retired titulars. Titulars retired for more than 12 months (status
-- 'suspended', shown as "Retirado") leave the platform together with their beneficiaries,
-- payments, notes and history. Only an identity record stays behind, so a search by cédula
-- or name can say "was retired, consult the old platform".

create extension if not exists pg_trgm with schema extensions;

-- Foreign keys to affiliates/beneficiaries without an index: deleting a titular had to scan
-- every beneficiary once per row. Partial, since almost all values are null.
create index if not exists beneficiaries_inherited_from_idx on public.beneficiaries (inherited_from_affiliate_id) where inherited_from_affiliate_id is not null;
create index if not exists beneficiaries_promoted_to_idx on public.beneficiaries (promoted_to_affiliate_id) where promoted_to_affiliate_id is not null;
create index if not exists beneficiaries_succession_idx on public.beneficiaries (succession_id) where succession_id is not null;
create index if not exists affiliate_successions_origin_beneficiary_idx on public.affiliate_successions (origin_beneficiary_id) where origin_beneficiary_id is not null;

create table public.archived_members (
  id uuid primary key default gen_random_uuid(),
  person_type text not null check (person_type in ('titular', 'beneficiario')),
  document_type text,
  document_number text,
  first_names text not null default '',
  last_names text not null default '',
  -- Beneficiaries: who they belonged to.
  relationship text,
  titular_document_number text,
  titular_name text,
  source public.affiliation_source,
  joined_on date,
  last_payment_on date,
  status_at_archive public.membership_status not null,
  -- member_id of the old platform, taken from the migration note ("Migrado ... (member_id=6096)").
  legacy_member_id text,
  payments_count int not null default 0,
  archive_batch_id uuid not null,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.profiles(id) on delete set null,
  search_text text generated always as (lower(coalesce(document_number, '') || ' ' || first_names || ' ' || last_names)) stored
);

create index archived_members_document_idx on public.archived_members (document_number);
create index archived_members_titular_document_idx on public.archived_members (titular_document_number);
create index archived_members_batch_idx on public.archived_members (archive_batch_id);
create index archived_members_search_idx on public.archived_members using gin (search_text extensions.gin_trgm_ops);

alter table public.archived_members enable row level security;

create policy archived_members_read on public.archived_members
for select to authenticated
using ((select private.has_permission('affiliates.read')));

revoke all on public.archived_members from anon, authenticated;
-- Written only by archive_retired_affiliates.
grant select on public.archived_members to authenticated;

-- p_apply = false: only counts what would be archived (the confirmation screen).
-- p_apply = true: archives and deletes, in this one transaction.
create or replace function public.archive_retired_affiliates(p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff date := (date_trunc('month', (now() at time zone 'America/Bogota')) - interval '12 months')::date;
  v_batch uuid := gen_random_uuid();
  v_actor uuid := (select auth.uid());
  v_titulares int;
  v_beneficiarios int;
  v_pagos int;
  v_notas int;
  v_eventos int;
  v_omitidos int;
  v_result jsonb;
begin
  if not (select private.is_administrator()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  drop table if exists archive_targets;
  drop table if exists archive_beneficiaries;

  -- Retired with no payment in the last 12 months. Anyone tied to a credit, receipt, document,
  -- succession or clearance stays: those records must keep pointing at a real titular.
  create temp table archive_targets on commit drop as
  select a.id
  from public.affiliates a
  where a.status = 'suspended'
    and (a.last_payment_on is null or a.last_payment_on < v_cutoff)
    and not exists (select 1 from public.credits c where c.affiliate_id = a.id or c.inherited_from_affiliate_id = a.id)
    and not exists (select 1 from public.payment_receipts r where r.affiliate_id = a.id)
    and not exists (select 1 from public.member_documents d where d.affiliate_id = a.id)
    and not exists (
      select 1 from public.member_documents d join public.beneficiaries b on b.id = d.beneficiary_id where b.affiliate_id = a.id
    )
    and not exists (select 1 from public.affiliate_successions s where s.deceased_affiliate_id = a.id or s.successor_affiliate_id = a.id)
    and not exists (select 1 from public.mcp_write_proposals m where m.affiliate_id = a.id)
    and not exists (select 1 from public.credit_clearances cc where cc.affiliate_id = a.id);
  create index on archive_targets (id);

  create temp table archive_beneficiaries on commit drop as
  select b.id from public.beneficiaries b where b.affiliate_id in (select id from archive_targets);
  create index on archive_beneficiaries (id);

  select count(*) into v_titulares from archive_targets;
  select count(*) into v_beneficiarios from archive_beneficiaries;
  select count(*) into v_pagos from public.payments where affiliate_id in (select id from archive_targets);
  select count(*) into v_notas from public.member_notes
    where affiliate_id in (select id from archive_targets) or beneficiary_id in (select id from archive_beneficiaries);
  select count(*) into v_eventos from public.audit_events where affiliate_id in (select id from archive_targets);
  select count(*) - v_titulares into v_omitidos from public.affiliates a
    where a.status = 'suspended' and (a.last_payment_on is null or a.last_payment_on < v_cutoff);

  v_result := jsonb_build_object(
    'applied', p_apply,
    'cutoff', v_cutoff,
    'titulares', v_titulares,
    'beneficiarios', v_beneficiarios,
    'pagos', v_pagos,
    'notas', v_notas,
    'eventos', v_eventos,
    'omitidos', v_omitidos,
    'batchId', case when p_apply then v_batch end
  );

  if not p_apply or v_titulares = 0 then
    return v_result;
  end if;

  -- 1. Identity records, titulars first.
  with legacy as (
    select distinct on (n.affiliate_id) n.affiliate_id, substring(n.body from 'member_id=(\d+)') as member_id
    from public.member_notes n
    where n.affiliate_id in (select id from archive_targets) and n.body ~ 'member_id=\d+'
    order by n.affiliate_id, n.created_at
  ),
  paid as (
    select p.affiliate_id, count(*) as payments
    from public.payments p
    where p.affiliate_id in (select id from archive_targets)
    group by p.affiliate_id
  )
  insert into public.archived_members (
    person_type, document_type, document_number, first_names, last_names, source, joined_on, last_payment_on,
    status_at_archive, legacy_member_id, payments_count, archive_batch_id, archived_by
  )
  select 'titular', a.document_type, a.document_number, coalesce(a.first_names, ''), coalesce(a.last_names, ''), a.source,
    a.joined_on, a.last_payment_on, a.status, l.member_id, coalesce(p.payments, 0), v_batch, v_actor
  from public.affiliates a
  left join legacy l on l.affiliate_id = a.id
  left join paid p on p.affiliate_id = a.id
  where a.id in (select id from archive_targets);

  insert into public.archived_members (
    person_type, document_type, document_number, first_names, last_names, relationship, titular_document_number,
    titular_name, joined_on, status_at_archive, legacy_member_id, archive_batch_id, archived_by
  )
  select 'beneficiario', b.document_type, b.document_number, coalesce(b.first_names, ''), coalesce(b.last_names, ''), b.relationship,
    a.document_number, nullif(trim(concat_ws(' ', a.first_names, a.last_names)), ''), b.joined_on, b.status,
    am.legacy_member_id, v_batch, v_actor
  from public.beneficiaries b
  join public.affiliates a on a.id = b.affiliate_id
  left join public.archived_members am on am.archive_batch_id = v_batch and am.person_type = 'titular' and am.document_number = a.document_number
  where b.id in (select id from archive_beneficiaries);

  -- 2. Delete. Per-row audit and last-payment sync would add ~550k useless writes; one summary
  -- event below records the operation instead. The transaction restores the triggers either way.
  alter table public.payments disable trigger payments_audit;
  alter table public.payments disable trigger payments_sync_last_payment;
  alter table public.beneficiaries disable trigger beneficiaries_audit;
  alter table public.affiliates disable trigger affiliates_audit;
  alter table public.member_notes disable trigger member_notes_audit;

  delete from public.audit_events where affiliate_id in (select id from archive_targets);
  delete from public.member_notes
    where affiliate_id in (select id from archive_targets) or beneficiary_id in (select id from archive_beneficiaries);
  delete from public.payments where affiliate_id in (select id from archive_targets);
  delete from public.beneficiaries where id in (select id from archive_beneficiaries);
  delete from public.affiliates where id in (select id from archive_targets);

  alter table public.payments enable trigger payments_audit;
  alter table public.payments enable trigger payments_sync_last_payment;
  alter table public.beneficiaries enable trigger beneficiaries_audit;
  alter table public.affiliates enable trigger affiliates_audit;
  alter table public.member_notes enable trigger member_notes_audit;

  insert into public.audit_events (actor_id, table_name, record_id, operation, new_data)
  values (v_actor, 'archived_members', v_batch::text, 'INSERT', v_result);

  return v_result;
end;
$$;

revoke all on function public.archive_retired_affiliates(boolean) from public, anon;
grant execute on function public.archive_retired_affiliates(boolean) to authenticated;
