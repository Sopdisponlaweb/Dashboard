-- Payment totals/periods aggregated in SQL instead of fetched row-by-row in JS
-- (the payments table has ~950k rows at real data scale).

create or replace function public.get_payment_totals()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_permission('payments.read')) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'paid', coalesce((select sum(amount) from public.payments where status = 'paid'), 0),
    'pending', coalesce((select sum(amount) from public.payments where status = 'pending'), 0),
    'reversed', coalesce((select sum(amount) from public.payments where status = 'reversed'), 0),
    'count', (select count(*) from public.payments)
  );
end;
$$;

revoke all on function public.get_payment_totals() from public, anon;
grant execute on function public.get_payment_totals() to authenticated;

create or replace function public.get_payment_periods()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_permission('payments.read')) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return coalesce((
    select array_agg(period_start::text order by period_start desc)
    from (select distinct period_start from public.payments) p
  ), array[]::text[]);
end;
$$;

revoke all on function public.get_payment_periods() from public, anon;
grant execute on function public.get_payment_periods() to authenticated;
