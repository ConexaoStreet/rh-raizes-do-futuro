-- Security hardening: break attendance RLS recursion and reconcile Datasul audit table.
-- Keeps RLS enabled and narrows grants; no authorization bypass is exposed to clients.

create or replace function private.attendance_session_owned_by_current_user(
  session_identifier uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select private.account_ready()
    and exists (
      select 1
      from public.attendance_members m
      where m.session_id = session_identifier
        and private.owns_employee(m.employee_id)
    )
$function$;

revoke all on function private.attendance_session_owned_by_current_user(uuid)
  from public, anon, authenticated;
grant execute on function private.attendance_session_owned_by_current_user(uuid)
  to authenticated;

drop policy if exists attendance_sessions_read
  on public.attendance_sessions;

create policy attendance_sessions_read
on public.attendance_sessions
for select
to authenticated
using (
  (
    private.has_role('INSTRUCTOR')
    and class_id = private.current_employee_class()
  )
  or (
    not private.has_role('INSTRUCTOR')
    and (select private.can('attendance.view'))
  )
  or private.attendance_session_owned_by_current_user(attendance_sessions.id)
);

create table if not exists public.ti_datasul_operations (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  method text not null
    check (method in ('GET','POST','PUT','PATCH','DELETE')),
  path text not null,
  request_body jsonb,
  response_status integer,
  response_preview jsonb,
  success boolean not null default false,
  duration_ms integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ti_datasul_operations_actor_idx
  on public.ti_datasul_operations(actor_user_id);
create index if not exists ti_datasul_operations_created_at_idx
  on public.ti_datasul_operations(created_at desc);

alter table public.ti_datasul_operations enable row level security;

drop policy if exists ti_datasul_operations_read
  on public.ti_datasul_operations;

create policy ti_datasul_operations_read
on public.ti_datasul_operations
for select
to authenticated
using (public.has_permission('ti.view'));

revoke all on table public.ti_datasul_operations from anon;
revoke all on table public.ti_datasul_operations from authenticated;
grant select on table public.ti_datasul_operations to authenticated;
grant select, insert on table public.ti_datasul_operations to service_role;
