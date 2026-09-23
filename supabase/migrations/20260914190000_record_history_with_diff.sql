drop function if exists public.get_record_history(text, uuid);

create function public.get_record_history(p_table_name text, p_record_id uuid)
returns table (
  id bigint,
  actor_name text,
  operation text,
  occurred_at timestamptz,
  old_data jsonb,
  new_data jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_table_name not in ('affiliates', 'beneficiaries') then
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  if not private.has_permission('affiliates.read') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select e.id, p.display_name, e.operation, e.occurred_at, e.old_data, e.new_data
  from public.audit_events e
  left join public.profiles p on p.id = e.actor_id
  where e.table_name = p_table_name and e.record_id = p_record_id::text
  order by e.occurred_at desc
  limit 50;
end;
$$;

grant execute on function public.get_record_history(text, uuid) to authenticated;
