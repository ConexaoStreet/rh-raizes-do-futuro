alter table private.session_security add column verified_factor_id uuid;

create function private.mfa_session_verified()
returns boolean language sql stable security definer set search_path='' as $function$
  select private.session_valid() and exists(
    select 1 from private.session_security x
    where x.session_id=private.session_id()
      and x.user_id=auth.uid()
      and x.revoked_at is null
      and x.verified_at is not null
      and x.verified_until>now()
      and (
        x.verified_factor_id is null
        or exists(
          select 1 from auth.sessions s
          join auth.mfa_factors f on f.id=s.factor_id
          where s.id=x.session_id
            and s.user_id=x.user_id
            and s.aal='aal2'
            and f.id=x.verified_factor_id
            and f.user_id=x.user_id
            and f.factor_type='totp'
            and f.status='verified'
        )
      )
  )
$function$;

create function private.confirm_authenticator_session()
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  claims jsonb := auth.jwt();
  user_identifier uuid := auth.uid();
  session_identifier uuid := private.session_id();
  factor_identifier uuid;
  proof_at timestamptz;
  proof_timestamp bigint;
  repeat_proof boolean;
begin
  if not private.session_valid()
    or coalesce(claims->>'aal','')<>'aal2'
    or jsonb_typeof(claims->'amr') is distinct from 'array'
    or not exists(
      select 1 from public.profiles p join auth.users u on u.id=p.id
      where p.id=user_identifier and p.status='active'
        and p.onboarded_at is not null and p.terms_accepted_at is not null
        and u.email_confirmed_at is not null
    )
  then
    raise exception 'NATIVE_MFA_REQUIRED';
  end if;

  if not exists(select 1 from jsonb_array_elements(claims->'amr') entry where entry->>'method'='password') then
    raise exception 'NATIVE_MFA_REQUIRED';
  end if;

  select max(case when entry->>'timestamp' ~ '^[0-9]{1,12}$' then (entry->>'timestamp')::bigint end)
  into proof_timestamp from jsonb_array_elements(claims->'amr') entry where entry->>'method'='totp';

  if proof_timestamp is null then
    raise exception 'NATIVE_MFA_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(user_identifier::text,1));

  select f.id, a.updated_at into factor_identifier, proof_at
  from auth.sessions s
  join auth.mfa_factors f on f.id=s.factor_id and f.user_id=s.user_id
  join auth.mfa_amr_claims a on a.session_id=s.id and a.authentication_method='totp'
  where s.id=session_identifier and s.user_id=user_identifier
    and s.aal='aal2' and (s.not_after is null or s.not_after>now())
    and f.factor_type='totp' and f.status='verified';

  if factor_identifier is null or proof_at is null
    or floor(extract(epoch from proof_at))::bigint<>proof_timestamp
    or proof_at<now()-interval '15 minutes'
    or proof_at>now()+interval '30 seconds'
  then
    raise exception 'NATIVE_MFA_REQUIRED';
  end if;

  select coalesce(bool_or(
    x.verified_factor_id=factor_identifier and x.verified_at=proof_at
    and x.verified_until=proof_at+interval '8 hours'
  ),false) into repeat_proof
  from private.session_security x where x.session_id=session_identifier and x.user_id=user_identifier;

  insert into private.session_security(session_id,user_id,verified_at,verified_until,verified_factor_id)
  values(session_identifier,user_identifier,proof_at,proof_at+interval '8 hours',factor_identifier)
  on conflict(session_id) do update
    set verified_at=excluded.verified_at,
        verified_until=excluded.verified_until,
        verified_factor_id=excluded.verified_factor_id
    where private.session_security.user_id=user_identifier
      and private.session_security.revoked_at is null;

  if not found then
    raise exception 'NATIVE_MFA_REQUIRED';
  end if;

  update private.otp_challenges set consumed_at=coalesce(consumed_at,now())
  where user_id=user_identifier and session_id=session_identifier and consumed_at is null;

  if not repeat_proof then
    insert into public.audit_logs(actor_user_id,actor_name,event_type,action,module)
    select user_identifier,full_name,'authentication','authenticator_verified','security'
    from public.profiles where id=user_identifier;
  end if;

  return jsonb_build_object('ok',true,'verified_at',proof_at,'verified_until',proof_at+interval '8 hours');
end
$function$;

create function public.confirm_authenticator_session()
returns jsonb language sql security invoker set search_path='' as $function$
  select private.confirm_authenticator_session()
$function$;

revoke all on function private.mfa_session_verified(),private.confirm_authenticator_session(),public.confirm_authenticator_session() from public,anon;
grant execute on function private.mfa_session_verified(),private.confirm_authenticator_session(),public.confirm_authenticator_session() to authenticated;

CREATE OR REPLACE FUNCTION private.account_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select
  private.session_valid()
  and exists(
    select 1
    from public.profiles p
    where p.id=auth.uid()
      and p.status='active'
      and p.onboarded_at is not null
      and p.terms_accepted_at is not null
  )
  and (
    not private.is_privileged()
    or coalesce(
      (select (value->>'enabled')::boolean
       from public.settings
       where key='registration_access_window'),
      false
    )
    or private.mfa_session_verified()
  )
  and (
    not coalesce(
      (select (value->>'enabled')::boolean from public.settings where key='maintenance'),
      false
    )
    or 'SUPER_ADMIN'=any(private.roles_for_current_user())
    or 'TI_ADMIN'=any(private.roles_for_current_user())
    or (
      coalesce(
        (select (value->>'allow_managers')::boolean from public.settings where key='maintenance'),
        false
      )
      and private.is_privileged()
    )
  )
