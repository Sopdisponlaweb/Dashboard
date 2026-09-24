-- Payment methods catalog, multi-month payment receipts and image supports.

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payment_methods_set_updated_at before update on public.payment_methods
for each row execute function private.set_updated_at();
create trigger payment_methods_audit after insert or update or delete on public.payment_methods
for each row execute function private.record_audit_event();

alter table public.payment_methods enable row level security;

create policy payment_methods_read on public.payment_methods for select to authenticated using (true);
create policy payment_methods_insert on public.payment_methods for insert to authenticated
with check ((select private.has_permission('settings.manage')));
create policy payment_methods_update on public.payment_methods for update to authenticated
using ((select private.has_permission('settings.manage')))
with check ((select private.has_permission('settings.manage')));

insert into public.payment_methods (name, sort_order) values
  ('Efectivo', 10),
  ('Transferencia bancaria', 20),
  ('Consignación bancaria', 30),
  ('Nequi', 40),
  ('Daviplata', 50),
  ('Tarjeta débito', 60),
  ('Tarjeta crédito', 70)
on conflict (name) do nothing;

-- One receipt per manual registration. It covers one or more consecutive months;
-- each month is still stored as its own row in payments so arrears, last payment
-- and reports keep working unchanged.
create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number bigint generated always as identity unique,
  affiliate_id uuid not null references public.affiliates (id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  source public.affiliation_source not null,
  period_from date not null,
  period_to date not null,
  months_count integer not null check (months_count between 1 and 36),
  monthly_amount numeric(14, 2) not null check (monthly_amount > 0),
  total_amount numeric(14, 2) not null,
  status public.payment_status not null,
  paid_on date,
  observations text,
  support_document_id uuid references public.member_documents (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payment_receipts_month_start check (
    period_from = date_trunc('month', period_from)::date and period_to = date_trunc('month', period_to)::date
  ),
  constraint payment_receipts_range check (period_to >= period_from),
  constraint payment_receipts_total check (total_amount = monthly_amount * months_count)
);

create index payment_receipts_affiliate_idx on public.payment_receipts (affiliate_id, created_at desc);

-- Same explicit-grant convention as the base schema: nothing for anon, only what the
-- app does for authenticated (RLS still decides which rows).
revoke all on table public.payment_methods, public.payment_receipts from anon, authenticated;
grant select, insert, update on public.payment_methods to authenticated;
grant select, insert on public.payment_receipts to authenticated;

create trigger payment_receipts_audit after insert or update or delete on public.payment_receipts
for each row execute function private.record_audit_event();

alter table public.payment_receipts enable row level security;

create policy payment_receipts_read on public.payment_receipts for select to authenticated
using ((select private.has_permission('payments.read')));
create policy payment_receipts_insert on public.payment_receipts for insert to authenticated
with check ((select private.has_permission('payments.manage')));

alter table public.payments
  add column payment_method_id uuid references public.payment_methods (id) on delete restrict,
  add column receipt_id uuid references public.payment_receipts (id) on delete restrict;

create index payments_receipt_idx on public.payments (receipt_id) where receipt_id is not null;

-- Creates the receipt and one payment per month in a single transaction. Runs as the
-- caller, so the payments.manage RLS policies apply; a month that is already paid for
-- that source raises unique_violation and nothing is written.
create or replace function public.create_payment_receipt(
  p_affiliate_id uuid,
  p_payment_method_id uuid,
  p_source public.affiliation_source,
  p_period_from date,
  p_months integer,
  p_monthly_amount numeric,
  p_status public.payment_status,
  p_paid_on date,
  p_observations text,
  p_support_document_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_period_from)::date;
  v_receipt_id uuid;
begin
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'invalid_months' using errcode = '22023';
  end if;
  if p_monthly_amount is null or p_monthly_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  insert into public.payment_receipts (
    affiliate_id, payment_method_id, source, period_from, period_to, months_count,
    monthly_amount, total_amount, status, paid_on, observations, support_document_id, created_by
  ) values (
    p_affiliate_id, p_payment_method_id, p_source, v_from,
    (v_from + make_interval(months => p_months - 1))::date, p_months,
    p_monthly_amount, p_monthly_amount * p_months, p_status, p_paid_on,
    nullif(p_observations, ''), p_support_document_id, (select auth.uid())
  ) returning id into v_receipt_id;

  insert into public.payments (
    affiliate_id, source, period_start, amount, status, paid_on, observations,
    support_document_id, payment_method_id, receipt_id, created_by
  )
  select
    p_affiliate_id, p_source, (v_from + make_interval(months => month_offset))::date,
    p_monthly_amount, p_status, p_paid_on, nullif(p_observations, ''),
    p_support_document_id, p_payment_method_id, v_receipt_id, (select auth.uid())
  from generate_series(0, p_months - 1) as month_offset;

  return v_receipt_id;
end;
$$;

grant execute on function public.create_payment_receipt(
  uuid, uuid, public.affiliation_source, date, integer, numeric, public.payment_status, date, text, uuid
) to authenticated;

-- Payment supports can now be photos or scans, not only PDF.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg']
where id = 'affiliate-files';

alter table public.member_documents drop constraint member_documents_pdf_only;
alter table public.member_documents add constraint member_documents_allowed_mime
  check (mime_type in ('application/pdf', 'image/png', 'image/jpeg'));
