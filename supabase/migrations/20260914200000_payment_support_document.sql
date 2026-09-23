alter table public.payments
  add column support_document_id uuid references public.member_documents (id) on delete set null;
