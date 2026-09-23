create type public.credit_status as enum ('active', 'paid', 'refinanced', 'cancelled');

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete restrict,
  previous_credit_id uuid references public.credits (id) on delete set null,
  disbursed_amount numeric(14, 2) not null check (disbursed_amount >= 0),
  rolled_over_capital numeric(14, 2) not null default 0 check (rolled_over_capital >= 0),
  rolled_over_interest numeric(14, 2) not null default 0 check (rolled_over_interest >= 0),
  principal_base numeric(14, 2) not null check (principal_base >= 0),
  interest_rate numeric(6, 4) not null check (interest_rate > 0),
  term_months integer not null check (term_months > 0),
  interest_amount numeric(14, 2) not null check (interest_amount >= 0),
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  installment_amount numeric(14, 2) not null check (installment_amount > 0),
  status public.credit_status not null default 'active',
  requested_on date not null default current_date,
  observations text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credits_base_matches check (principal_base = disbursed_amount + rolled_over_capital + rolled_over_interest),
  constraint credits_total_matches check (total_amount = principal_base + interest_amount)
);

create unique index credits_one_active_per_affiliate on public.credits (affiliate_id) where status = 'active';
create index credits_affiliate_idx on public.credits (affiliate_id, requested_on desc);
create index credits_previous_idx on public.credits (previous_credit_id);

create table public.credit_installments (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.credits (id) on delete restrict,
  paid_on date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  capital_portion numeric(14, 2) not null check (capital_portion >= 0),
  interest_portion numeric(14, 2) not null check (interest_portion >= 0),
  observation text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_installments_credit_idx on public.credit_installments (credit_id, paid_on desc);

create trigger credits_set_updated_at before update on public.credits
for each row execute function private.set_updated_at();

create trigger credits_audit after insert or update or delete on public.credits
for each row execute function private.record_audit_event();
create trigger credit_installments_audit after insert or update or delete on public.credit_installments
for each row execute function private.record_audit_event();

alter table public.credits enable row level security;
alter table public.credit_installments enable row level security;

create policy credits_read on public.credits for select to authenticated
using ((select private.has_permission('credits.read')));
create policy credits_insert on public.credits for insert to authenticated
with check ((select private.has_permission('credits.manage')));
create policy credits_update on public.credits for update to authenticated
using ((select private.has_permission('credits.manage')))
with check ((select private.has_permission('credits.manage')));

create policy credit_installments_read on public.credit_installments for select to authenticated
using ((select private.has_permission('credits.read')));
create policy credit_installments_insert on public.credit_installments for insert to authenticated
with check ((select private.has_permission('credits.manage')));

-- Recalculates paid capital/interest on every new installment and closes the credit once it's fully covered.
create or replace function private.sync_credit_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit record;
  v_paid_capital numeric(14, 2);
  v_paid_interest numeric(14, 2);
begin
  select * into v_credit from public.credits where id = new.credit_id;

  select coalesce(sum(capital_portion), 0), coalesce(sum(interest_portion), 0)
  into v_paid_capital, v_paid_interest
  from public.credit_installments
  where credit_id = new.credit_id;

  if v_credit.status = 'active' and (v_paid_capital + v_paid_interest) >= v_credit.total_amount then
    update public.credits set status = 'paid' where id = new.credit_id;
  end if;

  return new;
end;
$$;

create trigger credit_installments_sync_status after insert on public.credit_installments
for each row execute function private.sync_credit_status();

-- Requests a credit for an affiliate. If an active credit already exists, its real pending balance
-- (computed here, never trusted from the client) is rolled into the new credit's base and the old
-- credit is closed as 'refinanced' — all inside one transaction.
create or replace function public.request_credit(
  p_affiliate_id uuid,
  p_disbursed_amount numeric,
  p_interest_rate numeric,
  p_term_months integer,
  p_observations text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active record;
  v_rolled_capital numeric(14, 2) := 0;
  v_rolled_interest numeric(14, 2) := 0;
  v_paid_capital numeric(14, 2);
  v_paid_interest numeric(14, 2);
  v_base numeric(14, 2);
  v_interest numeric(14, 2);
  v_total numeric(14, 2);
  v_installment numeric(14, 2);
  v_new_id uuid;
begin
  if not private.has_permission('credits.manage') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if p_disbursed_amount is null or p_disbursed_amount < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_interest_rate is null or p_interest_rate <= 0 or p_term_months is null or p_term_months <= 0 then
    raise exception 'invalid_terms' using errcode = '22023';
  end if;

  select * into v_active from public.credits
  where affiliate_id = p_affiliate_id and status = 'active'
  for update;

  if found then
    select coalesce(sum(capital_portion), 0), coalesce(sum(interest_portion), 0)
    into v_paid_capital, v_paid_interest
    from public.credit_installments
    where credit_id = v_active.id;

    v_rolled_capital := greatest(v_active.principal_base - v_paid_capital, 0);
    v_rolled_interest := greatest(v_active.interest_amount - v_paid_interest, 0);

    update public.credits set status = 'refinanced' where id = v_active.id;
  end if;

  v_base := p_disbursed_amount + v_rolled_capital + v_rolled_interest;
  v_interest := round(v_base * p_interest_rate, 2);
  v_total := v_base + v_interest;
  v_installment := round(v_total / p_term_months, 2);

  insert into public.credits (
    affiliate_id, previous_credit_id, disbursed_amount, rolled_over_capital, rolled_over_interest,
    principal_base, interest_rate, term_months, interest_amount, total_amount, installment_amount,
    observations, created_by
  ) values (
    p_affiliate_id, v_active.id, p_disbursed_amount, v_rolled_capital, v_rolled_interest,
    v_base, p_interest_rate, p_term_months, v_interest, v_total, v_installment,
    nullif(p_observations, ''), (select auth.uid())
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.request_credit(uuid, numeric, numeric, integer, text) to authenticated;

insert into public.permissions (key, name, description)
values
  ('credits.read', 'Consultar créditos', 'Consulta de créditos y su historial de abonos.'),
  ('credits.manage', 'Gestionar créditos', 'Solicitud de créditos, refinanciación y registro de abonos.')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key = any (array['credits.read', 'credits.manage'])
where roles.key in ('administrator', 'operator')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key = 'credits.read'
where roles.key = 'viewer'
on conflict do nothing;
