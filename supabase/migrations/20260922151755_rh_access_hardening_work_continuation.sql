
alter table private.session_security
  add column if not exists verified_at timestamptz;

create or replace function private.recently_verified(max_age_minutes integer default 15)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.session_valid()
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
$$;

create or replace function private.require_recent_verification(max_age_minutes integer default 15)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.recently_verified(max_age_minutes) then
    raise exception 'RECENT_VERIFICATION_REQUIRED';
  end if;
end
$$;

create or replace function private.consume_otp_after_revocation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.revoked_at is not null
     and (tg_op = 'INSERT' or old.revoked_at is distinct from new.revoked_at) then
    update private.otp_challenges
       set consumed_at = coalesce(consumed_at, now())
     where session_id = new.session_id
       and consumed_at is null;
  end if;
  return new;
end
$$;

drop trigger if exists consume_otp_after_revocation on private.session_security;
create trigger consume_otp_after_revocation
after insert or update of revoked_at on private.session_security
for each row execute function private.consume_otp_after_revocation();

create or replace function private.issue_otp(user_identifier uuid,session_identifier uuid,hash_value text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
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
        verified_at=null
  where private.session_security.revoked_at is null;

  insert into public.audit_logs(actor_user_id,actor_name,event_type,action,module)
  select user_identifier,full_name,'authentication','otp_requested','security'
    from public.profiles
   where id=user_identifier;

  return jsonb_build_object('ok',true,'challenge_id',identifier);
end
$$;

create or replace function private.verify_otp(user_identifier uuid,session_identifier uuid,hash_value text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
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
          verified_until=now()+interval '8 hours'
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
$$;

create or replace function private.bootstrap()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.profiles;
  granted text[];
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
    'recently_verified',private.recently_verified(15),
    'ready',private.account_ready(),
    'server_time',now(),
    'maintenance',coalesce((select value from public.settings where key='maintenance'),'{}'),
    'employee_id',(select id from public.employees where profile_id=auth.uid())
  );
end
$$;

create or replace function private.manage_user(user_identifier uuid,new_status text,role_identifiers uuid[],reason text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  rid uuid;
begin
  perform private.require_permission('user.manage');
  perform private.require_recent_verification(15);

  if user_identifier=auth.uid() then raise exception 'FORBIDDEN'; end if;
  if reason is null or length(trim(reason))<3 then raise exception 'REASON_REQUIRED'; end if;
  if new_status not in ('active','suspended','inactive','blocked')
     or coalesce(array_length(role_identifiers,1),0)=0
  then raise exception 'INVALID_TRANSITION'; end if;

  perform 1 from public.profiles where id=user_identifier for update;
  if not found then raise exception 'INVALID_TRANSITION'; end if;

  foreach rid in array role_identifiers loop
    if not exists(select 1 from public.roles where id=rid and active and not archived)
    then raise exception 'INVALID_TRANSITION'; end if;
  end loop;

  if exists(
    select 1
    from public.roles r
    where r.id=any(role_identifiers)
      and r.code='SUPER_ADMIN'
  ) and not 'SUPER_ADMIN'=any(private.roles_for_current_user())
  then
    raise exception 'FORBIDDEN';
  end if;

  update public.profiles set status=new_status where id=user_identifier;
  delete from public.user_roles where user_id=user_identifier;
  insert into public.user_roles select user_identifier,unnest(role_identifiers);

  insert into private.session_security(session_id,user_id,revoked_at)
  select id,user_id,now()
  from auth.sessions
  where user_id=user_identifier
  on conflict(session_id) do update
    set revoked_at=now(),
        verified_until=null,
        verified_at=null;

  perform private.log(
    'change_access','profiles',user_identifier,null,
    jsonb_build_object('status',new_status,'roles',role_identifiers),
    'permission_change',
    jsonb_build_object('reason',reason)
  );
end
$$;

create or replace function private.save_role(payload jsonb,permission_identifiers uuid[],expected_version integer,reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  rid uuid=(payload->>'id')::uuid;
  previous public.roles;
  privileged_value boolean;
  old_permissions uuid[];
  reserved_requested boolean;
begin
  perform private.require_permission('role.manage');
  perform private.require_recent_verification(15);

  if reason is null or length(trim(reason))<3 then
    raise exception 'REASON_REQUIRED';
  end if;

  if coalesce(array_length(permission_identifiers,1),0)=0 then
    raise exception 'INVALID_TRANSITION';
  end if;

  if exists(
    select 1
    from unnest(permission_identifiers) p(id)
    left join public.permissions pe on pe.id=p.id
    where pe.id is null
  ) then
    raise exception 'INVALID_TRANSITION';
  end if;

  select exists(
    select 1
    from public.permissions
    where id=any(permission_identifiers)
      and code in ('user.manage','role.manage','audit.security','system.manage')
  ) into reserved_requested;

  select exists(
    select 1
    from public.permissions
    where id=any(permission_identifiers)
      and code in (
        'employee.manage','attendance.manage','attendance.maintenance',
        'justification.manage','feedback.manage','performance.manage',
        'review.manage','review.results','report.export','user.approve',
        'user.manage','role.manage','audit.view','audit.security',
        'calendar.manage','settings.manage','system.manage','files.manage'
      )
  ) into privileged_value;

  if rid is null then
    if reserved_requested then raise exception 'FORBIDDEN'; end if;

    insert into public.roles(code,name,description,level,scope,privileged)
    values(
      'CUSTOM_'||replace(gen_random_uuid()::text,'-',''),
      trim(payload->>'name'),
      coalesce(payload->>'description',''),
      least(69,greatest(1,coalesce((payload->>'level')::integer,1))),
      case when privileged_value then 'organization' else 'self' end,
      privileged_value
    )
    returning id into rid;
  else
    select * into previous from public.roles where id=rid for update;

    if previous.id is null or previous.version is distinct from expected_version then
      raise exception 'CONFLICT';
    end if;

    if previous.code='SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
    if reserved_requested then raise exception 'FORBIDDEN'; end if;

    update public.roles
       set name=trim(payload->>'name'),
           description=coalesce(payload->>'description',''),
           active=coalesce((payload->>'active')::boolean,true),
           archived=coalesce((payload->>'archived')::boolean,false),
           level=case when previous.code='MANAGER' then 70
                      else least(69,greatest(1,coalesce((payload->>'level')::integer,previous.level)))
                 end,
           privileged=case when previous.code='MANAGER' then true else privileged_value end,
           scope=case when previous.code='MANAGER' or privileged_value then 'organization' else 'self' end
     where id=rid;
  end if;

  select coalesce(array_agg(permission_id),'{}'::uuid[])
    into old_permissions
    from public.role_permissions
   where role_id=rid;

  delete from public.role_permissions where role_id=rid;
  insert into public.role_permissions select rid,unnest(permission_identifiers);

  insert into private.session_security(session_id,user_id,revoked_at)
  select s.id,s.user_id,now()
  from auth.sessions s
  join public.user_roles ur on ur.user_id=s.user_id
  where ur.role_id=rid
  on conflict(session_id) do update
    set revoked_at=now(),
        verified_until=null,
        verified_at=null;

  perform private.log(
    'save_role','roles',rid,to_jsonb(previous),
    (select to_jsonb(r) from public.roles r where r.id=rid),
    'permission_change',
    jsonb_build_object(
      'reason',reason,
      'old_permissions',old_permissions,
      'new_permissions',permission_identifiers
    )
  );

  return rid;
end
$$;

create or replace function private.revoke_session(session_identifier uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid;
begin
  if not private.account_ready() then raise exception 'FORBIDDEN'; end if;

  select user_id into owner_id from auth.sessions where id=session_identifier;
  if owner_id is null then raise exception 'INVALID_TRANSITION'; end if;

  if owner_id <> auth.uid() then
    perform private.require_permission('user.manage');
    perform private.require_recent_verification(15);
  end if;

  insert into private.session_security(session_id,user_id,revoked_at,verified_until,verified_at)
  values(session_identifier,owner_id,now(),null,null)
  on conflict(session_id) do update
    set revoked_at=now(),
        verified_until=null,
        verified_at=null;

  perform private.log('revoke_session','sessions',session_identifier,null,null,'security');
end
$$;

create unique index if not exists absence_justification_one_active_per_member
on public.absence_justifications(member_id)
where status in ('pending','accepted');

create or replace function private.guard_snapshot()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.attendance_sessions;
  justification_flow boolean :=
    coalesce(current_setting('app.justification_review',true),'')='1';
begin
  if tg_op='DELETE' then raise exception 'SNAPSHOT_IMMUTABLE'; end if;

  select * into s
  from public.attendance_sessions
  where id=new.session_id;

  if tg_op='INSERT'
     and (s.original_member_count <> 0 or s.status <> 'editing' or current_user <> 'postgres')
  then
    raise exception 'SNAPSHOT_IMMUTABLE';
  end if;

  if tg_op='UPDATE' then
    if (new.id,new.session_id,new.employee_id,new.full_name_snapshot,new.registration_snapshot,new.expected_arrival,new.expected_departure,new.created_at)
       is distinct from
       (old.id,old.session_id,old.employee_id,old.full_name_snapshot,old.registration_snapshot,old.expected_arrival,old.expected_departure,old.created_at)
    then
      raise exception 'SNAPSHOT_IMMUTABLE';
    end if;

    if justification_flow then
      if old.status <> 'absent'
         or new.status <> 'justified'
         or new.actual_arrival is distinct from old.actual_arrival
         or new.actual_departure is distinct from old.actual_departure
         or new.notes is distinct from old.notes
      then
        raise exception 'INVALID_TRANSITION';
      end if;
      return new;
    end if;

    if s.status='maintenance' then
      if not private.can('attendance.maintenance')
         or not private.recently_verified(15)
         or not exists(
           select 1 from public.attendance_maintenance
           where session_id=s.id and closed_at is null
         )
      then
        raise exception 'RECENT_VERIFICATION_REQUIRED';
      end if;
    elsif s.status <> 'editing' then
      raise exception 'INVALID_TRANSITION';
    elsif not private.normal_window(s.class_id,s.scheduled_date) then
      raise exception 'OUTSIDE_WINDOW';
    elsif not private.can('attendance.manage') then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  return new;
end
$$;

create or replace function private.save_attendance(session_identifier uuid,changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.attendance_sessions;
  change jsonb;
  member public.attendance_members;
  next_status text;
begin
  select * into s from public.attendance_sessions where id=session_identifier for update;
  if s.id is null then raise exception 'INVALID_TRANSITION'; end if;

  if s.status='maintenance' then
    perform private.require_permission('attendance.maintenance');
    perform private.require_recent_verification(15);
  elsif s.status='editing' then
    perform private.require_permission('attendance.manage');
    if not private.normal_window(s.class_id,s.scheduled_date) then
      raise exception 'OUTSIDE_WINDOW';
    end if;
  else
    raise exception 'INVALID_TRANSITION';
  end if;

  if jsonb_typeof(changes)<>'array'
     or jsonb_array_length(changes)>1000
     or jsonb_array_length(changes)=0
  then
    raise exception 'INVALID_TRANSITION';
  end if;

  for change in select * from jsonb_array_elements(changes) loop
    if exists(
      select 1 from jsonb_object_keys(change) k
      where k not in ('id','version','status','actual_arrival','actual_departure','notes')
    ) then
      raise exception 'SNAPSHOT_IMMUTABLE';
    end if;

    select * into member
    from public.attendance_members
    where id=(change->>'id')::uuid
      and session_id=session_identifier
    for update;

    if member.id is null then raise exception 'SNAPSHOT_IMMUTABLE'; end if;
    if member.version is distinct from (change->>'version')::integer then
      raise exception 'CONFLICT';
    end if;

    next_status=coalesce(change->>'status',member.status);

    update public.attendance_members
       set status=next_status,
           actual_arrival=case when change?'actual_arrival'
             then nullif(change->>'actual_arrival','')::time else actual_arrival end,
           actual_departure=case when change?'actual_departure'
             then nullif(change->>'actual_departure','')::time else actual_departure end,
           notes=case when change?'notes'
             then left(coalesce(change->>'notes',''),3000) else notes end
     where id=member.id;
  end loop;

  if (select count(*) from public.attendance_members where session_id=session_identifier)
     <> s.original_member_count
  then
    raise exception 'SNAPSHOT_IMMUTABLE';
  end if;

  update public.attendance_sessions set updated_at=now() where id=session_identifier;

  return jsonb_build_object(
    'saved',jsonb_array_length(changes),
    'server_time',now(),
    'recently_verified',private.recently_verified(15)
  );
end
$$;

create or replace function private.start_maintenance(session_identifier uuid,reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.attendance_sessions;
  identifier uuid;
begin
  perform private.require_permission('attendance.maintenance');
  perform private.require_recent_verification(15);

  if coalesce(length(trim(reason)),0)<3 then raise exception 'REASON_REQUIRED'; end if;

  select * into s
  from public.attendance_sessions
  where id=session_identifier
  for update;

  if s.id is null
     or s.status='maintenance'
     or (s.status='editing' and private.normal_window(s.class_id,s.scheduled_date))
  then
    raise exception 'INVALID_TRANSITION';
  end if;

  insert into public.attendance_maintenance(session_id,opened_by,reason)
  values(s.id,auth.uid(),trim(reason))
  returning id into identifier;

  update public.attendance_sessions set status='maintenance' where id=s.id;

  perform private.log(
    'start','attendance_maintenance',identifier,null,null,
    'attendance_maintenance',
    jsonb_build_object('reason',reason,'recent_verification',true)
  );

  return identifier;
end
$$;

create or replace function private.end_maintenance(session_identifier uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.attendance_sessions;
begin
  perform private.require_permission('attendance.maintenance');
  perform private.require_recent_verification(15);

  select * into s
  from public.attendance_sessions
  where id=session_identifier
  for update;

  if s.status<>'maintenance' then raise exception 'INVALID_TRANSITION'; end if;

  if (select count(*) from public.attendance_members where session_id=s.id)
     <> s.original_member_count
  then
    raise exception 'SNAPSHOT_IMMUTABLE';
  end if;

  update public.attendance_maintenance
     set closed_by=auth.uid(),closed_at=now()
   where session_id=s.id and closed_at is null;

  update public.attendance_sessions
     set status='finalized',
         finalized_by=coalesce(finalized_by,auth.uid()),
         finalized_at=coalesce(finalized_at,now())
   where id=s.id;

  perform private.log(
    'end','attendance_maintenance',s.id,null,null,
    'attendance_maintenance',
    jsonb_build_object('recent_verification',true)
  );
end
$$;

create or replace function private.submit_justification(member_identifier uuid,category_identifier uuid,reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  employee_identifier uuid;
  identifier uuid;
  member_status text;
  session_status text;
begin
  select m.employee_id,m.status,s.status
    into employee_identifier,member_status,session_status
    from public.attendance_members m
    join public.attendance_sessions s on s.id=m.session_id
   where m.id=member_identifier;

  if employee_identifier is null then raise exception 'INVALID_TRANSITION'; end if;

  if not (private.can('justification.manage') or private.owns_employee(employee_identifier)) then
    raise exception 'FORBIDDEN';
  end if;

  if coalesce(length(trim(reason)),0)<3 then raise exception 'REASON_REQUIRED'; end if;
  if session_status='editing' then raise exception 'ATTENDANCE_NOT_FINALIZED'; end if;
  if member_status<>'absent' then raise exception 'NOT_ELIGIBLE'; end if;

  if not exists(
    select 1 from public.justification_categories
    where id=category_identifier and active
  ) then
    raise exception 'INVALID_TRANSITION';
  end if;

  if exists(
    select 1 from public.absence_justifications
    where member_id=member_identifier and status in ('pending','accepted')
  ) then
    raise exception 'DUPLICATE_JUSTIFICATION';
  end if;

  insert into public.absence_justifications(member_id,employee_id,category_id,reason)
  values(member_identifier,employee_identifier,category_identifier,trim(reason))
  returning id into identifier;

  insert into public.notifications(user_id,title,path)
  select distinct ur.user_id,'Justificativa aguardando análise','/justificativas'
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id and r.active and not r.archived
  join public.role_permissions rp on rp.role_id=ur.role_id
  join public.permissions p on p.id=rp.permission_id
  where p.code='justification.manage';

  return identifier;
end
$$;

create or replace function private.review_justification(identifier uuid,decision text,note text,expected_version integer)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  j public.absence_justifications;
  member_status text;
  session_status text;
begin
  perform private.require_permission('justification.manage');

  select * into j
  from public.absence_justifications
  where id=identifier
  for update;

  if j.id is null then raise exception 'INVALID_TRANSITION'; end if;
  if j.version is distinct from expected_version then raise exception 'CONFLICT'; end if;
  if j.status<>'pending' then raise exception 'INVALID_TRANSITION'; end if;
  if decision not in ('accepted','rejected')
     or coalesce(length(trim(note)),0)<3
  then
    raise exception 'REASON_REQUIRED';
  end if;

  select m.status,s.status
    into member_status,session_status
    from public.attendance_members m
    join public.attendance_sessions s on s.id=m.session_id
   where m.id=j.member_id
   for update of m;

  if session_status='editing' then raise exception 'ATTENDANCE_NOT_FINALIZED'; end if;
  if member_status<>'absent' then raise exception 'INVALID_TRANSITION'; end if;

  update public.absence_justifications
     set status=decision,
         review_comment=trim(note),
         reviewed_by=auth.uid(),
         reviewed_at=now()
   where id=identifier;

  if decision='accepted' then
    perform set_config('app.justification_review','1',true);
    update public.attendance_members
       set status='justified'
     where id=j.member_id
       and status='absent';
  end if;

  insert into public.notifications(user_id,title,path)
  select profile_id,'Justificativa analisada','/justificativas'
  from public.employees
  where id=j.employee_id
    and profile_id is not null;
end
$$;

create or replace function private.set_review_cycle_status(identifier uuid,next_status text,expected_version integer)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  previous public.manager_review_cycles;
begin
  perform private.require_permission('review.manage');

  select * into previous
  from public.manager_review_cycles
  where id=identifier
  for update;

  if previous.version is distinct from expected_version then raise exception 'CONFLICT'; end if;

  if not (
    (previous.status in ('draft','scheduled') and next_status in ('scheduled','open','archived'))
    or (previous.status='open' and next_status='closed')
    or (previous.status='closed' and next_status='archived')
  ) then
    raise exception 'INVALID_TRANSITION';
  end if;

  if next_status='open' then
    if previous.start_date>(private.business_now() at time zone 'America/Sao_Paulo')::date
       or previous.end_date<(private.business_now() at time zone 'America/Sao_Paulo')::date
    then
      raise exception 'INVALID_TRANSITION';
    end if;

    insert into private.manager_review_eligibility(cycle_id,manager_id,user_id)
    select identifier,t.manager_id,p.id
    from public.manager_cycle_targets t
    cross join public.profiles p
    join public.employees e on e.profile_id=p.id
    where t.cycle_id=identifier
      and p.status='active'
      and e.status='active'
      and exists(
        select 1
        from public.user_roles ur
        join public.roles r on r.id=ur.role_id
        where ur.user_id=p.id
          and r.code='COLLABORATOR'
          and r.active
          and not r.archived
      )
      and not exists(
        select 1
        from public.user_roles ur
        join public.roles r on r.id=ur.role_id
        where ur.user_id=p.id
          and r.active
          and not r.archived
          and r.privileged
      )
      and not exists(select 1 from public.managers m where m.profile_id=p.id)
      and exists(select 1 from public.managers m where m.id=t.manager_id and m.active)
    on conflict do nothing;

    insert into public.notifications(user_id,title,path)
    select distinct user_id,'Avaliação da gestão aberta','/gestao'
    from private.manager_review_eligibility
    where cycle_id=identifier;
  end if;

  update public.manager_review_cycles set status=next_status where id=identifier;
end
$$;

insert into public.releases(version,changes)
values (
  '1.0.1',
  'Reforço de acessos: revogação de OTP e sessões, limites de privilégios, justificativas após encerramento da chamada, correção de presença com verificação recente e elegibilidade de avaliações.'
)
on conflict(version) do nothing;

revoke all on function private.recently_verified(integer) from public,anon;
revoke all on function private.require_recent_verification(integer) from public,anon,authenticated;
