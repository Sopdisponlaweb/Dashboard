-- Payment import application (previously preview-only) and mora (delinquency) automation.
-- 1. Keeps affiliates.last_payment_on in sync whenever a paid payment is written.
-- 2. Exposes public.apply_payment_import() so the Importaciones UI can commit a previewed batch atomically.
-- 3. Exposes public.run_membership_status_refresh() for an on-demand mora sweep from the UI.
-- 4. Schedules the same sweep nightly via pg_cron so status also moves for affiliates with no new payment event.

create or replace function private.sync_affiliate_last_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' then
    update public.affiliates
    set last_payment_on = greatest(coalesce(last_payment_on, new.period_start), new.period_start)
    where id = new.affiliate_id
      and (last_payment_on is null or last_payment_on < new.period_start);
  end if;
  return new;
end;
$$;

create trigger payments_sync_last_payment
after insert or update on public.payments
for each row execute function private.sync_affiliate_last_payment();

create or replace function public.run_membership_status_refresh()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not private.has_permission('payments.manage') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select private.refresh_membership_statuses(current_date) into v_updated;
  return v_updated;
end;
$$;

grant execute on function public.run_membership_status_refresh() to authenticated;

create or replace function public.apply_payment_import(
  p_source public.affiliation_source,
  p_period_start date,
  p_period_end date,
  p_original_filename text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_user uuid := (select auth.uid());
  v_submitted integer;
  v_inserted integer := 0;
  v_total numeric(14, 2) := 0;
begin
  if not private.has_permission('payments.manage') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select jsonb_array_length(p_rows) into v_submitted;
  if v_submitted is null or v_submitted = 0 then
    raise exception 'El lote no contiene filas para aplicar.' using errcode = '22023';
  end if;

  insert into public.payment_batches (
    source, period_start, period_end, original_filename, row_count, total_amount, status, imported_by, imported_at
  )
  values (p_source, p_period_start, p_period_end, p_original_filename, 0, 0, 'imported', v_user, now())
  returning id into v_batch_id;

  with incoming as (
    select
      (item ->> 'affiliateId')::uuid as affiliate_id,
      (item ->> 'amount')::numeric(14, 2) as amount,
      nullif(item ->> 'observation', '') as observation
    from jsonb_array_elements(p_rows) as item
  ),
  inserted as (
    insert into public.payments (
      affiliate_id, batch_id, source, period_start, amount, paid_on, status, observations, created_by
    )
    select affiliate_id, v_batch_id, p_source, p_period_start, amount, p_period_start, 'paid', observation, v_user
    from incoming
    on conflict (affiliate_id, source, period_start) do nothing
    returning amount
  )
  select count(*), coalesce(sum(amount), 0) into v_inserted, v_total from inserted;

  update public.payment_batches
  set row_count = v_inserted, total_amount = v_total
  where id = v_batch_id;

  perform private.refresh_membership_statuses(current_date);

  return jsonb_build_object(
    'batchId', v_batch_id,
    'submitted', v_submitted,
    'inserted', v_inserted,
    'skippedAsDuplicate', v_submitted - v_inserted,
    'totalAmount', v_total
  );
end;
$$;

grant execute on function public.apply_payment_import(public.affiliation_source, date, date, text, jsonb) to authenticated;

create extension if not exists pg_cron;

select
  cron.schedule(
    'refresh-membership-statuses-nightly',
    '15 6 * * *',
    $$select private.refresh_membership_statuses(current_date);$$
  )
where not exists (
  select 1 from cron.job where jobname = 'refresh-membership-statuses-nightly'
);
