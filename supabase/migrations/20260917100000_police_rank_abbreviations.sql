alter table public.police_ranks
  add column abbreviation text;

update public.police_ranks set abbreviation = case name
  when 'General' then 'GR'
  when 'Teniente General' then 'TG'
  when 'Mayor General' then 'MG'
  when 'Brigadier General' then 'BG'
  when 'Coronel' then 'CR'
  when 'Teniente Coronel' then 'TC'
  when 'Mayor' then 'MY'
  when 'Capitán' then 'CT'
  when 'Teniente' then 'TE'
  when 'Subteniente' then 'ST'
  when 'Comisario' then 'CM'
  when 'Subcomisario' then 'SC'
  when 'Intendente Jefe' then 'IJ'
  when 'Intendente' then 'IT'
  when 'Subintendente' then 'SI'
  when 'Patrullero' then 'PT'
  when 'Agente' then 'AG'
  when 'Sargento Mayor' then 'SM'
  when 'Sargento Primero' then 'S1'
  when 'Sargento Viceprimero' then 'SV'
  when 'Sargento Segundo' then 'S2'
  when 'Cabo Primero' then 'C1'
  when 'Cabo Segundo' then 'C2'
  else abbreviation
end;
