-- Extends the same death-registration capability built for affiliates to beneficiaries
-- (their own death details + payout account), and adds the service amount field to
-- both tables (paired with the existing "servicio prestado" text field).

alter table public.beneficiaries
  add column if not exists death_municipality_id uuid references public.municipalities (id) on delete restrict,
  add column if not exists death_registry_number text,
  add column if not exists death_notary text,
  add column if not exists death_service_provided text,
  add column if not exists death_service_amount numeric(12, 2) check (death_service_amount is null or death_service_amount >= 0),
  add column if not exists successor_bank text,
  add column if not exists successor_account_number text,
  add column if not exists successor_account_type text
    check (successor_account_type is null or successor_account_type in ('ahorros', 'corriente'));

create index if not exists beneficiaries_death_municipality_idx on public.beneficiaries (death_municipality_id);

alter table public.affiliates
  add column if not exists death_service_amount numeric(12, 2) check (death_service_amount is null or death_service_amount >= 0);
