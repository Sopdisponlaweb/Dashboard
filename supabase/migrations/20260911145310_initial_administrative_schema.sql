-- Sopdisponal administrative platform: initial data and security model.
-- Every business table is private by default and protected with RLS.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create type public.membership_status as enum ('active', 'inactive', 'suspended', 'deceased');
create type public.affiliation_source as enum ('particular', 'activo', 'casur', 'tegen');
create type public.batch_status as enum ('draft', 'imported', 'reconciled', 'rejected');
create type public.payment_status as enum ('pending', 'paid', 'reversed');
create type public.document_kind as enum ('resume', 'identity', 'support', 'other');
create type public.notification_level as enum ('info', 'success', 'warning', 'critical');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 120),
  job_title text,
  avatar_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9._-]+$'),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9._-]+$'),
  name text not null,
  description text
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete set null,
  primary key (user_id, role_id)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  dane_code text unique,
  department text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (department, name)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  organization_type text not null check (
    organization_type in ('company', 'compensation_fund', 'payer', 'other')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  document_type text not null default 'CC',
  document_number text not null unique,
  document_issued_on date,
  first_names text not null,
  last_names text not null,
  birth_date date,
  phone text,
  email text,
  address text,
  municipality_id uuid references public.municipalities (id) on delete restrict,
  organization_id uuid references public.organizations (id) on delete restrict,
  source public.affiliation_source not null,
  status public.membership_status not null default 'active',
  joined_on date not null default current_date,
  full_coverage_on date generated always as ((joined_on + interval '6 months')::date) stored,
  last_payment_on date,
  deceased_at timestamptz,
  internal_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliates_deceased_state check (
    (status = 'deceased' and deceased_at is not null)
    or (status <> 'deceased' and deceased_at is null)
  )
);

create index affiliates_status_idx on public.affiliates (status);
create index affiliates_source_idx on public.affiliates (source);
create index affiliates_last_payment_idx on public.affiliates (last_payment_on);
create index affiliates_name_idx on public.affiliates (last_names, first_names);

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete restrict,
  relationship text not null,
  document_type text,
  document_number text,
  document_issued_on date,
  first_names text not null,
  last_names text not null,
  birth_date date,
  phone text,
  email text,
  status public.membership_status not null default 'active',
  joined_on date not null default current_date,
  full_coverage_on date generated always as ((joined_on + interval '6 months')::date) stored,
  deceased_at timestamptz,
  internal_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficiaries_document_unique unique (affiliate_id, document_number),
  constraint beneficiaries_deceased_state check (
    (status = 'deceased' and deceased_at is not null)
    or (status <> 'deceased' and deceased_at is null)
  )
);

create index beneficiaries_affiliate_idx on public.beneficiaries (affiliate_id);
create index beneficiaries_status_idx on public.beneficiaries (status);
create index beneficiaries_name_idx on public.beneficiaries (last_names, first_names);

create table public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  source public.affiliation_source not null,
  period_start date not null,
  period_end date not null,
  original_filename text,
  storage_path text,
  row_count integer not null default 0 check (row_count >= 0),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  status public.batch_status not null default 'draft',
  observations text,
  imported_by uuid references public.profiles (id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_batches_period check (period_end >= period_start)
);

create index payment_batches_period_idx on public.payment_batches (period_start desc, source);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete restrict,
  batch_id uuid references public.payment_batches (id) on delete restrict,
  source public.affiliation_source not null,
  period_start date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  paid_on date,
  status public.payment_status not null default 'paid',
  observations text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (affiliate_id, source, period_start)
);

create index payments_affiliate_period_idx on public.payments (affiliate_id, period_start desc);
create index payments_batch_idx on public.payments (batch_id);

create table public.member_documents (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references public.affiliates (id) on delete restrict,
  beneficiary_id uuid references public.beneficiaries (id) on delete restrict,
  kind public.document_kind not null,
  title text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  constraint member_documents_owner check (num_nonnulls(affiliate_id, beneficiary_id) = 1),
  constraint member_documents_pdf_only check (mime_type = 'application/pdf')
);

create index member_documents_affiliate_idx on public.member_documents (affiliate_id);
create index member_documents_beneficiary_idx on public.member_documents (beneficiary_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  media_path text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_window check (ends_at > starts_at)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id) on delete cascade,
  level public.notification_level not null default 'info',
  event_key text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, read_at, created_at desc);

