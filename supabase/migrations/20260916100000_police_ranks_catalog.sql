create table public.police_ranks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in (
    'oficial_general', 'oficial_superior', 'oficial_subalterno', 'nivel_ejecutivo', 'historico'
  )),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger police_ranks_set_updated_at before update on public.police_ranks
for each row execute function private.set_updated_at();

alter table public.police_ranks enable row level security;

create policy police_ranks_read on public.police_ranks for select to authenticated using (true);
create policy police_ranks_insert on public.police_ranks for insert to authenticated
with check ((select private.has_permission('settings.manage')));
create policy police_ranks_update on public.police_ranks for update to authenticated
using ((select private.has_permission('settings.manage')))
with check ((select private.has_permission('settings.manage')));

insert into public.police_ranks (name, category, sort_order) values
  ('General', 'oficial_general', 10),
  ('Teniente General', 'oficial_general', 20),
  ('Mayor General', 'oficial_general', 30),
  ('Brigadier General', 'oficial_general', 40),
  ('Coronel', 'oficial_superior', 50),
  ('Teniente Coronel', 'oficial_superior', 60),
  ('Mayor', 'oficial_superior', 70),
  ('Capitán', 'oficial_subalterno', 80),
  ('Teniente', 'oficial_subalterno', 90),
  ('Subteniente', 'oficial_subalterno', 100),
  ('Comisario', 'nivel_ejecutivo', 110),
  ('Subcomisario', 'nivel_ejecutivo', 120),
  ('Intendente Jefe', 'nivel_ejecutivo', 130),
  ('Intendente', 'nivel_ejecutivo', 140),
  ('Subintendente', 'nivel_ejecutivo', 150),
  ('Patrullero', 'nivel_ejecutivo', 160),
  ('Agente', 'historico', 170),
  ('Sargento Mayor', 'historico', 180),
  ('Sargento Primero', 'historico', 190),
  ('Sargento Viceprimero', 'historico', 200),
  ('Sargento Segundo', 'historico', 210),
  ('Cabo Primero', 'historico', 220),
  ('Cabo Segundo', 'historico', 230)
on conflict (name) do nothing;

alter table public.affiliates
  add column police_rank_id uuid references public.police_ranks (id) on delete restrict;
