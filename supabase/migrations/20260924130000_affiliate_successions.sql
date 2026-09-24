-- Succession of a deceased affiliate. The successor (one of the deceased's beneficiaries,
-- an existing affiliate or a new person) inherits the beneficiaries and, optionally, the
-- active credit. Payments are never moved: the successor sees the deceased's history.
-- A credit that is not inherited stays paused until it is inherited, forgiven or cancelled.

alter type public.credit_status add value if not exists 'paused';
alter type public.credit_status add value if not exists 'forgiven';

create table public.affiliate_successions (
  id uuid primary key default gen_random_uuid(),
  deceased_affiliate_id uuid not null references public.affiliates (id) on delete restrict,
  -- set null only if an annulled succession's newly created successor is removed
  successor_affiliate_id uuid references public.affiliates (id) on delete set null,
  successor_name text not null,
  successor_document text not null,
  successor_origin text not null check (successor_origin in ('beneficiary', 'existing', 'new')),
  origin_beneficiary_id uuid references public.beneficiaries (id) on delete set null,
  successor_created boolean not null default false,
  succession_date date not null,
  resolution_number text,
  credit_id uuid references public.credits (id) on delete set null,
  credit_decision text not null check (credit_decision in ('none', 'inherited', 'paused')),
  transferred_beneficiaries integer not null default 0,
  support_document_id uuid references public.member_documents (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  annulled_at timestamptz,
  annulled_by uuid references public.profiles (id) on delete set null,
  annul_reason text,
  constraint affiliate_successions_distinct check (deceased_affiliate_id <> successor_affiliate_id),
  constraint affiliate_successions_annulment check ((annulled_at is null) = (annulled_by is null))
);

-- One current succession per deceased; annulled ones stay for the record.
create unique index affiliate_successions_current_idx on public.affiliate_successions (deceased_affiliate_id)
where annulled_at is null;
create index affiliate_successions_successor_idx on public.affiliate_successions (successor_affiliate_id);

alter table public.affiliate_successions enable row level security;
create policy affiliate_successions_read on public.affiliate_successions for select to authenticated
using ((select private.has_permission('affiliates.read')));
-- Writes only through the functions below.
revoke all on table public.affiliate_successions from anon, authenticated;
grant select on public.affiliate_successions to authenticated;

create trigger affiliate_successions_audit after insert or update or delete on public.affiliate_successions
for each row execute function private.record_audit_event();

alter table public.beneficiaries
  add column inherited_from_affiliate_id uuid references public.affiliates (id) on delete set null,
  add column succession_id uuid references public.affiliate_successions (id) on delete set null,
  -- the beneficiary who became the successor stays on the deceased's record, flagged
  add column promoted_to_affiliate_id uuid references public.affiliates (id) on delete set null;

alter table public.credits
  add column inherited_from_affiliate_id uuid references public.affiliates (id) on delete set null,
  add column succession_id uuid references public.affiliate_successions (id) on delete set null;

-- Successions belong to the deceased's timeline (the successor's is added in get_affiliate_history).
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
  if p_table = 'affiliate_successions' then
    return (p_row ->> 'deceased_affiliate_id')::uuid;
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
     or (e.table_name = 'affiliate_successions'
         and coalesce(e.new_data, e.old_data) ->> 'successor_affiliate_id' = p_affiliate_id::text)
  order by e.occurred_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end;
$$;

create or replace function private.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    join public.profiles on profiles.id = user_roles.user_id
    where user_roles.user_id = (select auth.uid()) and profiles.is_active and roles.key = 'administrator'
  );
$$;

create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_administrator(); $$;

grant execute on function public.is_administrator() to authenticated;

