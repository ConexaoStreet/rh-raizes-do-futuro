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


create table if not exists private.edge_rate_limits (
  scope text not null,
  fingerprint_hash text not null,
  bucket_start timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, fingerprint_hash, bucket_start)
);

alter table private.edge_rate_limits enable row level security;
revoke all on table private.edge_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table private.edge_rate_limits to service_role;

create or replace function public.consume_edge_rate_limit(
  rate_scope text,
  fingerprint_hash text,
  max_attempts integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  bucket timestamptz;
  next_attempts integer;
begin
  if current_user <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if length(coalesce(rate_scope,'')) < 3
     or length(coalesce(fingerprint_hash,'')) < 32
     or max_attempts < 1
     or max_attempts > 1000
     or window_seconds < 10
     or window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into private.edge_rate_limits(
    scope, fingerprint_hash, bucket_start, attempts, updated_at
  )
  values(rate_scope, fingerprint_hash, bucket, 1, now())
  on conflict(scope, fingerprint_hash, bucket_start)
  do update
  set attempts=private.edge_rate_limits.attempts+1,
      updated_at=now()
  returning attempts into next_attempts;

  delete from private.edge_rate_limits
  where updated_at < now() - interval '2 days';

  return next_attempts <= max_attempts;
end
$function$;

revoke all on function public.consume_edge_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text,text,integer,integer)
  to service_role;
