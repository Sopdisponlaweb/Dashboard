-- "Pagos de créditos": a directory of every abono, like the payments module.
-- The view joins each abono with its credit, titular and payment method, and exposes
-- one search text so the page can filter by name or cédula in a single condition.

create view public.credit_installment_directory
with (security_invoker = true) as
select
  i.id,
  i.credit_id,
  i.paid_on,
  to_char(i.paid_on, 'YYYY-MM') as paid_month,
  i.amount,
  i.capital_portion,
  i.interest_portion,
  i.observation,
  i.receipt_number,
  i.support_document_id,
  i.payment_method_id,
  m.name as payment_method_name,
  c.status as credit_status,
  c.principal_base as credit_principal_base,
  c.total_amount as credit_total_amount,
  c.requested_on as credit_requested_on,
  a.id as affiliate_id,
  a.first_names as affiliate_first_names,
  a.last_names as affiliate_last_names,
  a.document_type as affiliate_document_type,
  a.document_number as affiliate_document_number,
  concat_ws(' ', a.first_names, a.last_names, a.document_number) as search_text
from public.credit_installments i
join public.credits c on c.id = i.credit_id
join public.affiliates a on a.id = c.affiliate_id
left join public.payment_methods m on m.id = i.payment_method_id;

revoke all on public.credit_installment_directory from anon, authenticated;
grant select on public.credit_installment_directory to authenticated;

-- Totals for the current filters, plus every month that has abonos (for the month filter).
-- Security invoker over the view, so the same RLS applies as to the list.
create or replace function public.get_credit_installment_summary(
  p_query text default null,
  p_month text default null,
  p_payment_method_id uuid default null,
  p_credit_status public.credit_status default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (select private.has_permission('credits.read')) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'count', count(*),
    'amount', coalesce(sum(d.amount), 0),
    'capital', coalesce(sum(d.capital_portion), 0),
    'interest', coalesce(sum(d.interest_portion), 0)
  )
  into v_result
  from public.credit_installment_directory d
  where (nullif(trim(p_query), '') is null or d.search_text ilike '%' || trim(p_query) || '%')
    and (p_month is null or d.paid_month = p_month)
    and (p_payment_method_id is null or d.payment_method_id = p_payment_method_id)
    and (p_credit_status is null or d.credit_status = p_credit_status);

  return v_result || jsonb_build_object('months', coalesce((
    select jsonb_agg(month order by month desc)
    from (select distinct paid_month as month from public.credit_installment_directory) months
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.get_credit_installment_summary(text, text, uuid, public.credit_status) from public, anon;
grant execute on function public.get_credit_installment_summary(text, text, uuid, public.credit_status) to authenticated;
