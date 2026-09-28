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
  if coalesce((payload->>'terms')::boolean,false)=false then raise exception 'TERMS_REQUIRED'; end if;
  if length(submitted_name)<4 then raise exception 'PRE_REGISTRATION_NOT_FOUND'; end if;
  if length(submitted_phone)<8 or length(submitted_phone)>30 then raise exception 'INVALID_PHONE'; end if;
  if submitted_role not in ('COLLABORATOR','MANAGER','DIRECTOR','INSTRUCTOR')
    then raise exception 'INVALID_ROLE'; end if;

  begin
    submitted_department := nullif(payload->>'department_id','')::uuid;
  exception when others then
    raise exception 'INVALID_DEPARTMENT';
  end;

  if submitted_department is null or not exists(
    select 1 from public.departments d where d.id=submitted_department and d.active
  ) then raise exception 'INVALID_DEPARTMENT'; end if;

  select u.email,u.email_confirmed_at
  into auth_email,confirmed_at
  from auth.users u
  where u.id=current_user_id;

  if auth_email is null or confirmed_at is null then raise exception 'EMAIL_NOT_VERIFIED'; end if;
  if auth_email !~* '^[^[:space:]@]+@gmail[.]com$' then raise exception 'GMAIL_REQUIRED'; end if;

  select count(*),min(e.id)
  into candidate_count,candidate_id
  from public.employees e
  where e.status='active'
    and (e.profile_id is null or e.profile_id=current_user_id)
    and private.normalize_person_name(e.full_name)=private.normalize_person_name(submitted_name);

  if candidate_count=0 then raise exception 'PRE_REGISTRATION_NOT_FOUND'; end if;
  if candidate_count>1 then raise exception 'PRE_REGISTRATION_AMBIGUOUS'; end if;

  select * into employee_row
  from public.employees
  where id=candidate_id
  for update;

  if employee_row.profile_id is not null and employee_row.profile_id<>current_user_id
    then raise exception 'PRE_REGISTRATION_ALREADY_LINKED'; end if;

  if employee_row.access_role_code<>submitted_role
    then raise exception 'ROLE_NOT_AUTHORIZED'; end if;

  select * into default_class
  from public.classes c
  where c.active
  order by c.created_at
  limit 1;

  if default_class.id is null then raise exception 'DEFAULT_CLASS_NOT_CONFIGURED'; end if;

  update public.employees
  set profile_id=current_user_id,
      email=lower(auth_email),
      phone=left(submitted_phone,30),
      class_id=default_class.id,
      department_id=submitted_department,
      updated_at=now()
  where id=employee_row.id
    and (profile_id is null or profile_id=current_user_id);

  if not found then raise exception 'PRE_REGISTRATION_ALREADY_LINKED'; end if;

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
  where code=submitted_role and active and not archived;

  if selected_role_id is null then raise exception 'ROLE_NOT_AVAILABLE'; end if;

  delete from public.user_roles where user_id=current_user_id;
  insert into public.user_roles(user_id,role_id)
  values(current_user_id,selected_role_id);

  perform private.log(
    'self_activate','profiles',current_user_id,null,null,'permission_change',
    jsonb_build_object(
      'employee_id',employee_row.id,
      'department_id',submitted_department,
      'class_id',default_class.id,
      'role_code',submitted_role
    )
  );
end
$function$;

revoke all on function private.complete_profile(jsonb) from public, anon;
grant execute on function private.complete_profile(jsonb) to authenticated;
