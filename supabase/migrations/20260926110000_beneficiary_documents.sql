-- Beneficiaries keep their own documents (member_documents.beneficiary_id already exists).
-- The Documentos directory lists titular and beneficiary files together, so it needs the
-- family titular of each file and one searchable text across both people.

create view public.member_document_directory
with (security_invoker = true) as
select
  d.id,
  d.kind,
  d.title,
  d.uploaded_at,
  d.size_bytes,
  d.storage_path,
  d.mime_type,
  a.id as affiliate_id,
  a.first_names as affiliate_first_names,
  a.last_names as affiliate_last_names,
  a.document_type as affiliate_document_type,
  a.document_number as affiliate_document_number,
  d.beneficiary_id,
  b.first_names as beneficiary_first_names,
  b.last_names as beneficiary_last_names,
  b.relationship as beneficiary_relationship,
  concat_ws(' ', a.first_names, a.last_names, a.document_number,
    b.first_names, b.last_names, b.document_number, d.title) as search_text
from public.member_documents d
left join public.beneficiaries b on b.id = d.beneficiary_id
-- A beneficiary's file belongs to whoever is its titular now (it follows a succession).
join public.affiliates a on a.id = coalesce(d.affiliate_id, b.affiliate_id);

revoke all on public.member_document_directory from anon, authenticated;
grant select on public.member_document_directory to authenticated;