create table public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  report_month date not null,
  title text not null,
  storage_path text,
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (report_month, title)
);

create table public.data_exports (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles (id) on delete restrict,
  export_type text not null,
  filters jsonb not null default '{}'::jsonb,
  storage_path text,
  expires_at timestamptz,
  downloaded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_events_lookup_idx
  on public.audit_events (table_name, record_id, occurred_at desc);

insert into public.roles (key, name, description)
values
  ('administrator', 'Administrador', 'Acceso administrativo completo.'),
  ('operator', 'Operador', 'Gestión cotidiana de afiliados, pagos y documentos.'),
  ('viewer', 'Consulta', 'Acceso de solo lectura a la operación.')
on conflict (key) do nothing;

insert into public.permissions (key, name, description)
values
  ('dashboard.read', 'Ver dashboard', 'Consulta de indicadores administrativos.'),
  ('affiliates.read', 'Consultar afiliados', 'Consulta de titulares y beneficiarios.'),
  ('affiliates.manage', 'Gestionar afiliados', 'Creación y actualización de titulares y beneficiarios.'),
  ('payments.read', 'Consultar pagos', 'Consulta de pagos e importaciones.'),
  ('payments.manage', 'Gestionar pagos', 'Importación y edición de pagos y observaciones.'),
  ('documents.read', 'Consultar documentos', 'Consulta de expedientes privados.'),
  ('documents.manage', 'Gestionar documentos', 'Carga y actualización de expedientes privados.'),
  ('announcements.manage', 'Gestionar avisos', 'Publicación de novedades de oficina.'),
  ('notifications.manage', 'Gestionar notificaciones', 'Creación de notificaciones internas.'),
  ('reports.read', 'Consultar informes', 'Consulta de informes mensuales.'),
  ('reports.manage', 'Gestionar informes', 'Generación de informes mensuales.'),
  ('data.export', 'Exportar datos', 'Descarga controlada de bases de datos.'),
  ('users.read', 'Consultar usuarios', 'Consulta de usuarios internos.'),
  ('users.manage', 'Gestionar usuarios', 'Administración de usuarios, roles y permisos.'),
  ('settings.manage', 'Gestionar catálogos', 'Administración de municipios y entidades.'),
  ('audit.read', 'Consultar auditoría', 'Consulta del historial de cambios.')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where roles.key = 'administrator'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key = any (array[
  'dashboard.read', 'affiliates.read', 'affiliates.manage',
  'payments.read', 'payments.manage', 'documents.read',
  'documents.manage', 'reports.read'
])
where roles.key = 'operator'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key = any (array[
  'dashboard.read', 'affiliates.read', 'payments.read',
  'documents.read', 'reports.read'
])
where roles.key = 'viewer'
on conflict do nothing;

create or replace function private.has_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    join public.role_permissions on role_permissions.role_id = user_roles.role_id
    join public.permissions on permissions.id = role_permissions.permission_id
    join public.profiles on profiles.id = user_roles.user_id
    where user_roles.user_id = (select auth.uid())
      and profiles.is_active
      and permissions.key = requested_permission
  );
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Usuario')
  );
  return new;
end;
$$;

