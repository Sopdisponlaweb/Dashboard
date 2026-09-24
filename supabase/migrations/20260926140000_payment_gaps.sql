-- Continuidad de pagos: months without a paid payment between two paid months of the same
-- titular (paid April, next paid June: May is missing). Either the month was typed wrong or
-- it is still pending. Trailing arrears (no payments after the last one) are not a gap: the
-- membership status already tracks them.

-- One row per gap. Filters on affiliate_id are pushed below the window, so the ficha query is cheap.
create view public.payment_gaps
with (security_invoker = true) as
with paid_months as (
  select distinct affiliate_id, period_start
  from public.payments
  where status = 'paid'
),
sequenced as (
  select
    affiliate_id,
    period_start as paid_before,
    lead(period_start) over (partition by affiliate_id order by period_start) as paid_after
  from paid_months
)
select
  affiliate_id,
  paid_before,
  paid_after,
  (paid_before + interval '1 month')::date as first_missing,
  (paid_after - interval '1 month')::date as last_missing,
  ((extract(year from paid_after) - extract(year from paid_before)) * 12
    + extract(month from paid_after) - extract(month from paid_before))::int - 1 as missing_count
from sequenced
where paid_after > (paid_before + interval '1 month')::date;

revoke all on public.payment_gaps from anon, authenticated;
grant select on public.payment_gaps to authenticated;

-- Missing months of each gap inside a window [p_since, current month], one row per month.
create or replace function private.payment_gap_months(p_since date)
returns table (affiliate_id uuid, gap_start date, missing_month date, gap_size int)
language sql
stable
set search_path = ''
as $$
  select g.affiliate_id, g.first_missing, m::date, g.missing_count
  from public.payment_gaps g
  cross join lateral generate_series(
    greatest(g.first_missing, coalesce(p_since, g.first_missing)),
    least(g.last_missing, date_trunc('month', (now() at time zone 'America/Bogota'))::date),
    interval '1 month'
  ) as m
$$;

