create or replace function private.bootstrap()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  p public.profiles;
  granted text[];
  registration_window boolean;
begin
  if not private.session_valid() then
    raise exception 'FORBIDDEN';
  end if;

  select * into p from public.profiles where id=auth.uid();

  select coalesce(array_agg(distinct pe.code),'{}')
    into granted
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions pe on pe.id=rp.permission_id
   where ur.user_id=auth.uid()
     and r.active
     and not r.archived;

  select coalesce((value->>'enabled')::boolean,false)
    into registration_window
    from public.settings
   where key='registration_access_window';

  registration_window := coalesce(registration_window,false);

  return jsonb_build_object(
    'profile',to_jsonb(p),
    'roles',private.roles_for_current_user(),
    'permissions',case when private.account_ready() then granted else '{}'::text[] end,
    'privileged',private.is_privileged(),
    'mfa_verified',exists(
      select 1 from private.session_security
      where session_id=private.session_id()
        and verified_until > now()
        and revoked_at is null
    ),
    'mfa_required',private.is_privileged() and not registration_window,
    'recently_verified',private.recently_verified(15),
    'ready',private.account_ready(),
    'server_time',now(),
    'maintenance',coalesce((select value from public.settings where key='maintenance'),'{}'),
    'employee_id',(select id from public.employees where profile_id=auth.uid())
  );
end
$function$;