create or replace function private.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_id, table_name, record_id, operation, old_data, new_data)
  values (
    (select auth.uid()),
    tg_table_name,
    case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id = (select auth.uid()) and not private.has_permission('users.manage') then
    new.is_active = old.is_active;
  end if;
  return new;
end;
$$;

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
    and beneficiaries.status is distinct from affiliates.status;

  get diagnostics beneficiary_rows = row_count;
  return affiliate_rows + beneficiary_rows;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger profiles_protect_security_fields before update on public.profiles
for each row execute function private.protect_profile_security_fields();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function private.set_updated_at();
create trigger affiliates_set_updated_at before update on public.affiliates
for each row execute function private.set_updated_at();
create trigger beneficiaries_set_updated_at before update on public.beneficiaries
for each row execute function private.set_updated_at();
create trigger payment_batches_set_updated_at before update on public.payment_batches
for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function private.set_updated_at();
create trigger announcements_set_updated_at before update on public.announcements
for each row execute function private.set_updated_at();

create trigger auth_user_created after insert on auth.users
for each row execute function private.create_profile_for_new_user();

create trigger affiliates_audit after insert or update or delete on public.affiliates
for each row execute function private.record_audit_event();
create trigger beneficiaries_audit after insert or update or delete on public.beneficiaries
for each row execute function private.record_audit_event();
create trigger payments_audit after insert or update or delete on public.payments
for each row execute function private.record_audit_event();
create trigger payment_batches_audit after insert or update or delete on public.payment_batches
for each row execute function private.record_audit_event();
create trigger announcements_audit after insert or update or delete on public.announcements
for each row execute function private.record_audit_event();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.municipalities enable row level security;
alter table public.organizations enable row level security;
alter table public.affiliates enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.payment_batches enable row level security;
alter table public.payments enable row level security;
alter table public.member_documents enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.data_exports enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.profiles, public.roles, public.permissions,
  public.user_roles, public.role_permissions, public.municipalities,
  public.organizations, public.affiliates, public.beneficiaries,
  public.payment_batches, public.payments, public.member_documents,
  public.announcements, public.notifications, public.monthly_reports,
  public.data_exports, public.audit_events
from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.roles, public.permissions to authenticated;
grant select, insert, update, delete on public.user_roles, public.role_permissions to authenticated;
grant select, insert, update on public.municipalities, public.organizations to authenticated;
grant select, insert, update on public.affiliates, public.beneficiaries to authenticated;
grant select, insert, update on public.payment_batches, public.payments to authenticated;
grant select, insert, update on public.member_documents to authenticated;
grant select, insert, update on public.announcements to authenticated;
grant select, insert on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update on public.monthly_reports to authenticated;
grant select, insert on public.data_exports to authenticated;
grant select on public.audit_events to authenticated;

grant usage on schema private to authenticated, service_role;
revoke all on function private.has_permission(text) from public, anon;
grant execute on function private.has_permission(text) to authenticated;
revoke all on function private.refresh_membership_statuses(date) from public, anon, authenticated;
grant execute on function private.refresh_membership_statuses(date) to service_role;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function private.record_audit_event() from public, anon, authenticated;
revoke all on function private.protect_profile_security_fields() from public, anon, authenticated;

create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.has_permission('users.read')));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.has_permission('users.manage')))
with check (id = (select auth.uid()) or (select private.has_permission('users.manage')));

create policy roles_read on public.roles for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy user_roles_select on public.user_roles for select to authenticated
using ((select private.has_permission('users.manage')));
create policy user_roles_insert on public.user_roles for insert to authenticated
with check ((select private.has_permission('users.manage')));
create policy user_roles_update on public.user_roles for update to authenticated
using ((select private.has_permission('users.manage')))
with check ((select private.has_permission('users.manage')));
create policy user_roles_delete on public.user_roles for delete to authenticated
using ((select private.has_permission('users.manage')));
create policy role_permissions_select on public.role_permissions for select to authenticated
using ((select private.has_permission('users.manage')));
create policy role_permissions_insert on public.role_permissions for insert to authenticated
with check ((select private.has_permission('users.manage')));
create policy role_permissions_update on public.role_permissions for update to authenticated
using ((select private.has_permission('users.manage')))
with check ((select private.has_permission('users.manage')));
create policy role_permissions_delete on public.role_permissions for delete to authenticated
using ((select private.has_permission('users.manage')));

create policy municipalities_read on public.municipalities for select to authenticated using (true);
create policy municipalities_insert on public.municipalities for insert to authenticated
with check ((select private.has_permission('settings.manage')));
create policy municipalities_update on public.municipalities for update to authenticated
using ((select private.has_permission('settings.manage')))
with check ((select private.has_permission('settings.manage')));
create policy organizations_read on public.organizations for select to authenticated using (true);
create policy organizations_insert on public.organizations for insert to authenticated
with check ((select private.has_permission('settings.manage')));
create policy organizations_update on public.organizations for update to authenticated
using ((select private.has_permission('settings.manage')))
with check ((select private.has_permission('settings.manage')));

create policy affiliates_read on public.affiliates for select to authenticated
using ((select private.has_permission('affiliates.read')));
create policy affiliates_insert on public.affiliates for insert to authenticated
with check ((select private.has_permission('affiliates.manage')));
create policy affiliates_update on public.affiliates for update to authenticated
using ((select private.has_permission('affiliates.manage')))
with check ((select private.has_permission('affiliates.manage')));

