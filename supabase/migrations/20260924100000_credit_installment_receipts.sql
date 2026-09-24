-- Manual credit payments (abonos) get the same treatment as regular payments:
-- payment method from the catalog, optional support file and a numbered receipt.

alter table public.credit_installments
  add column payment_method_id uuid references public.payment_methods (id) on delete restrict,
  add column support_document_id uuid references public.member_documents (id) on delete set null,
  add column receipt_number bigint generated always as identity,
  add constraint credit_installments_receipt_number_key unique (receipt_number);

-- The database clock runs in UTC: after 7 p.m. in Colombia current_date is already
-- tomorrow. Business dates use Colombia's calendar day.
alter table public.credits alter column requested_on set default (now() at time zone 'America/Bogota')::date;

-- Registers an abono in one transaction. The credit row is locked so two concurrent
-- abonos cannot overpay it, and the capital/interest split is computed here rather
-- than trusted from the client. Runs as the caller, so the credits.manage RLS
-- policies apply (FOR UPDATE needs the update policy).
create or replace function public.register_credit_installment(
  p_credit_id uuid,
  p_amount numeric,
  p_paid_on date,
  p_payment_method_id uuid,
  p_observation text,
  p_support_document_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_credit record;
  v_paid_capital numeric(14, 2);
  v_paid_interest numeric(14, 2);
  v_remaining_capital numeric(14, 2);
  v_remaining_interest numeric(14, 2);
  v_capital numeric(14, 2);
  v_interest numeric(14, 2);
  v_id uuid;
  v_today date := (now() at time zone 'America/Bogota')::date;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select * into v_credit from public.credits where id = p_credit_id for update;
  if not found then
    raise exception 'credit_not_found' using errcode = 'P0002';
  end if;
  if v_credit.status <> 'active' then
    raise exception 'credit_not_active' using errcode = '22023';
  end if;
  if p_paid_on is null or p_paid_on < v_credit.requested_on or p_paid_on > v_today then
    raise exception 'invalid_paid_on' using errcode = '22023';
  end if;

  select coalesce(sum(capital_portion), 0), coalesce(sum(interest_portion), 0)
  into v_paid_capital, v_paid_interest
  from public.credit_installments
  where credit_id = p_credit_id;

  v_remaining_capital := greatest(v_credit.principal_base - v_paid_capital, 0);
  v_remaining_interest := greatest(v_credit.interest_amount - v_paid_interest, 0);

  if p_amount > v_remaining_capital + v_remaining_interest then
    raise exception 'amount_exceeds_balance' using errcode = '22023',
      detail = (v_remaining_capital + v_remaining_interest)::text;
  end if;

  if p_amount = v_remaining_capital + v_remaining_interest then
    -- Final abono: settle exactly what is left so no rounding cents remain.
    v_capital := v_remaining_capital;
  else
    v_capital := least(round(p_amount * v_credit.principal_base / v_credit.total_amount, 2), v_remaining_capital);
  end if;
  v_interest := p_amount - v_capital;

  insert into public.credit_installments (
    credit_id, paid_on, amount, capital_portion, interest_portion, observation,
    payment_method_id, support_document_id, created_by
  ) values (
    p_credit_id, p_paid_on, p_amount, v_capital, v_interest, nullif(p_observation, ''),
    p_payment_method_id, p_support_document_id, (select auth.uid())
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.register_credit_installment(uuid, numeric, date, uuid, text, uuid) to authenticated;