$function$;

CREATE OR REPLACE FUNCTION private.bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.profiles;
  granted text[];
  registration_window boolean;
  actual_mfa_verified boolean;
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

  actual_mfa_verified := private.mfa_session_verified();

  return jsonb_build_object(
    'profile',to_jsonb(p),
    'roles',private.roles_for_current_user(),
    'permissions',case when private.account_ready() then granted else '{}'::text[] end,
    'privileged',private.is_privileged(),
    'mfa_verified',registration_window or actual_mfa_verified,
    'mfa_required',private.is_privileged() and not registration_window,
    'recently_verified',private.recently_verified(15),
    'ready',private.account_ready(),
    'server_time',now(),
    'maintenance',coalesce((select value from public.settings where key='maintenance'),'{}'),
    'employee_id',(select id from public.employees where profile_id=auth.uid())
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.recently_verified(max_age_minutes integer DEFAULT 15)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.mfa_session_verified()
    and max_age_minutes between 1 and 120
    and exists (
      select 1
      from private.session_security s
      where s.session_id = private.session_id()
        and s.user_id = auth.uid()
        and s.revoked_at is null
        and s.verified_at is not null
        and s.verified_at >= now() - make_interval(mins => max_age_minutes)
    )
$function$;

CREATE OR REPLACE FUNCTION private.issue_otp(user_identifier uuid, session_identifier uuid, hash_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  last_sent timestamptz;
  request_count integer;
  identifier uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
      select 1 from auth.sessions
      where id=session_identifier
        and user_id=user_identifier
        and (not_after is null or not_after>now())
    )
    or exists (
      select 1 from private.session_security
      where session_id=session_identifier
        and revoked_at is not null
    )
    or not exists (
      select 1 from public.profiles
      where id=user_identifier and status='active'
    )
    or not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id=ur.role_id
      where ur.user_id=user_identifier
        and r.active
        and not r.archived
        and r.privileged
    )
  then
    raise exception 'FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(user_identifier::text,1));

  select max(created_at),
         count(*) filter(where created_at > now()-interval '1 hour')
    into last_sent, request_count
    from private.otp_challenges
   where user_id=user_identifier;

  if last_sent > now()-interval '60 seconds' or request_count >= 5 then
    return jsonb_build_object('ok',false,'error','RATE_LIMITED');
  end if;

  update private.otp_challenges
     set consumed_at=coalesce(consumed_at,now())
   where user_id=user_identifier
     and consumed_at is null;

  insert into private.otp_challenges(user_id,session_id,code_hash,expires_at)
  values(user_identifier,session_identifier,hash_value,now()+interval '5 minutes')
  returning id into identifier;

  insert into private.session_security(session_id,user_id,verified_until,verified_at,revoked_at)
  values(session_identifier,user_identifier,null,null,null)
  on conflict(session_id) do update
    set verified_until=null,
        verified_at=null,
        verified_factor_id=null
  where private.session_security.revoked_at is null;

  insert into public.audit_logs(actor_user_id,actor_name,event_type,action,module)
  select user_identifier,full_name,'authentication','otp_requested','security'
    from public.profiles
   where id=user_identifier;

  return jsonb_build_object('ok',true,'challenge_id',identifier);
end
$function$;

CREATE OR REPLACE FUNCTION private.verify_otp(user_identifier uuid, session_identifier uuid, hash_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  challenge private.otp_challenges;
  valid boolean;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(user_identifier::text,1));

  if not exists (
      select 1 from auth.sessions
      where id=session_identifier
        and user_id=user_identifier
        and (not_after is null or not_after>now())
    )
    or exists (
      select 1 from private.session_security
      where session_id=session_identifier
        and revoked_at is not null
    )
    or not exists (
      select 1 from public.profiles
      where id=user_identifier and status='active'
    )
    or not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id=ur.role_id
      where ur.user_id=user_identifier
        and r.active
        and not r.archived
        and r.privileged
    )
  then
    return jsonb_build_object('ok',false);
  end if;

  select *
    into challenge
    from private.otp_challenges
   where user_id=user_identifier
     and session_id=session_identifier
   order by created_at desc
   limit 1
   for update;

  valid = challenge.id is not null
      and challenge.consumed_at is null
      and challenge.expires_at > now()
      and challenge.attempts < 5
      and challenge.code_hash = hash_value;

  if challenge.id is not null and challenge.consumed_at is null then
    update private.otp_challenges
       set attempts=attempts+1,
           consumed_at=case when valid or attempts+1>=5 then now() else null end
     where id=challenge.id;
  end if;

  if valid then
    insert into private.session_security(session_id,user_id,verified_at,verified_until,revoked_at)
    values(session_identifier,user_identifier,now(),now()+interval '8 hours',null)
    on conflict(session_id) do update
      set verified_at=now(),
          verified_until=now()+interval '8 hours',
          verified_factor_id=null
    where private.session_security.user_id=user_identifier
      and private.session_security.revoked_at is null;
  end if;

  insert into public.audit_logs(actor_user_id,actor_name,event_type,action,module,success)
  select user_identifier,
         full_name,
         'authentication',
         case when valid then 'otp_verified' else 'otp_failed' end,
         'security',
         valid
    from public.profiles
   where id=user_identifier;

  return jsonb_build_object('ok',coalesce(valid,false));
end
$function$;
