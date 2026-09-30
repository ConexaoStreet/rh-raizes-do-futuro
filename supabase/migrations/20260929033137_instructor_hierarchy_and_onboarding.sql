insert into public.permissions(code,name,module)
values
  ('instructor.view','Acessar central do instrutor','Instrutor'),
  ('role.view','Visualizar cargos e permissões','Acessos')
on conflict(code) do update
set name=excluded.name,
    module=excluded.module;

update public.roles
set name='Instrutor',
    description='Gestão pedagógica e operacional do RH, abaixo apenas do Desenvolvedor e sem acesso à Central T.I.',
    level=95,
    scope='organization',
    privileged=true,
    active=true,
    archived=false
where code='INSTRUCTOR';

with instructor_allowed(code) as (
  values
    ('attendance.maintenance'),
    ('attendance.manage'),
    ('attendance.view'),
    ('audit.view'),
    ('calendar.manage'),
    ('dashboard.view'),
    ('employee.manage'),
    ('employee.view'),
    ('feedback.manage'),
    ('feedback.view'),
    ('files.manage'),
    ('instructor.view'),
    ('justification.manage'),
    ('justification.view'),
    ('performance.grade'),
    ('performance.manage'),
    ('performance.view'),
    ('report.export'),
    ('report.view'),
    ('review.manage'),
    ('review.results'),
    ('role.view'),
    ('settings.manage'),
    ('user.approve'),
    ('user.manage'),
    ('user.view')
)
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id=r.id
  and rp.permission_id=p.id
  and r.code='INSTRUCTOR'
  and not exists(
    select 1 from instructor_allowed a where a.code=p.code
  );

with instructor_allowed(code) as (
  values
    ('attendance.maintenance'),
    ('attendance.manage'),
    ('attendance.view'),
    ('audit.view'),
    ('calendar.manage'),
    ('dashboard.view'),
    ('employee.manage'),
    ('employee.view'),
    ('feedback.manage'),
    ('feedback.view'),
    ('files.manage'),
    ('instructor.view'),
    ('justification.manage'),
    ('justification.view'),
    ('performance.grade'),
    ('performance.manage'),
    ('performance.view'),
    ('report.export'),
    ('report.view'),
    ('review.manage'),
    ('review.results'),
    ('role.view'),
    ('settings.manage'),
    ('user.approve'),
    ('user.manage'),
    ('user.view')
)
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
cross join instructor_allowed a
join public.permissions p on p.code=a.code
where r.code='INSTRUCTOR'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.code in ('instructor.view','role.view')
where r.code='SUPER_ADMIN'
on conflict do nothing;

