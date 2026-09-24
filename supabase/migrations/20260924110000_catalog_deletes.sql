-- Catalog entries can be deleted by settings.manage. Every foreign key into these
-- tables is ON DELETE RESTRICT, so an entry still used by an affiliate, beneficiary
-- or payment cannot be deleted (23503); the app offers to inactivate it instead.

create policy municipalities_delete on public.municipalities for delete to authenticated
using ((select private.has_permission('settings.manage')));
create policy organizations_delete on public.organizations for delete to authenticated
using ((select private.has_permission('settings.manage')));
create policy police_ranks_delete on public.police_ranks for delete to authenticated
using ((select private.has_permission('settings.manage')));
create policy payment_methods_delete on public.payment_methods for delete to authenticated
using ((select private.has_permission('settings.manage')));

-- Table privileges follow the base schema's explicit-grant convention; RLS above
-- limits deletes to settings.manage.
grant delete on public.municipalities, public.organizations, public.payment_methods to authenticated;
revoke all on table public.police_ranks from anon, authenticated;
grant select, insert, update, delete on public.police_ranks to authenticated;

-- Catalog edits and deletions show up in Auditoría like other records.
create trigger municipalities_audit after insert or update or delete on public.municipalities
for each row execute function private.record_audit_event();
create trigger organizations_audit after insert or update or delete on public.organizations
for each row execute function private.record_audit_event();
create trigger police_ranks_audit after insert or update or delete on public.police_ranks
for each row execute function private.record_audit_event();
