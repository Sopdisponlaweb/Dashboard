-- Safe catalog data for local development.
-- Authentication users and business records are intentionally not seeded.

insert into public.municipalities (dane_code, department, name)
values
  ('05001', 'Antioquia', 'Medellín'),
  ('11001', 'Bogotá D.C.', 'Bogotá'),
  ('76001', 'Valle del Cauca', 'Cali')
on conflict do nothing;

insert into public.organizations (name, organization_type)
values
  ('CASUR', 'payer'),
  ('TEGEN', 'payer')
on conflict (name) do nothing;
