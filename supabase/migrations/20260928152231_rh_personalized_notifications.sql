alter table public.notifications
  add column if not exists scope text not null default 'rh';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_scope_check'
  ) then
    alter table public.notifications
      add constraint notifications_scope_check
      check (scope in ('rh','ti','system')) not valid;
    alter table public.notifications
      validate constraint notifications_scope_check;
  end if;
end
$$;

create index if not exists notification_owner_scope
  on public.notifications(user_id, scope, created_at desc);

create or replace function private.rh_notify_employee(
  employee_identifier uuid,
  notification_title text,
  notification_body text,
  notification_path text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  target_profile uuid;
  display_name text;
  result_id uuid;
begin
  select e.profile_id, coalesce(nullif(trim(e.social_name),''), e.full_name)
    into target_profile, display_name
    from public.employees e
   where e.id=employee_identifier;

  if target_profile is null then return null; end if;

  insert into public.notifications(user_id,title,body,path,scope)
  values(
    target_profile,
    left(trim(notification_title),120),
    left(format('%s, %s', split_part(trim(display_name),' ',1), trim(notification_body)),800),
    left(coalesce(nullif(trim(notification_path),''),'/'),300),
    'rh'
  )
  returning id into result_id;

  return result_id;
end
$$;

revoke all on function private.rh_notify_employee(uuid,text,text,text) from public, anon, authenticated;
grant execute on function private.rh_notify_employee(uuid,text,text,text) to postgres, service_role;

create or replace function private.rh_notify_profile(
  profile_identifier uuid,
  notification_title text,
  notification_body text,
  notification_path text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  display_name text;
  result_id uuid;
begin
  select p.full_name into display_name
    from public.profiles p
   where p.id=profile_identifier;

  if display_name is null then return null; end if;

  insert into public.notifications(user_id,title,body,path,scope)
  values(
    profile_identifier,
    left(trim(notification_title),120),
    left(format('%s, %s', split_part(trim(display_name),' ',1), trim(notification_body)),800),
    left(coalesce(nullif(trim(notification_path),''),'/'),300),
    'rh'
  )
  returning id into result_id;

  return result_id;
end
$$;

revoke all on function private.rh_notify_profile(uuid,text,text,text) from public, anon, authenticated;
grant execute on function private.rh_notify_profile(uuid,text,text,text) to postgres, service_role;

create or replace function private.rh_notify_attendance_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  session_day date;
  status_label text;
  title_value text;
begin
  if new.status is not distinct from old.status or new.status='pending' then return new; end if;

  select scheduled_date into session_day
    from public.attendance_sessions
   where id=new.session_id;

  status_label := case new.status
    when 'present' then 'presença'
    when 'late' then 'atraso'
    when 'absent' then 'falta'
    when 'justified' then 'falta justificada'
    when 'early_exit' then 'saída antecipada'
    when 'occurrence' then 'ocorrência'
    else new.status
  end;

  title_value := case new.status
    when 'absent' then 'Falta registrada'
    when 'late' then 'Atraso registrado'
    when 'present' then 'Presença registrada'
    when 'justified' then 'Falta justificada'
    else 'Presença atualizada'
  end;

  perform private.rh_notify_employee(
    new.employee_id,
    title_value,
    format(
      'seu registro de %s foi atualizado para %s%s.',
      to_char(session_day,'DD/MM/YYYY'),
      status_label,
      case when coalesce(new.delay_minutes,0)>0
        then format(' (%s min)',new.delay_minutes)
        else ''
      end
    ),
    '/presenca'
  );

  return new;
end
$$;

drop trigger if exists rh_notify_attendance_change on public.attendance_members;
create trigger rh_notify_attendance_change
after update of status,actual_arrival,actual_departure on public.attendance_members
for each row execute function private.rh_notify_attendance_change();

create or replace function private.rh_notify_performance_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  cycle_title text;
  title_value text;
begin
  if not new.released then return new; end if;

  if tg_op='UPDATE' and new is not distinct from old then return new; end if;

  select title into cycle_title
    from public.performance_cycles
   where id=new.cycle_id;

  title_value := case
    when tg_op='INSERT' then 'Notas liberadas'
    when old.released=false and new.released=true then 'Notas liberadas'
    else 'Notas atualizadas'
  end;

  perform private.rh_notify_employee(
    new.employee_id,
    title_value,
    format(
      'seu boletim do período %s recebeu uma atualização. Abra o boletim para conferir notas, pesos e média.',
      coalesce(cycle_title,'atual')
    ),
    '/notas'
  );

  return new;
end
$$;

drop trigger if exists rh_notify_performance_change on public.performance_reviews;
create trigger rh_notify_performance_change
after insert or update on public.performance_reviews
for each row execute function private.rh_notify_performance_change();

create or replace function private.rh_notify_employee_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.profile_id is null then return new; end if;

  if row(
    new.full_name,new.social_name,new.email,new.phone,new.registration,new.class_id,
    new.department_id,new.job_position_id,new.manager_id,new.expected_arrival,
    new.expected_departure,new.status,new.photo_path,new.member_group,new.access_role_code
  ) is distinct from row(
    old.full_name,old.social_name,old.email,old.phone,old.registration,old.class_id,
    old.department_id,old.job_position_id,old.manager_id,old.expected_arrival,
    old.expected_departure,old.status,old.photo_path,old.member_group,old.access_role_code
  ) then
    perform private.rh_notify_employee(
      new.id,
      'Seu cadastro foi atualizado',
      'uma informação ligada ao seu cadastro no RH foi alterada.',
      '/colaboradores/'||new.id::text
    );
  end if;

  return new;
end
$$;

drop trigger if exists rh_notify_employee_change on public.employees;
create trigger rh_notify_employee_change
after update on public.employees
for each row execute function private.rh_notify_employee_change();

create or replace function private.rh_notify_profile_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if (
    to_jsonb(new) - 'last_seen_at' - 'updated_at' - 'version'
  ) is distinct from (
    to_jsonb(old) - 'last_seen_at' - 'updated_at' - 'version'
  ) then
    perform private.rh_notify_profile(
      new.id,
      'Seu perfil foi atualizado',
      'uma informação do seu perfil no RH foi alterada.',
      '/'
    );
  end if;

  return new;
end
$$;

drop trigger if exists rh_notify_profile_change on public.profiles;
create trigger rh_notify_profile_change
after update on public.profiles
for each row execute function private.rh_notify_profile_change();

create or replace function private.rh_notify_feedback_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.released
     and new.released
     and row(new.title,new.kind,new.description,new.strengths,new.improvements,new.actions,new.due_date,new.status,new.allow_response)
         is distinct from
         row(old.title,old.kind,old.description,old.strengths,old.improvements,old.actions,old.due_date,old.status,old.allow_response)
  then
    perform private.rh_notify_employee(
      new.employee_id,
      'Feedback atualizado',
      'um feedback que já estava disponível para você recebeu uma alteração.',
      '/feedbacks'
    );
  end if;

  return new;
end
$$;

drop trigger if exists rh_notify_feedback_change on public.feedbacks;
create trigger rh_notify_feedback_change
after update on public.feedbacks
for each row execute function private.rh_notify_feedback_change();

create or replace function private.rh_notify_feedback_followup()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  employee_identifier uuid;
  employee_profile uuid;
begin
  select f.employee_id,e.profile_id
    into employee_identifier,employee_profile
    from public.feedbacks f
    join public.employees e on e.id=f.employee_id
   where f.id=new.feedback_id
     and f.released;

  if employee_identifier is null or employee_profile is null or new.author_id=employee_profile then
    return new;
  end if;

  perform private.rh_notify_employee(
    employee_identifier,
    'Nova resposta em feedback',
    'seu feedback recebeu uma nova resposta.',
    '/feedbacks'
  );

  return new;
end
$$;

drop trigger if exists rh_notify_feedback_followup on public.feedback_followups;
create trigger rh_notify_feedback_followup
after insert on public.feedback_followups
for each row execute function private.rh_notify_feedback_followup();

create or replace function private.rh_notify_justification_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.rh_notify_employee(
    new.employee_id,
    'Justificativa enviada',
    'sua justificativa foi registrada e está aguardando análise.',
    '/justificativas'
  );
  return new;
end
$$;

drop trigger if exists rh_notify_justification_insert on public.absence_justifications;
create trigger rh_notify_justification_insert
after insert on public.absence_justifications
for each row execute function private.rh_notify_justification_insert();

create or replace function private.ti_send_notification(
  target_user uuid,
  notification_title text,
  notification_body text,
  notification_path text default '/'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  result_id uuid;
begin
  if not private.can('ti.notifications.manage') then raise exception 'FORBIDDEN'; end if;
  perform private.require_recent_verification(15);

  if target_user is null or not exists(
    select 1 from public.profiles p where p.id=target_user and p.status='active'
  ) then raise exception 'INVALID_USER'; end if;
  if length(trim(notification_title)) not between 2 and 100 then raise exception 'INVALID_TITLE'; end if;
  if length(trim(notification_body)) not between 2 and 500 then raise exception 'INVALID_BODY'; end if;

  insert into public.notifications(user_id,title,body,path,scope)
  values(
    target_user,
    left(trim(notification_title),100),
    left(trim(notification_body),500),
    left(coalesce(nullif(trim(notification_path),''),'/'),300),
    'ti'
  )
  returning id into result_id;

  perform private.log(
    'ti_notification_send','notifications',result_id,null,
    jsonb_build_object('user_id',target_user,'title',left(trim(notification_title),100)),
    'data_change',
    '{}'::jsonb
  );

  return result_id;
end
$$;

create or replace function private.push_notification_after_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  hook_secret text;
  payload jsonb;
begin
  if new.scope is distinct from 'rh' then return new; end if;

  select webhook_secret into hook_secret
    from public.push_config
   where id=1;

  if hook_secret is null then return new; end if;

  payload := jsonb_build_object(
    'notification',jsonb_build_object(
      'id',new.id,
      'user_id',new.user_id,
      'title',new.title,
      'body',new.body,
      'path',new.path,
      'scope',new.scope,
      'created_at',new.created_at
    )
  );

  perform net.http_post(
    url := 'https://fiuealmgufpmtgmxxpna.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-push-webhook-secret',hook_secret
    ),
    body := payload || jsonb_build_object('action','webhook'),
    timeout_milliseconds := 5000
  );

  perform net.http_post(
    url := 'https://fiuealmgufpmtgmxxpna.supabase.co/functions/v1/rh-notify',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-push-webhook-secret',hook_secret
    ),
    body := payload,
    timeout_milliseconds := 5000
  );

  return new;
end
$$;