-- Directory: one row per titular with gaps in the window, newest gap first.
create or replace function public.list_payment_gap_affiliates(
  p_since date default null,
  p_query text default null,
  p_kind text default 'all',
  p_status public.membership_status default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  affiliate_id uuid,
  first_names text,
  last_names text,
  document_type text,
  document_number text,
  status public.membership_status,
  source public.affiliation_source,
  gap_count int,
  missing_months int,
  latest_missing date,
  missing_list date[],
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (select private.has_permission('payments.read')) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  with months as (
    select m.affiliate_id, m.gap_start, m.missing_month, m.gap_size
    from private.payment_gap_months(p_since) m
    -- single: gaps of one month (typical typo) · multi: longer gaps.
    where p_kind = 'all'
       or (p_kind = 'single' and m.gap_size = 1)
       or (p_kind = 'multi' and m.gap_size > 1)
  ),
  per_affiliate as (
    select
      m.affiliate_id,
      count(distinct m.gap_start)::int as gap_count,
      count(*)::int as missing_months,
      max(m.missing_month) as latest_missing,
      (array_agg(m.missing_month order by m.missing_month desc))[1:12] as missing_list
    from months m
    group by m.affiliate_id
  )
  select
    a.id, a.first_names, a.last_names, a.document_type, a.document_number, a.status, a.source,
    p.gap_count, p.missing_months, p.latest_missing, p.missing_list,
    count(*) over () as total_count
  from per_affiliate p
  join public.affiliates a on a.id = p.affiliate_id
  where (p_status is null or a.status = p_status)
    and (nullif(trim(p_query), '') is null
      or concat_ws(' ', a.first_names, a.last_names, a.document_number) ilike '%' || trim(p_query) || '%')
  order by p.latest_missing desc, a.last_names, a.first_names
  limit p_limit offset p_offset;
end;
$$;

-- Dashboard figures for a window, plus the all-time count of titulars with gaps.
create or replace function public.get_payment_gap_summary(p_since date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (select private.has_permission('payments.read')) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  -- The gaps CTE is used twice, so Postgres computes it once.
  with gaps as (
    select * from public.payment_gaps
  ),
  months as (
    select g.affiliate_id, g.first_missing as gap_start, m::date as missing_month, g.missing_count as gap_size
    from gaps g
    cross join lateral generate_series(
      greatest(g.first_missing, coalesce(p_since, g.first_missing)),
      least(g.last_missing, date_trunc('month', (now() at time zone 'America/Bogota'))::date),
      interval '1 month'
    ) as m
  )
  select jsonb_build_object(
    'affiliates', count(distinct m.affiliate_id),
    'gaps', count(distinct (m.affiliate_id, m.gap_start)),
    'missingMonths', count(*),
    'singleMonthGaps', count(distinct (m.affiliate_id, m.gap_start)) filter (where m.gap_size = 1),
    'activeAffiliates', count(distinct m.affiliate_id) filter (where a.status = 'active'),
    'allTimeAffiliates', (select count(distinct affiliate_id) from gaps)
  )
  into v_result
  from months m
  join public.affiliates a on a.id = m.affiliate_id;

  return v_result;
end;
$$;

revoke all on function private.payment_gap_months(date) from public, anon;
grant execute on function private.payment_gap_months(date) to authenticated;
revoke all on function public.list_payment_gap_affiliates(date, text, text, public.membership_status, int, int) from public, anon;
grant execute on function public.list_payment_gap_affiliates(date, text, text, public.membership_status, int, int) to authenticated;
revoke all on function public.get_payment_gap_summary(date) from public, anon;
grant execute on function public.get_payment_gap_summary(date) to authenticated;

-- "octubre de 2026": month names in Spanish regardless of the server's lc_time.
create or replace function private.spanish_month_label(p_month date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from p_month)::int]
    || ' de ' || extract(year from p_month)::int
$$;

-- Alert when newly registered payments leave months without payment right before them.
-- Statement level, so a range receipt or a whole import produces one notification.
create or replace function private.notify_payment_gaps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gaps int;
  v_affiliate uuid;
  v_name text;
  v_period date;
  v_prev date;
  v_batch uuid;
  v_actor uuid := (select auth.uid());
begin
  create temp table if not exists pg_notify_new_gaps (affiliate_id uuid, period_start date, prev_paid date) on commit drop;
  truncate pg_notify_new_gaps;

  insert into pg_notify_new_gaps
  select n.affiliate_id, n.period_start, prev.period_start
  from (select distinct affiliate_id, period_start from new_rows where status = 'paid') n
  cross join lateral (
    select p.period_start
    from public.payments p
    where p.affiliate_id = n.affiliate_id and p.status = 'paid' and p.period_start < n.period_start
    order by p.period_start desc
    limit 1
  ) prev
  where prev.period_start < (n.period_start - interval '1 month')::date;

  select count(*) into v_gaps from pg_notify_new_gaps;
  if v_gaps = 0 then
    return null;
  end if;

  select batch_id into v_batch from new_rows where batch_id is not null limit 1;

  if v_gaps = 1 then
    select g.affiliate_id, g.period_start, g.prev_paid, concat_ws(' ', a.first_names, a.last_names)
    into v_affiliate, v_period, v_prev, v_name
    from pg_notify_new_gaps g join public.affiliates a on a.id = g.affiliate_id;

    insert into public.notifications (recipient_id, level, event_key, title, message, entity_type, entity_id)
    values (
      v_actor, 'warning', 'payment_gap',
      'Pago sin continuidad',
      format('Se registró el pago de %s de %s, pero el último pago anterior es de %s: %s sin pago registrado. Revisa si el mes se digitó mal o si está pendiente.',
        private.spanish_month_label(v_period), v_name, private.spanish_month_label(v_prev),
        case when (v_period - interval '1 month')::date = (v_prev + interval '1 month')::date
          then 'queda 1 mes'
          else format('quedan %s meses', ((extract(year from v_period) - extract(year from v_prev)) * 12
            + extract(month from v_period) - extract(month from v_prev))::int - 1) end),
      'affiliate', v_affiliate
    );
  else
    insert into public.notifications (recipient_id, level, event_key, title, message, entity_type, entity_id)
    values (
      v_actor, 'warning', 'payment_gap',
      'Pagos sin continuidad en la carga',
      format('Los pagos registrados dejaron a %s titulares con meses sin pago antes del mes cargado. Revisa si se digitaron mal o si están pendientes.', v_gaps),
      case when v_batch is not null then 'payment_batch' else 'payment_gaps' end,
      v_batch
    );
  end if;

  return null;
end;
$$;

create trigger payments_notify_gaps
after insert on public.payments
referencing new table as new_rows
for each statement execute function private.notify_payment_gaps();
