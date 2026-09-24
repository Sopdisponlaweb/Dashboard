-- The waiting period (carencia) runs from joined_on. Default it to Colombia's calendar date,
-- not the server's UTC date, so a record created at night does not start a day late.
alter table public.affiliates alter column joined_on set default (now() at time zone 'America/Bogota')::date;
alter table public.beneficiaries alter column joined_on set default (now() at time zone 'America/Bogota')::date;
