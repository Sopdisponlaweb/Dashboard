-- Paz y salvo de crédito: a numbered certificate that a credit's obligation is settled,
-- either paid in full (status paid) or forgiven. One per credit: issuing again returns the
-- same certificate, so the number printed on paper always matches the record here.

create table public.credit_clearances (
  id uuid primary key default gen_random_uuid(),
  clearance_number bigint generated always as identity unique,
  credit_id uuid not null unique references public.credits(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  -- How the obligation ended, fixed at issue time.
  settlement text not null check (settlement in ('paid', 'forgiven')),
  -- Date of the last abono (paid) or of the issue (forgiven: no date is stored for it).
  settled_on date not null,
  total_amount numeric(14, 2) not null,
  total_paid numeric(14, 2) not null,
  issued_on date not null default (now() at time zone 'America/Bogota')::date,
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_clearances_affiliate_idx on public.credit_clearances (affiliate_id);

alter table public.credit_clearances enable row level security;

create policy credit_clearances_read on public.credit_clearances
for select to authenticated
using ((select private.has_permission('credits.read')));

revoke all on public.credit_clearances from anon, authenticated;
-- Issued only through issue_credit_clearance.
grant select on public.credit_clearances to authenticated;

create trigger credit_clearances_audit after insert or update or delete on public.credit_clearances
for each row execute function private.record_audit_event();

create or replace function public.issue_credit_clearance(p_credit_id uuid)
returns public.credit_clearances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit public.credits;
  v_existing public.credit_clearances;
  v_paid numeric(14, 2);
  v_last_paid_on date;
  v_result public.credit_clearances;
begin
  if not (select private.has_permission('credits.manage')) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select * into v_credit from public.credits where id = p_credit_id for update;
  if not found then
    raise exception 'credit_not_found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.credit_clearances where credit_id = p_credit_id;
  if found then
    return v_existing;
  end if;

  if v_credit.status not in ('paid', 'forgiven') then
    raise exception 'credit_not_settled' using errcode = 'P0001',
      detail = 'Only paid or forgiven credits can get a clearance certificate.';
  end if;

  select coalesce(sum(amount), 0), max(paid_on)
  into v_paid, v_last_paid_on
  from public.credit_installments
  where credit_id = p_credit_id;

  insert into public.credit_clearances (credit_id, affiliate_id, settlement, settled_on, total_amount, total_paid, issued_by)
  values (
    p_credit_id,
    v_credit.affiliate_id,
    v_credit.status::text,
    case when v_credit.status = 'paid' and v_last_paid_on is not null
      then v_last_paid_on
      else (now() at time zone 'America/Bogota')::date end,
    v_credit.total_amount,
    v_paid,
    (select auth.uid())
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.issue_credit_clearance(uuid) from public, anon;
grant execute on function public.issue_credit_clearance(uuid) to authenticated;
