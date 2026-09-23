-- Observations are meant to work like an audit trail: once written, they stay on
-- record. Removes the ability to delete a note, at the database level (not just the
-- UI), so the guarantee holds even against direct API calls.

drop policy member_notes_delete on public.member_notes;
revoke delete on public.member_notes from authenticated;