create policy beneficiaries_read on public.beneficiaries for select to authenticated
using ((select private.has_permission('affiliates.read')));
create policy beneficiaries_insert on public.beneficiaries for insert to authenticated
with check ((select private.has_permission('affiliates.manage')));
create policy beneficiaries_update on public.beneficiaries for update to authenticated
using ((select private.has_permission('affiliates.manage')))
with check ((select private.has_permission('affiliates.manage')));

create policy payment_batches_read on public.payment_batches for select to authenticated
using ((select private.has_permission('payments.read')));
create policy payment_batches_insert on public.payment_batches for insert to authenticated
with check ((select private.has_permission('payments.manage')));
create policy payment_batches_update on public.payment_batches for update to authenticated
using ((select private.has_permission('payments.manage')))
with check ((select private.has_permission('payments.manage')));
create policy payments_read on public.payments for select to authenticated
using ((select private.has_permission('payments.read')));
create policy payments_insert on public.payments for insert to authenticated
with check ((select private.has_permission('payments.manage')));
create policy payments_update on public.payments for update to authenticated
using ((select private.has_permission('payments.manage')))
with check ((select private.has_permission('payments.manage')));

create policy member_documents_read on public.member_documents for select to authenticated
using ((select private.has_permission('documents.read')));
create policy member_documents_insert on public.member_documents for insert to authenticated
with check ((select private.has_permission('documents.manage')));
create policy member_documents_update on public.member_documents for update to authenticated
using ((select private.has_permission('documents.manage')))
with check ((select private.has_permission('documents.manage')));

create policy announcements_read on public.announcements for select to authenticated using (true);
create policy announcements_insert on public.announcements for insert to authenticated
with check ((select private.has_permission('announcements.manage')));
create policy announcements_update on public.announcements for update to authenticated
using ((select private.has_permission('announcements.manage')))
with check ((select private.has_permission('announcements.manage')));

create policy notifications_read on public.notifications for select to authenticated
using (
  recipient_id is null
  or recipient_id = (select auth.uid())
  or (select private.has_permission('notifications.manage'))
);
create policy notifications_update_own on public.notifications for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));
create policy notifications_update_manager on public.notifications for update to authenticated
using ((select private.has_permission('notifications.manage')))
with check ((select private.has_permission('notifications.manage')));
create policy notifications_insert on public.notifications for insert to authenticated
with check ((select private.has_permission('notifications.manage')));

create policy monthly_reports_read on public.monthly_reports for select to authenticated
using ((select private.has_permission('reports.read')));
create policy monthly_reports_insert on public.monthly_reports for insert to authenticated
with check ((select private.has_permission('reports.manage')));
create policy monthly_reports_update on public.monthly_reports for update to authenticated
using ((select private.has_permission('reports.manage')))
with check ((select private.has_permission('reports.manage')));

create policy data_exports_own on public.data_exports for select to authenticated
using (requested_by = (select auth.uid()) and (select private.has_permission('data.export')));
create policy data_exports_create on public.data_exports for insert to authenticated
with check (requested_by = (select auth.uid()) and (select private.has_permission('data.export')));
create policy audit_events_read on public.audit_events for select to authenticated
using ((select private.has_permission('audit.read')));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('affiliate-files', 'affiliate-files', false, 15728640, array['application/pdf']),
  ('office-notices', 'office-notices', false, 15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy affiliate_files_read on storage.objects for select to authenticated
using (bucket_id = 'affiliate-files' and (select private.has_permission('documents.read')));
create policy affiliate_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'affiliate-files' and (select private.has_permission('documents.manage')));
create policy affiliate_files_update on storage.objects for update to authenticated
using (bucket_id = 'affiliate-files' and (select private.has_permission('documents.manage')))
with check (bucket_id = 'affiliate-files' and (select private.has_permission('documents.manage')));
create policy office_notices_read on storage.objects for select to authenticated
using (bucket_id = 'office-notices');
create policy office_notices_insert on storage.objects for insert to authenticated
with check (bucket_id = 'office-notices' and (select private.has_permission('announcements.manage')));
create policy office_notices_update on storage.objects for update to authenticated
using (bucket_id = 'office-notices' and (select private.has_permission('announcements.manage')))
with check (bucket_id = 'office-notices' and (select private.has_permission('announcements.manage')));
create policy office_notices_delete on storage.objects for delete to authenticated
using (bucket_id = 'office-notices' and (select private.has_permission('announcements.manage')));
