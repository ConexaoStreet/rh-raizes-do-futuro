create or replace function public.complete_profile(payload jsonb)
returns void
language sql
security invoker
set search_path=''
as $$
  select private.complete_profile(payload)
$$;

revoke all on function public.complete_profile(jsonb) from public, anon;
grant execute on function public.complete_profile(jsonb) to authenticated;

notify pgrst, 'reload schema';
