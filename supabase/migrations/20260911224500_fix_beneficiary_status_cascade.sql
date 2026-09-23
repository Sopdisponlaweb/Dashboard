-- private.refresh_membership_statuses() cascaded the affiliate's status onto beneficiaries
-- verbatim, including 'deceased'. That wrongly marks a living beneficiary (e.g. the spouse
-- of a deceased titular) as deceased themselves, and violates beneficiaries_deceased_state
-- because it never sets deceased_at. A beneficiary's own death is a separate, per-person
-- event recorded through their own record, not something mora refresh should infer.
-- Mora status (active/inactive/suspended) still cascades from the titular; 'deceased' does not.

create or replace function private.refresh_membership_statuses(as_of_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affiliate_rows integer := 0;
  beneficiary_rows integer := 0;
begin
  update public.affiliates
  set status = case
      when coalesce(last_payment_on, joined_on) + interval '6 months' <= as_of_date then 'suspended'::public.membership_status
      when coalesce(last_payment_on, joined_on) + interval '3 months' <= as_of_date then 'inactive'::public.membership_status
      else 'active'::public.membership_status
    end,
    updated_at = now()
  where status <> 'deceased'
    and status is distinct from case
      when coalesce(last_payment_on, joined_on) + interval '6 months' <= as_of_date then 'suspended'::public.membership_status
      when coalesce(last_payment_on, joined_on) + interval '3 months' <= as_of_date then 'inactive'::public.membership_status
      else 'active'::public.membership_status
    end;

  get diagnostics affiliate_rows = row_count;

  update public.beneficiaries
  set status = affiliates.status,
      updated_at = now()
  from public.affiliates
  where beneficiaries.affiliate_id = affiliates.id
    and beneficiaries.status <> 'deceased'
    and affiliates.status <> 'deceased'
    and beneficiaries.status is distinct from affiliates.status;

  get diagnostics beneficiary_rows = row_count;
  return affiliate_rows + beneficiary_rows;
end;
$$;
