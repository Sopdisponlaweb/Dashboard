-- Performance: real data volume (22k+ affiliates, ~950k payments) makes the
-- "fetch every affiliate with every nested payment" pattern unusable (40-60s+ page
-- loads). The dashboard now computes its aggregates in SQL instead of in JS.

create index if not exists payments_period_idx on public.payments (period_start);
create index if not exists payments_paid_on_idx on public.payments (paid_on) where status = 'paid';
create index if not exists affiliates_active_coverage_idx on public.affiliates (full_coverage_on) where status = 'active';

create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := current_date;
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
    'waitingCoverageCount', (
      select count(*) from public.affiliates
      where status = 'active' and full_coverage_on > today
    ),
    'upcomingCoverageCount', (
      select count(*) from public.affiliates
      where status = 'active' and full_coverage_on > today and full_coverage_on <= today + 30
    ),
    'beneficiaryStatusCounts', jsonb_build_object(
      'active', (select count(*) from public.beneficiaries where status = 'active'),
      'inactive', (select count(*) from public.beneficiaries where status = 'inactive'),
      'suspended', (select count(*) from public.beneficiaries where status = 'suspended'),
      'deceased', (select count(*) from public.beneficiaries where status = 'deceased')
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

revoke all on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;
