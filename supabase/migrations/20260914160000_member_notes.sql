-- Replaces the single free-text "internal_notes" field with a proper append-only log:
-- notes are created one at a time, each stamped with who wrote it and when, and can be
-- deleted individually. Applies to both affiliates and beneficiaries, mirroring the
-- existing member_documents pattern of "exactly one owner" (affiliate xor beneficiary).

create table public.member_notes (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references public.affiliates (id) on delete restrict,
  beneficiary_id uuid references public.beneficiaries (id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint member_notes_owner check (num_nonnulls(affiliate_id, beneficiary_id) = 1)
);

create index member_notes_affiliate_idx on public.member_notes (affiliate_id, created_at desc);
create index member_notes_beneficiary_idx on public.member_notes (beneficiary_id, created_at desc);

alter table public.member_notes enable row level security;

grant select, insert, delete on public.member_notes to authenticated;

create policy member_notes_read on public.member_notes for select to authenticated
using ((select private.has_permission('affiliates.read')));

create policy member_notes_insert on public.member_notes for insert to authenticated
with check (
  (select private.has_permission('affiliates.manage'))
  and created_by = (select auth.uid())
);

create policy member_notes_delete on public.member_notes for delete to authenticated
using ((select private.has_permission('affiliates.manage')));

-- Backfill: preserve every existing free-text note as the first historical entry.
-- created_by is left null (shown as "Sistema") since the original author was never
-- recorded; created_at approximates the timestamp with the parent record's own.
insert into public.member_notes (affiliate_id, body, created_by, created_at)
select id, internal_notes, null, created_at
from public.affiliates
where internal_notes is not null and btrim(internal_notes) <> '';

insert into public.member_notes (beneficiary_id, body, created_by, created_at)
select id, internal_notes, null, created_at
from public.beneficiaries
where internal_notes is not null and btrim(internal_notes) <> '';
