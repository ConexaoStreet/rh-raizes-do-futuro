create table if not exists public.manager_activation_invites (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  registration text not null unique,
  code_hash text not null check (char_length(code_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  locked_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  claimed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manager_activation_invites enable row level security;

revoke all on table public.manager_activation_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.manager_activation_invites to service_role;

create or replace function public.finalize_manager_activation(
  invite_identifier uuid,
  user_identifier uuid,
  email_value text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.manager_activation_invites;
  employee public.employees;
  manager_role_id uuid;
  class_label text;
begin
  select *
    into invitation
    from public.manager_activation_invites
   where id = invite_identifier
   for update;

  if invitation.id is null
     or invitation.used_at is not null
     or invitation.locked_at is null
     or invitation.expires_at <= now()
     or invitation.attempts >= invitation.max_attempts
  then
    raise exception 'INVALID_ACTIVATION';
  end if;

  select *
    into employee
    from public.employees
   where id = invitation.employee_id
     and registration = invitation.registration
   for update;

  if employee.id is null
     or employee.status <> 'active'
     or employee.profile_id is not null
  then
    raise exception 'INVALID_TRANSITION';
  end if;

  select id
    into manager_role_id
    from public.roles
   where code = 'MANAGER'
     and active
     and not archived;

  if manager_role_id is null then
    raise exception 'MANAGER_ROLE_UNAVAILABLE';
  end if;

  select coalesce(c.code, c.name, '')
    into class_label
    from public.classes c
   where c.id = employee.class_id;

  update public.profiles
     set full_name = employee.full_name,
         email = lower(trim(email_value)),
         registration = employee.registration,
         requested_class = nullif(class_label, ''),
         status = 'active',
         onboarded_at = coalesce(onboarded_at, now()),
         terms_accepted_at = coalesce(terms_accepted_at, now())
   where id = user_identifier;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  update public.employees
     set profile_id = user_identifier,
         email = lower(trim(email_value))
   where id = employee.id
     and profile_id is null;

  if not found then
    raise exception 'INVALID_TRANSITION';
  end if;

  delete from public.user_roles where user_id = user_identifier;
  insert into public.user_roles(user_id, role_id)
  values (user_identifier, manager_role_id);

  update public.manager_activation_invites
     set used_at = now(),
         locked_at = null,
         claimed_by = user_identifier,
         updated_at = now()
   where id = invitation.id;

  insert into public.audit_logs(
    event_type,
    severity,
    actor_user_id,
    actor_name,
    actor_roles,
    action,
    module,
    entity_id,
    context,
    success
  )
  values (
    'security',
    'info',
    user_identifier,
    employee.full_name,
    array['MANAGER'],
    'manager_activation',
    'auth',
    user_identifier,
    jsonb_build_object(
      'employee_id', employee.id,
      'registration', employee.registration,
      'first_access', true
    ),
    true
  );
end
$$;

revoke all on function public.finalize_manager_activation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_manager_activation(uuid, uuid, text) to service_role;