-- Registers a succession in one transaction.
--   p_mode: 'beneficiary' (p_beneficiary_id), 'existing' (p_existing_affiliate_id) or 'new' (p_person).
--   p_person: document_type, document_number, first_names, last_names, phone, email, birth_date;
--             for 'beneficiary' it may complete the document the beneficiary lacks.
--   p_credit_decision: 'inherited' or 'paused' (ignored when there is no active credit).
create or replace function public.register_succession(
  p_deceased_id uuid,
  p_mode text,
  p_existing_affiliate_id uuid,
  p_beneficiary_id uuid,
  p_person jsonb,
  p_source public.affiliation_source,
  p_succession_date date,
  p_resolution_number text,
  p_beneficiary_ids uuid[],
  p_credit_decision text,
  p_notes text,
  p_support_document_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_deceased public.affiliates;
  v_beneficiary public.beneficiaries;
  v_successor_id uuid;
  v_created boolean := false;
  v_credit public.credits;
  v_decision text := 'none';
  v_transferred integer := 0;
  v_succession_id uuid := gen_random_uuid();
  v_doc_type text;
  v_doc_number text;
  v_first text;
  v_last text;
  v_phone text;
  v_email text;
  v_birth date;
begin
  if not private.has_permission('affiliates.manage') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select * into v_deceased from public.affiliates where id = p_deceased_id for update;
  if not found then
    raise exception 'deceased_not_found' using errcode = 'P0002';
  end if;
  if v_deceased.status <> 'deceased' then
    raise exception 'not_deceased' using errcode = '22023';
  end if;
  if exists (select 1 from public.affiliate_successions where deceased_affiliate_id = p_deceased_id and annulled_at is null) then
    raise exception 'succession_exists' using errcode = '23505';
  end if;
  if p_succession_date is null or p_succession_date > v_today then
    raise exception 'invalid_succession_date' using errcode = '22023';
  end if;
  if p_credit_decision not in ('inherited', 'paused') then
    raise exception 'invalid_credit_decision' using errcode = '22023';
  end if;

  -- 1. Successor.
  if p_mode = 'existing' then
    select id into v_successor_id from public.affiliates
    where id = p_existing_affiliate_id and status <> 'deceased' and id <> p_deceased_id;
    if v_successor_id is null then
      raise exception 'invalid_successor' using errcode = '22023';
    end if;
    select document_type, document_number, first_names, last_names
    into v_doc_type, v_doc_number, v_first, v_last
    from public.affiliates where id = v_successor_id;
  elsif p_mode in ('beneficiary', 'new') then
    if p_mode = 'beneficiary' then
      select * into v_beneficiary from public.beneficiaries
      where id = p_beneficiary_id and affiliate_id = p_deceased_id and status <> 'deceased';
      if not found then
        raise exception 'invalid_successor' using errcode = '22023';
      end if;
      v_doc_type := coalesce(nullif(p_person ->> 'document_type', ''), v_beneficiary.document_type, 'CC');
      v_doc_number := coalesce(nullif(p_person ->> 'document_number', ''), v_beneficiary.document_number);
      v_first := coalesce(nullif(p_person ->> 'first_names', ''), v_beneficiary.first_names);
      v_last := coalesce(nullif(p_person ->> 'last_names', ''), v_beneficiary.last_names);
      v_phone := coalesce(nullif(p_person ->> 'phone', ''), v_beneficiary.phone);
      v_email := coalesce(nullif(p_person ->> 'email', ''), v_beneficiary.email);
      v_birth := coalesce(nullif(p_person ->> 'birth_date', '')::date, v_beneficiary.birth_date);
    else
      v_doc_type := coalesce(nullif(p_person ->> 'document_type', ''), 'CC');
      v_doc_number := nullif(p_person ->> 'document_number', '');
      v_first := nullif(p_person ->> 'first_names', '');
      v_last := nullif(p_person ->> 'last_names', '');
      v_phone := nullif(p_person ->> 'phone', '');
      v_email := nullif(p_person ->> 'email', '');
      v_birth := nullif(p_person ->> 'birth_date', '')::date;
    end if;
    if v_doc_number is null or v_first is null or v_last is null then
      raise exception 'successor_data_incomplete' using errcode = '22023';
    end if;
    if exists (select 1 from public.affiliates where document_number = v_doc_number) then
      raise exception 'successor_document_exists' using errcode = '23505';
    end if;

    -- The successor keeps the deceased's seniority: same affiliation date (no new waiting
    -- period) and last payment, so the arrears rule continues from the same point.
    insert into public.affiliates (
      document_type, document_number, first_names, last_names, phone, email, birth_date,
      address, municipality_id, organization_id, source, status, joined_on, last_payment_on,
      internal_notes, created_by
    ) values (
      v_doc_type, v_doc_number, v_first, v_last, v_phone, v_email, v_birth,
      v_deceased.address, v_deceased.municipality_id, v_deceased.organization_id, p_source, 'active',
      v_deceased.joined_on, v_deceased.last_payment_on,
      'Titular por sucesión de ' || v_deceased.first_names || ' ' || v_deceased.last_names, v_user
    ) returning id into v_successor_id;
    v_created := true;
  else
    raise exception 'invalid_mode' using errcode = '22023';
  end if;

  if not v_created and p_source is not null then
    -- An existing affiliate keeps their record; the chosen type still applies.
    update public.affiliates set source = p_source where id = v_successor_id and source <> p_source;
  end if;

  insert into public.affiliate_successions (
    id, deceased_affiliate_id, successor_affiliate_id, successor_name, successor_document, successor_origin,
    origin_beneficiary_id, successor_created, succession_date, resolution_number, credit_decision,
    support_document_id, notes, created_by
  ) values (
    v_succession_id, p_deceased_id, v_successor_id, v_first || ' ' || v_last, v_doc_type || ' ' || v_doc_number,
    p_mode, case when p_mode = 'beneficiary' then p_beneficiary_id end, v_created, p_succession_date,
    nullif(p_resolution_number, ''), 'none', p_support_document_id, nullif(p_notes, ''), v_user
  );

  -- 2. The beneficiary who became titular stays on the deceased's record, flagged.
  if p_mode = 'beneficiary' then
    update public.beneficiaries set promoted_to_affiliate_id = v_successor_id, succession_id = v_succession_id
    where id = p_beneficiary_id;
  end if;

  -- 3. Chosen beneficiaries move to the successor, keeping their own joined_on.
  update public.beneficiaries
  set affiliate_id = v_successor_id,
      inherited_from_affiliate_id = p_deceased_id,
      succession_id = v_succession_id
  where affiliate_id = p_deceased_id
    and id = any (coalesce(p_beneficiary_ids, '{}'))
    and status <> 'deceased'
    and promoted_to_affiliate_id is null;
  get diagnostics v_transferred = row_count;

  -- 4. Active credit: inherited or paused.
  select * into v_credit from public.credits where affiliate_id = p_deceased_id and status = 'active' for update;
  if found then
    if p_credit_decision = 'inherited' then
      if exists (select 1 from public.credits where affiliate_id = v_successor_id and status = 'active') then
        raise exception 'successor_has_active_credit' using errcode = '23505';
      end if;
      update public.credits
      set affiliate_id = v_successor_id, inherited_from_affiliate_id = p_deceased_id, succession_id = v_succession_id
      where id = v_credit.id;
      v_decision := 'inherited';
    else
      update public.credits set status = 'paused', succession_id = v_succession_id where id = v_credit.id;
      v_decision := 'paused';
    end if;
  end if;

  update public.affiliate_successions
  set credit_id = v_credit.id, credit_decision = v_decision, transferred_beneficiaries = v_transferred
  where id = v_succession_id;

  -- 5. The deceased's successor fields now describe a real affiliate.
  update public.affiliates
  set successor_resolution_number = coalesce(nullif(p_resolution_number, ''), successor_resolution_number),
      successor_document_number = v_doc_number,
      successor_first_names = v_first,
      successor_last_names = v_last,
      successor_phone = coalesce(v_phone, successor_phone)
  where id = p_deceased_id;

  -- Transferred beneficiaries take the successor's arrears status.
  perform private.refresh_membership_statuses(v_today);

  return v_succession_id;
