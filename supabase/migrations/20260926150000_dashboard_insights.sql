-- Dashboard insights: collection trend, payment rate, arrears risk, credit portfolio,
-- data-quality flags and recent activity, in one call. The window is the last 12 closed
-- months plus the current one; future-dated payments (typos) never enter the trend.

create or replace function public.get_dashboard_insights()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_current date := date_trunc('month', v_today)::date;
  v_last_closed date := (date_trunc('month', v_today) - interval '1 month')::date;
  v_result jsonb;
begin
  if not (select private.has_permission('dashboard.read')) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  with months as (
    select generate_series(v_current - interval '12 months', v_current, interval '1 month')::date as period_start
  ),
  collected as (
    select p.period_start, sum(p.amount) as amount, count(*) as payments, count(distinct p.affiliate_id) as payers
    from public.payments p
    where p.status = 'paid' and p.period_start between v_current - interval '12 months' and v_current
    group by p.period_start
  )
  select jsonb_build_object(
    'today', v_today,
    'currentMonth', to_char(v_current, 'YYYY-MM'),
    'lastClosedMonth', to_char(v_last_closed, 'YYYY-MM'),
    'monthly', (
      select jsonb_agg(jsonb_build_object(
        'period', to_char(m.period_start, 'YYYY-MM'),
        'amount', coalesce(c.amount, 0),
        'payments', coalesce(c.payments, 0),
        'payers', coalesce(c.payers, 0)
      ) order by m.period_start)
      from months m left join collected c on c.period_start = m.period_start
    ),
    'activeCount', (select count(*) from public.affiliates where status = 'active'),
    -- Active titulars with a paid payment for the last closed month.
    'activePaidLastMonth', (
      select count(distinct p.affiliate_id)
      from public.payments p
      join public.affiliates a on a.id = p.affiliate_id and a.status = 'active'
      where p.status = 'paid' and p.period_start = v_last_closed
    ),
    -- Two months without paying: one more and the arrears rule suspends them.
    'atRiskCount', (
      select count(*) from public.affiliates
      where status = 'active' and last_payment_on is not null and last_payment_on <= (v_current - interval '2 months')::date
    ),
    'beneficiariesWaiting', (
      select count(*) from public.beneficiaries
      where status = 'active' and promoted_to_affiliate_id is null and full_coverage_on > v_today and joined_on <= v_today
    ),
    'invalidJoinDates', (select count(*) from public.affiliates where joined_on > v_today),
    'futurePayments', (select count(*) from public.payments where period_start > v_current),
    'credits', (
      select jsonb_build_object(
        'activeCount', count(*) filter (where c.status = 'active'),
        'outstanding', coalesce(sum(c.total_amount - coalesce(i.paid, 0)) filter (where c.status = 'active'), 0),
        'pausedCount', count(*) filter (where c.status = 'paused'),
        'pausedOutstanding', coalesce(sum(c.total_amount - coalesce(i.paid, 0)) filter (where c.status = 'paused'), 0),
        'collectedThisMonth', (
          select coalesce(sum(amount), 0) from public.credit_installments
          where paid_on >= v_current and paid_on < (v_current + interval '1 month')::date
        ),
        'clearancesPending', count(*) filter (
          where c.status in ('paid', 'forgiven')
            and not exists (select 1 from public.credit_clearances cc where cc.credit_id = c.id)
        )
      )
      from public.credits c
      left join (select credit_id, sum(amount) as paid from public.credit_installments group by credit_id) i on i.credit_id = c.id
    ),
    -- Business events only (inserts), newest first; bulk migration rows are not in these tables.
    'recentActivity', coalesce((
      select jsonb_agg(row_to_json(e) order by e.occurred_at desc)
      from (
        select
          ev.table_name as kind,
          ev.occurred_at,
          ev.affiliate_id,
          nullif(trim(concat_ws(' ', a.first_names, a.last_names)), '') as affiliate_name,
          pr.display_name as actor_name,
          ev.new_data ->> 'total_amount' as total_amount,
          ev.new_data ->> 'amount' as amount,
          ev.new_data ->> 'months_count' as months_count,
          ev.new_data ->> 'receipt_number' as receipt_number,
          ev.new_data ->> 'clearance_number' as clearance_number,
          ev.new_data ->> 'row_count' as row_count,
          ev.new_data ->> 'title' as title,
          ev.new_data ->> 'successor_name' as successor_name,
          concat_ws(' ', ev.new_data ->> 'first_names', ev.new_data ->> 'last_names') as person_name
        from public.audit_events ev
        left join public.affiliates a on a.id = ev.affiliate_id
        left join public.profiles pr on pr.id = ev.actor_id
        where ev.operation = 'INSERT'
          and ev.table_name in ('payment_receipts', 'credit_installments', 'credits', 'affiliates', 'beneficiaries',
                                'affiliate_successions', 'credit_clearances', 'payment_batches', 'member_documents')
        order by ev.occurred_at desc
        limit 8
      ) e
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_insights() from public, anon;
grant execute on function public.get_dashboard_insights() to authenticated;
