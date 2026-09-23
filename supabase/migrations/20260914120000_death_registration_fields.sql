-- Adds the successor/death-registration fields the legacy system's UI captured for a
-- deceased titular (resolution number, successor identity/contact, death registry
-- details, and the payout bank account) but that never had a place in this schema.
--
-- Also relaxes the deceased-state check constraints: a person can be known to be
-- deceased without an exact date on record. This matters because the legacy
-- `beneficiaries` source table never stored a real death date at all (only a status
-- flag) — the migration substituted a fallback date (1970-01-01) so it could satisfy
-- the old NOT NULL-when-deceased constraint. That fabricated date is corrected below
-- for the ~95% of deceased beneficiaries affected, instead of leaving a false-precise
-- value on record.

alter table public.affiliates
  add column if not exists successor_resolution_number text,
  add column if not exists successor_document_number text,
  add column if not exists successor_first_names text,
  add column if not exists successor_last_names text,
  add column if not exists successor_phone text,
  add column if not exists death_municipality_id uuid references public.municipalities (id) on delete restrict,
  add column if not exists death_registry_number text,
  add column if not exists death_notary text,
  add column if not exists death_service_provided text,
  add column if not exists successor_bank text,
  add column if not exists successor_account_number text,
  add column if not exists successor_account_type text
    check (successor_account_type is null or successor_account_type in ('ahorros', 'corriente'));

create index if not exists affiliates_death_municipality_idx on public.affiliates (death_municipality_id);

alter table public.beneficiaries drop constraint beneficiaries_deceased_state;
alter table public.beneficiaries add constraint beneficiaries_deceased_state
  check (status = 'deceased' or deceased_at is null);

alter table public.affiliates drop constraint affiliates_deceased_state;
alter table public.affiliates add constraint affiliates_deceased_state
  check (status = 'deceased' or deceased_at is null);

update public.beneficiaries
set deceased_at = null
where status = 'deceased' and deceased_at = '1970-01-01T17:00:00+00'::timestamptz;