end;
$$;

grant execute on function public.register_succession(
  uuid, text, uuid, uuid, jsonb, public.affiliation_source, date, text, uuid[], text, text, uuid
) to authenticated;

-- A paused credit (its titular died and the successor did not take it) is later
-- inherited by the successor, forgiven or cancelled.
create or replace function public.resolve_paused_credit(p_credit_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit public.credits;
  v_succession public.affiliate_successions;
  v_note text := nullif(p_note, '');
begin
  if not private.has_permission('credits.manage') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select * into v_credit from public.credits where id = p_credit_id for update;
  if not found or v_credit.status <> 'paused' then
    raise exception 'credit_not_paused' using errcode = '22023';
  end if;

  if p_action = 'inherit' then
    select * into v_succession from public.affiliate_successions
    where deceased_affiliate_id = v_credit.affiliate_id and annulled_at is null;
    if not found or v_succession.successor_affiliate_id is null then
      raise exception 'no_succession' using errcode = '22023';
    end if;
    if exists (select 1 from public.credits where affiliate_id = v_succession.successor_affiliate_id and status = 'active') then
      raise exception 'successor_has_active_credit' using errcode = '23505';
    end if;
    update public.credits
    set status = 'active', affiliate_id = v_succession.successor_affiliate_id,
        inherited_from_affiliate_id = v_credit.affiliate_id, succession_id = v_succession.id,
        observations = concat_ws(E'\n', observations, 'Heredado por sucesión. ' || coalesce(v_note, ''))
    where id = p_credit_id;
    update public.affiliate_successions set credit_decision = 'inherited', credit_id = p_credit_id where id = v_succession.id;
  elsif p_action in ('forgive', 'cancel') then
    update public.credits
    set status = case when p_action = 'forgive' then 'forgiven'::public.credit_status else 'cancelled'::public.credit_status end,
        observations = concat_ws(E'\n', observations,
          case when p_action = 'forgive' then 'Condonado. ' else 'Cancelado. ' end || coalesce(v_note, ''))
    where id = p_credit_id;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
end;
$$;

grant execute on function public.resolve_paused_credit(uuid, text, text) to authenticated;

-- Undoes a succession (administrators only). Beneficiaries return to the deceased, an
-- inherited credit returns paused, and a successor created by the succession is removed
-- when nothing else has been recorded for them; otherwise it stays as a regular affiliate.
create or replace function public.annul_succession(p_succession_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.affiliate_successions;
  v_successor_removed boolean := false;
  v_returned integer := 0;
begin
  if not private.is_administrator() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select * into v_s from public.affiliate_successions where id = p_succession_id and annulled_at is null for update;
  if not found then
    raise exception 'succession_not_found' using errcode = 'P0002';
  end if;

  update public.beneficiaries
  set affiliate_id = v_s.deceased_affiliate_id, inherited_from_affiliate_id = null, succession_id = null
  where succession_id = v_s.id and inherited_from_affiliate_id = v_s.deceased_affiliate_id;
  get diagnostics v_returned = row_count;

  update public.beneficiaries set promoted_to_affiliate_id = null, succession_id = null
  where succession_id = v_s.id and promoted_to_affiliate_id is not null;

  update public.credits
  set affiliate_id = v_s.deceased_affiliate_id, inherited_from_affiliate_id = null,
      status = case when status = 'active' then 'paused'::public.credit_status else status end
  where succession_id = v_s.id;
  update public.credits set succession_id = null where succession_id = v_s.id;

  update public.affiliates
  set successor_document_number = null, successor_first_names = null, successor_last_names = null
  where id = v_s.deceased_affiliate_id;

  update public.affiliate_successions
  set annulled_at = now(), annulled_by = (select auth.uid()), annul_reason = trim(p_reason)
  where id = v_s.id;

  if v_s.successor_created and v_s.successor_affiliate_id is not null
     and not exists (select 1 from public.payments where affiliate_id = v_s.successor_affiliate_id)
     and not exists (select 1 from public.credits where affiliate_id = v_s.successor_affiliate_id)
     and not exists (select 1 from public.beneficiaries where affiliate_id = v_s.successor_affiliate_id)
     and not exists (select 1 from public.member_documents where affiliate_id = v_s.successor_affiliate_id)
     and not exists (select 1 from public.member_notes where affiliate_id = v_s.successor_affiliate_id)
     and not exists (select 1 from public.payment_receipts where affiliate_id = v_s.successor_affiliate_id) then
    delete from public.affiliates where id = v_s.successor_affiliate_id;
    v_successor_removed := true;
  end if;

  perform private.refresh_membership_statuses((now() at time zone 'America/Bogota')::date);

  return jsonb_build_object('beneficiariesReturned', v_returned, 'successorRemoved', v_successor_removed);
end;
$$;

grant execute on function public.annul_succession(uuid, text) to authenticated;

-- Dashboard: a promoted beneficiary is now counted as titular, not twice; and the
-- deceased still waiting for a succession are counted.
create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Bogota')::date;
  result jsonb;
  v_last_amount numeric;
  v_prev_amount numeric;
  v_change numeric;
begin
  if not (select private.has_permission('dashboard.read')) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'operationalTotal', (select count(*) from public.affiliates where status <> 'deceased'),
    'holderStatusCounts', jsonb_build_object(
      'active', (select count(*) from public.affiliates where status = 'active'),
      'inactive', (select count(*) from public.affiliates where status = 'inactive'),
      'suspended', (select count(*) from public.affiliates where status = 'suspended'),
      'deceased', (select count(*) from public.affiliates where status = 'deceased')
    ),
    'pendingSuccessionCount', (
      select count(*) from public.affiliates a
      where a.status = 'deceased'
        and not exists (
          select 1 from public.affiliate_successions s
          where s.deceased_affiliate_id = a.id and s.annulled_at is null
        )
    ),
    -- joined_on in the future is bad migrated data, not a waiting period.
    'waitingCoverageCount', (
      select count(*) from public.affiliates
      where status = 'active' and full_coverage_on > today and joined_on <= today
    ),
    'upcomingCoverageCount', (
      select count(*) from public.affiliates
      where status = 'active' and full_coverage_on > today and full_coverage_on <= today + 30 and joined_on <= today
    ),
    'beneficiaryStatusCounts', jsonb_build_object(
      'active', (select count(*) from public.beneficiaries where status = 'active' and promoted_to_affiliate_id is null),
      'inactive', (select count(*) from public.beneficiaries where status = 'inactive' and promoted_to_affiliate_id is null),
      'suspended', (select count(*) from public.beneficiaries where status = 'suspended' and promoted_to_affiliate_id is null),
      'deceased', (select count(*) from public.beneficiaries where status = 'deceased' and promoted_to_affiliate_id is null)
    ),
    'monthlyPayments', coalesce((
      select jsonb_agg(jsonb_build_object('period', to_char(period_start, 'YYYY-MM'), 'amount', total) order by period_start asc)
      from (
        select period_start, sum(amount) as total
        from public.payments
        where status = 'paid'
        group by period_start
        order by period_start desc
        limit 7
      ) recent_months
    ), '[]'::jsonb),
    'totalCollected', (
      select coalesce(sum(total), 0)
      from (
        select sum(amount) as total
        from public.payments
        where status = 'paid'
        group by period_start
        order by period_start desc
        limit 7
      ) recent_months_sum
    ),
    'sourceDistribution', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'count', c))
      from (
        select source, count(*) as c
        from public.affiliates
        where status = 'active'
        group by source
      ) sd
    ), '[]'::jsonb),
    'recentPayments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'affiliateId', p.affiliate_id,
        'affiliateName', a.first_names || ' ' || a.last_names,
        'period', to_char(p.period_start, 'YYYY-MM'),
        'amount', p.amount,
        'paidOn', p.paid_on
      ))
      from (
        select affiliate_id, period_start, amount, paid_on
        from public.payments
        where status = 'paid' and paid_on is not null
        order by paid_on desc
        limit 4
      ) p
      join public.affiliates a on a.id = p.affiliate_id
    ), '[]'::jsonb),
    'moraAlerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'affiliateId', a.id,
        'affiliateName', a.first_names || ' ' || a.last_names,
        'status', a.status,
        'lastPaymentOn', a.last_payment_on
      ))
      from (
        select id, first_names, last_names, status, last_payment_on
        from public.affiliates
        where status in ('inactive', 'suspended')
        order by last_payment_on desc nulls last
        limit 4
      ) a
    ), '[]'::jsonb)
  ) into result;

  select total into v_last_amount from (
    select sum(amount) as total from public.payments where status = 'paid'
    group by period_start order by period_start desc limit 1 offset 0
  ) x;

  select total into v_prev_amount from (
    select sum(amount) as total from public.payments where status = 'paid'
    group by period_start order by period_start desc limit 1 offset 1
  ) x;

  v_change := case
    when v_prev_amount is not null and v_prev_amount > 0
      then round(((v_last_amount - v_prev_amount) / v_prev_amount) * 1000) / 10.0
    else null
  end;

  result := result || jsonb_build_object('collectedChangePercent', v_change);

  return result;
end;
$$;
