-- Credits, credit installments, member notes and MCP write proposals were created with
-- Supabase's default grants: every privilege, including TRUNCATE (which skips RLS), for
-- anon and authenticated. Align them with the rest of the schema: nothing for anon and,
-- for authenticated, only the statements that have an RLS policy and that the app uses.

revoke all on public.credits from anon, authenticated;
revoke all on public.credit_installments from anon, authenticated;
revoke all on public.member_notes from anon, authenticated;
revoke all on public.mcp_write_proposals from anon, authenticated;

-- register_credit_installment (security invoker) locks the credit with SELECT ... FOR UPDATE,
-- which needs UPDATE; credits_update restricts it to credits.manage.
grant select, insert, update on public.credits to authenticated;
-- Abonos are append-only: no update or delete policy exists.
grant select, insert on public.credit_installments to authenticated;
-- Notes are append-only too.
grant select, insert on public.member_notes to authenticated;
-- Proposals are created, listed and then approved or rejected (update).
grant select, insert, update on public.mcp_write_proposals to authenticated;