create or replace function private.instructor_employee_allowed(employee_identifier uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select
    not private.has_role('INSTRUCTOR')
    or exists(
      select 1
      from public.employees target
      where target.id=employee_identifier
        and target.status='active'
    )
$function$;

revoke all on function private.instructor_employee_allowed(uuid)
from public,anon,authenticated;

drop policy if exists employees_read on public.employees;
create policy employees_read
on public.employees
for select
to authenticated
using (
  private.owns_employee(id)
  or (select private.can('employee.view'))
);

create or replace function private.can_manage_user(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  with actor as (
    select
      coalesce(max(r.level),0) as max_level,
      coalesce(bool_or(r.code='SUPER_ADMIN'),false) as is_super
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and r.active
      and not r.archived
  ),
  target as (
    select
      coalesce(max(r.level),0) as max_level,
      coalesce(bool_or(r.code in ('SUPER_ADMIN','TI_ADMIN')),false) as reserved
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=target_user
      and r.active
      and not r.archived
  )
  select
    target_user is distinct from auth.uid()
    and (
      actor.is_super
      or (
        not target.reserved
        and target.max_level < actor.max_level
      )
    )
  from actor cross join target
$function$;

revoke all on function private.can_manage_user(uuid)
from public,anon,authenticated;

create or replace function private.manage_user(
  user_identifier uuid,
  new_status text,
  role_identifiers uuid[],
  reason text
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  rid uuid;
  actor_level integer;
  actor_is_super boolean;
begin
  perform private.require_permission('user.manage');
  perform private.require_recent_verification(15);

  if not private.can_manage_user(user_identifier) then
    raise exception 'FORBIDDEN';
  end if;
  if reason is null or length(trim(reason))<3 then
    raise exception 'REASON_REQUIRED';
  end if;
  if new_status not in ('active','suspended','inactive','blocked')
     or coalesce(array_length(role_identifiers,1),0)=0
  then
    raise exception 'INVALID_TRANSITION';
  end if;

  select coalesce(max(r.level),0),coalesce(bool_or(r.code='SUPER_ADMIN'),false)
  into actor_level,actor_is_super
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  where ur.user_id=auth.uid()
    and r.active
    and not r.archived;

  perform 1 from public.profiles where id=user_identifier for update;
  if not found then raise exception 'INVALID_TRANSITION'; end if;

  foreach rid in array role_identifiers loop
    if not exists(
      select 1
      from public.roles r
      where r.id=rid
        and r.active
        and not r.archived
        and (
          actor_is_super
          or (
            r.level < actor_level
            and r.code not in ('SUPER_ADMIN','TI_ADMIN')
          )
        )
    ) then
      raise exception 'FORBIDDEN';
    end if;
  end loop;

  update public.profiles
  set status=new_status
  where id=user_identifier;

  delete from public.user_roles where user_id=user_identifier;
  insert into public.user_roles(user_id,role_id)
  select user_identifier,unnest(role_identifiers);

  insert into private.session_security(session_id,user_id,revoked_at)
  select id,user_id,now()
  from auth.sessions
  where user_id=user_identifier
  on conflict(session_id) do update
  set revoked_at=now(),
      verified_until=null,
      verified_at=null;

  perform private.log(
    'change_access',
    'profiles',
    user_identifier,
    null,
    jsonb_build_object('status',new_status,'roles',role_identifiers),
    'permission_change',
    jsonb_build_object('reason',reason)
  );
end
$function$;

create or replace function private.my_sessions(target_user uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  selected_user uuid := coalesce(target_user,auth.uid());
begin
  if not private.account_ready() then raise exception 'FORBIDDEN'; end if;

  if selected_user <> auth.uid() then
    perform private.require_permission('user.manage');
    if not private.can_manage_user(selected_user) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',s.id,
        'created_at',s.created_at,
        'updated_at',s.updated_at,
        'current',s.id=private.session_id(),
        'revoked',x.revoked_at is not null
      )
      order by s.created_at desc
    )
    from auth.sessions s
    left join private.session_security x on x.session_id=s.id
    where s.user_id=selected_user
  ),'[]'::jsonb);
end
$function$;

