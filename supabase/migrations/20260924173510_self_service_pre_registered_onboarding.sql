alter table public.profiles
  add column if not exists requested_department_id uuid references public.departments(id);

create or replace function private.normalize_person_name(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(
    regexp_replace(
      lower(
        translate(
          coalesce(value,''),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
        )
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  )
$$;

create or replace function public.registration_options()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_class jsonb;
  department_list jsonb;
begin
  select jsonb_build_object('id',c.id,'name',c.name,'code',c.code)
    into default_class
    from public.classes c
   where c.active
   order by c.created_at
   limit 1;

  select coalesce(
    jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name),
    '[]'::jsonb
  )
    into department_list
    from public.departments d
   where d.active;

  return jsonb_build_object(
    'class', default_class,
    'departments', department_list
  );
end;
$$;

revoke all on function public.registration_options() from public;
grant execute on function public.registration_options() to anon, authenticated;

create or replace function public.match_pre_registered_user(full_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := private.normalize_person_name(full_name);
  candidate_count integer;
  candidate_name text;
begin
  if length(normalized) < 4 then
    return jsonb_build_object('matched',false,'reason','INCOMPLETE_NAME');
  end if;

  select count(*), min(e.full_name)
    into candidate_count, candidate_name
    from public.employees e
   where e.status='active'
     and e.profile_id is null
     and private.normalize_person_name(e.full_name)=normalized;

  if candidate_count = 1 then
    return jsonb_build_object(
      'matched',true,
      'canonical_name',candidate_name
    );
  end if;

  if candidate_count > 1 then
    return jsonb_build_object('matched',false,'reason','AMBIGUOUS_NAME');
  end if;

  return jsonb_build_object('matched',false,'reason','NOT_FOUND');
end;
$$;

revoke all on function public.match_pre_registered_user(text) from public;
grant execute on function public.match_pre_registered_user(text) to anon, authenticated;

create or replace function private.complete_profile(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  submitted_name text := trim(coalesce(payload->>'full_name',''));
  submitted_phone text := trim(coalesce(payload->>'phone',''));
  submitted_department uuid;
  candidate_count integer;
  candidate_id uuid;
  employee_row public.employees%rowtype;
  default_class public.classes%rowtype;
  auth_email text;
  confirmed_at timestamptz;
begin
  if not private.session_valid() then
    raise exception 'FORBIDDEN';
  end if;

  if coalesce((payload->>'terms')::boolean,false)=false then
    raise exception 'TERMS_REQUIRED';
  end if;

  if length(submitted_name) < 4 then
    raise exception 'PRE_REGISTRATION_NOT_FOUND';
  end if;

  if length(submitted_phone) < 8 or length(submitted_phone) > 30 then
    raise exception 'INVALID_PHONE';
  end if;

  begin
    submitted_department := nullif(payload->>'department_id','')::uuid;
  exception when others then
    raise exception 'INVALID_DEPARTMENT';
  end;

  if submitted_department is null or not exists(
    select 1 from public.departments d
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

  select *
    into default_class
    from public.classes c
   where c.active
   order by c.created_at
   limit 1;

  if default_class.id is null then
    raise exception 'DEFAULT_CLASS_NOT_CONFIGURED';
  end if;

  select count(*), min(e.id)
    into candidate_count,candidate_id
    from public.employees e
   where e.status='active'
     and (e.profile_id is null or e.profile_id=current_user_id)
     and private.normalize_person_name(e.full_name)=private.normalize_person_name(submitted_name);

  if candidate_count = 0 then
    raise exception 'PRE_REGISTRATION_NOT_FOUND';
  end if;
  if candidate_count > 1 then
    raise exception 'PRE_REGISTRATION_AMBIGUOUS';
  end if;

  select *
    into employee_row
    from public.employees e
   where e.id=candidate_id
   for update;

  if employee_row.profile_id is not null and employee_row.profile_id <> current_user_id then
    raise exception 'PRE_REGISTRATION_ALREADY_LINKED';
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
         status='active',
         terms_accepted_at=coalesce(terms_accepted_at,now()),
         onboarded_at=coalesce(onboarded_at,now()),
         updated_at=now()
   where id=current_user_id;

  insert into public.user_roles(user_id,role_id)
  select current_user_id,r.id
    from public.roles r
   where r.code='COLLABORATOR' and r.active and not r.archived
  on conflict do nothing;

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
      'class_id',default_class.id
    )
  );
end;
$$;

create or replace function public.complete_profile(payload jsonb)
returns void
language sql
set search_path = ''
as $$
  select private.complete_profile(payload)
$$;

revoke all on function public.complete_profile(jsonb) from public, anon;
grant execute on function public.complete_profile(jsonb) to authenticated;
grant execute on function private.complete_profile(jsonb) to authenticated;

create or replace function private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  department_value uuid;
  class_name text;
begin
  begin
    if coalesce(new.raw_user_meta_data->>'requested_department_id','') ~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then
      department_value := (new.raw_user_meta_data->>'requested_department_id')::uuid;
    end if;
  exception when others then
    department_value := null;
  end;

  select c.name into class_name
    from public.classes c
   where c.active
   order by c.created_at
   limit 1;

  insert into public.profiles(
    id,full_name,email,phone,requested_class,requested_department_id
  )
  values(
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Novo cadastro'),160),
    lower(new.email),
    left(nullif(trim(new.raw_user_meta_data->>'phone'),''),30),
    class_name,
    department_value
  );

  return new;
end;
$$;