create or replace function private.revoke_session(session_identifier uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  owner_id uuid;
begin
  if not private.account_ready() then raise exception 'FORBIDDEN'; end if;

  select user_id into owner_id
  from auth.sessions
  where id=session_identifier;

  if owner_id is null then raise exception 'INVALID_TRANSITION'; end if;

  if owner_id <> auth.uid() then
    perform private.require_permission('user.manage');
    perform private.require_recent_verification(15);
    if not private.can_manage_user(owner_id) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  insert into private.session_security(
    session_id,user_id,revoked_at,verified_until,verified_at
  )
  values(session_identifier,owner_id,now(),null,null)
  on conflict(session_id) do update
  set revoked_at=now(),
      verified_until=null,
      verified_at=null;

  perform private.log(
    'revoke_session','sessions',session_identifier,null,null,'security'
  );
end
$function$;

create or replace function private.complete_profile(payload jsonb)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  submitted_name text := trim(coalesce(payload->>'full_name',''));
  submitted_phone text := trim(coalesce(payload->>'phone',''));
  submitted_role text := upper(trim(coalesce(payload->>'role_code','COLLABORATOR')));
  submitted_department uuid;
  candidate_count integer;
  candidate_id uuid;
  employee_row public.employees%rowtype;
  default_class public.classes%rowtype;
  auth_email text;
  confirmed_at timestamptz;
  selected_role_id uuid;
begin
  if not private.session_valid() then raise exception 'FORBIDDEN'; end if;
  if coalesce((payload->>'terms')::boolean,false)=false then
    raise exception 'TERMS_REQUIRED';
  end if;
  if length(submitted_name)<4 then
    raise exception 'PRE_REGISTRATION_NOT_FOUND';
  end if;
  if length(submitted_phone)<8 or length(submitted_phone)>30 then
    raise exception 'INVALID_PHONE';
  end if;
  if submitted_role not in ('COLLABORATOR','MANAGER','DIRECTOR','INSTRUCTOR') then
    raise exception 'INVALID_ROLE';
  end if;

  begin
    submitted_department := nullif(payload->>'department_id','')::uuid;
  exception when others then
    raise exception 'INVALID_DEPARTMENT';
  end;

  if submitted_department is null or not exists(
    select 1
    from public.departments d
    where d.id=submitted_department and d.active
  ) then
    raise exception 'INVALID_DEPARTMENT';
  end if;

  select u.email,u.email_confirmed_at
  into auth_email,confirmed_at
  from auth.users u
  where u.id=current_user_id;

  if auth_email is null or confirmed_at is null then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;

  select count(*),min(e.id)
  into candidate_count,candidate_id
  from public.employees e
  where e.status='active'
    and (e.profile_id is null or e.profile_id=current_user_id)
    and private.normalize_person_name(e.full_name)=private.normalize_person_name(submitted_name);

  if candidate_count=0 then raise exception 'PRE_REGISTRATION_NOT_FOUND'; end if;
  if candidate_count>1 then raise exception 'PRE_REGISTRATION_AMBIGUOUS'; end if;

  select *
  into employee_row
  from public.employees
  where id=candidate_id
  for update;

  if employee_row.profile_id is not null
     and employee_row.profile_id<>current_user_id
  then
    raise exception 'PRE_REGISTRATION_ALREADY_LINKED';
  end if;

  if employee_row.access_role_code<>submitted_role then
    raise exception 'ROLE_NOT_AUTHORIZED';
  end if;

  if nullif(trim(employee_row.email),'') is not null then
    if lower(trim(auth_email)) <> lower(trim(employee_row.email)) then
      raise exception 'PRE_REGISTERED_EMAIL_REQUIRED';
    end if;
  elsif auth_email !~* '^[^[:space:]@]+@gmail[.]com$' then
    raise exception 'GMAIL_REQUIRED';
  end if;

  select *
  into default_class
  from public.classes c
  where c.active
  order by c.created_at
  limit 1;

  if default_class.id is null then
    raise exception 'DEFAULT_CLASS_NOT_CONFIGURED';
  end if;

  update public.employees
  set profile_id=current_user_id,
      email=lower(auth_email),
      phone=left(submitted_phone,30),
      class_id=default_class.id,
      department_id=submitted_department,
      updated_at=now()
  where id=employee_row.id
    and (profile_id is null or profile_id=current_user_id);

  if not found then
    raise exception 'PRE_REGISTRATION_ALREADY_LINKED';
  end if;

  update public.profiles
  set full_name=employee_row.full_name,
      email=lower(auth_email),
      phone=left(submitted_phone,30),
      registration=employee_row.registration,
      requested_class=default_class.name,
      requested_department_id=submitted_department,
      requested_role_code=submitted_role,
      status='active',
      terms_accepted_at=coalesce(terms_accepted_at,now()),
      onboarded_at=coalesce(onboarded_at,now()),
      updated_at=now()
  where id=current_user_id;

  select id into selected_role_id
  from public.roles
  where code=submitted_role
    and active
    and not archived;

  if selected_role_id is null then raise exception 'ROLE_NOT_AVAILABLE'; end if;

  delete from public.user_roles where user_id=current_user_id;
  insert into public.user_roles(user_id,role_id)
  values(current_user_id,selected_role_id);

  perform private.log(
    'self_activate',
    'profiles',
    current_user_id,
    null,
    null,
    'permission_change',
    jsonb_build_object(
      'employee_id',employee_row.id,
      'department_id',submitted_department,
      'class_id',default_class.id,
      'role_code',submitted_role,
      'pre_registered_email',nullif(trim(employee_row.email),'') is not null
    )
  );
end
$function$;

revoke all on function private.complete_profile(jsonb) from public,anon;
grant execute on function private.complete_profile(jsonb) to authenticated;

revoke all on function private.manage_user(uuid,text,uuid[],text)
from public,anon,authenticated;
revoke all on function private.my_sessions(uuid)
from public,anon,authenticated;
revoke all on function private.revoke_session(uuid)
from public,anon,authenticated;

grant execute on function private.manage_user(uuid,text,uuid[],text)
to authenticated;
grant execute on function private.my_sessions(uuid)
to authenticated;
grant execute on function private.revoke_session(uuid)
to authenticated;

notify pgrst, 'reload schema';
