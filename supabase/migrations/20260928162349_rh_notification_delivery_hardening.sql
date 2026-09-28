
alter table public.notifications
  add column if not exists event_type text not null default 'general',
  add column if not exists event_key text;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.notifications'::regclass
      and conname='notifications_event_type_check'
  ) then
    alter table public.notifications
      add constraint notifications_event_type_check
      check (
        length(event_type) between 2 and 80
        and event_type ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      ) not valid;
    alter table public.notifications
      validate constraint notifications_event_type_check;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.notifications'::regclass
      and conname='notifications_event_key_length_check'
  ) then
    alter table public.notifications
      add constraint notifications_event_key_length_check
      check (event_key is null or length(event_key) between 3 and 240) not valid;
    alter table public.notifications
      validate constraint notifications_event_key_length_check;
  end if;
end
$block$;

create unique index if not exists notifications_scope_event_key_unique
  on public.notifications(scope,event_key)
  where event_key is not null;

create table if not exists private.notification_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('push','email')),
  status text not null default 'pending'
    check (status in ('pending','processing','sent','skipped','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_id text,
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(notification_id,channel)
);

alter table private.notification_deliveries enable row level security;
revoke all on private.notification_deliveries from public, anon, authenticated;

create index if not exists notification_deliveries_status_updated
  on private.notification_deliveries(status,updated_at);

create or replace function public.claim_notification_delivery(
  notification_identifier uuid,
  delivery_channel text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  claimed boolean := false;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if delivery_channel not in ('push','email') then
    raise exception 'INVALID_CHANNEL';
  end if;

  if not exists (
    select 1
    from public.notifications n
    where n.id=notification_identifier
      and n.scope='rh'
  ) then
    return false;
  end if;

  insert into private.notification_deliveries as d(
    notification_id,channel,status,attempts,created_at,updated_at
  )
  values(
    notification_identifier,delivery_channel,'processing',1,now(),now()
  )
  on conflict(notification_id,channel)
  do update
     set status='processing',
         attempts=d.attempts+1,
         last_error_code=null,
         updated_at=now()
   where d.status in ('pending','failed')
      or (d.status='processing' and d.updated_at < now()-interval '10 minutes')
  returning true into claimed;

  return coalesce(claimed,false);
end
$function$;

revoke all on function public.claim_notification_delivery(uuid,text)
  from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(uuid,text)
  to service_role;

create or replace function public.complete_notification_delivery(
  notification_identifier uuid,
  delivery_channel text,
  delivery_status text,
  provider_identifier text default null,
  error_code text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if delivery_channel not in ('push','email') then
    raise exception 'INVALID_CHANNEL';
  end if;

  if delivery_status not in ('sent','skipped','failed') then
    raise exception 'INVALID_DELIVERY_STATUS';
  end if;

  update private.notification_deliveries
     set status=delivery_status,
         provider_id=left(nullif(provider_identifier,''),200),
         last_error_code=left(nullif(error_code,''),120),
         sent_at=case when delivery_status='sent' then now() else sent_at end,
         updated_at=now()
   where notification_id=notification_identifier
     and channel=delivery_channel;
end
$function$;

revoke all on function public.complete_notification_delivery(uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.complete_notification_delivery(uuid,text,text,text,text)
  to service_role;

create or replace function private.rh_emit_employee_event(
  employee_identifier uuid,
  event_type_value text,
  event_key_value text,
  notification_title text,
  notification_body text,
  notification_path text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  target_profile uuid;
  display_name text;
  result_id uuid;
begin
  select e.profile_id, coalesce(nullif(trim(e.social_name),''),e.full_name)
    into target_profile,display_name
    from public.employees e
   where e.id=employee_identifier;

  if target_profile is null then return null; end if;

  insert into public.notifications(
    user_id,title,body,path,scope,event_type,event_key
  )
  values(
    target_profile,
    left(trim(notification_title),120),
    left(format('%s, %s',split_part(trim(display_name),' ',1),trim(notification_body)),800),
    left(coalesce(nullif(trim(notification_path),''),'/'),300),
    'rh',
    left(lower(trim(event_type_value)),80),
    left(nullif(trim(event_key_value),''),240)
  )
  on conflict(scope,event_key) where event_key is not null
  do nothing
  returning id into result_id;

  if result_id is null and nullif(trim(event_key_value),'') is not null then
    select n.id into result_id
      from public.notifications n
     where n.scope='rh'
       and n.event_key=left(trim(event_key_value),240)
     limit 1;
  end if;

  return result_id;
end
$function$;

revoke all on function private.rh_emit_employee_event(uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function private.rh_emit_employee_event(uuid,text,text,text,text,text)
  to postgres, service_role;

create or replace function private.rh_emit_profile_event(
  profile_identifier uuid,
  event_type_value text,
  event_key_value text,
  notification_title text,
  notification_body text,
  notification_path text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  display_name text;
  result_id uuid;
begin
  select p.full_name into display_name
    from public.profiles p
   where p.id=profile_identifier;

  if display_name is null then return null; end if;

  insert into public.notifications(
    user_id,title,body,path,scope,event_type,event_key
  )
  values(
    profile_identifier,
    left(trim(notification_title),120),
    left(format('%s, %s',split_part(trim(display_name),' ',1),trim(notification_body)),800),
    left(coalesce(nullif(trim(notification_path),''),'/'),300),
    'rh',
    left(lower(trim(event_type_value)),80),
    left(nullif(trim(event_key_value),''),240)
  )
  on conflict(scope,event_key) where event_key is not null
  do nothing
  returning id into result_id;

  if result_id is null and nullif(trim(event_key_value),'') is not null then
    select n.id into result_id
      from public.notifications n
     where n.scope='rh'
       and n.event_key=left(trim(event_key_value),240)
     limit 1;
  end if;

  return result_id;
end
$function$;

revoke all on function private.rh_emit_profile_event(uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function private.rh_emit_profile_event(uuid,text,text,text,text,text)
  to postgres, service_role;

create or replace function private.rh_notify_attendance_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  session_day date;
  status_label text;
  title_value text;
begin
  if row(new.status,new.actual_arrival,new.actual_departure,new.delay_minutes,new.early_minutes)
     is not distinct from
     row(old.status,old.actual_arrival,old.actual_departure,old.delay_minutes,old.early_minutes)
     or new.status='pending'
  then
    return new;
  end if;

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
    when 'early_exit' then 'Saída antecipada registrada'
    when 'occurrence' then 'Ocorrência registrada'
    else 'Presença atualizada'
  end;

  perform private.rh_emit_employee_event(
    new.employee_id,
    'attendance.'||lower(new.status),
    format('attendance:%s:v%s',new.id,new.version),
    title_value,
    format(
      'seu registro de %s foi atualizado para %s%s.',
      coalesce(to_char(session_day,'DD/MM/YYYY'),'presença'),
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
$function$;

drop trigger if exists rh_notify_attendance_change on public.attendance_members;
create trigger rh_notify_attendance_change
after update of status,actual_arrival,actual_departure,delay_minutes,early_minutes
on public.attendance_members
for each row execute function private.rh_notify_attendance_change();

create or replace function private.rh_notify_performance_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  cycle_title text;
  title_value text;
  event_type_value text;
begin
  if not new.released then return new; end if;
  if tg_op='UPDATE' and new is not distinct from old then return new; end if;

  select title into cycle_title
    from public.performance_cycles
   where id=new.cycle_id;

  if tg_op='INSERT' or (tg_op='UPDATE' and not old.released and new.released) then
    title_value := 'Notas liberadas';
    event_type_value := 'performance.released';
  else
    title_value := 'Notas atualizadas';
    event_type_value := 'performance.updated';
  end if;

  perform private.rh_emit_employee_event(
    new.employee_id,
    event_type_value,
    format('performance:%s:v%s',new.id,new.version),
    title_value,
    format(
      'seu boletim do período %s recebeu uma atualização. Abra o boletim para conferir notas, pesos e média.',
      coalesce(cycle_title,'atual')
    ),
    '/notas'
  );

  return new;
end
$function$;

create or replace function private.rh_notify_employee_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.profile_id is null then return new; end if;

  if (
    to_jsonb(new) - 'profile_id' - 'updated_at' - 'version'
  ) is distinct from (
    to_jsonb(old) - 'profile_id' - 'updated_at' - 'version'
  ) then
    perform private.rh_emit_employee_event(
      new.id,
      'employee.updated',
      format('employee:%s:v%s',new.id,new.version),
      'Seu cadastro foi atualizado',
      'uma informação ligada ao seu cadastro no RH foi alterada.',
      '/colaboradores/'||new.id::text
    );
  end if;

  return new;
end
$function$;

create or replace function private.rh_notify_profile_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if (
    to_jsonb(new) - 'last_seen_at' - 'updated_at' - 'version'
  ) is distinct from (
    to_jsonb(old) - 'last_seen_at' - 'updated_at' - 'version'
  ) then
    perform private.rh_emit_profile_event(
      new.id,
      'profile.updated',
      format('profile:%s:v%s',new.id,new.version),
      'Seu perfil foi atualizado',
      'uma informação do seu perfil no RH foi alterada.',
      '/'
    );
  end if;

  return new;
end
$function$;

create or replace function private.rh_notify_feedback_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if old.released
     and new.released
     and row(new.title,new.kind,new.description,new.strengths,new.improvements,new.actions,new.due_date,new.status,new.allow_response)
         is distinct from
         row(old.title,old.kind,old.description,old.strengths,old.improvements,old.actions,old.due_date,old.status,old.allow_response)
  then
    perform private.rh_emit_employee_event(
      new.employee_id,
      'feedback.updated',
      format('feedback:%s:v%s',new.id,new.version),
      'Feedback atualizado',
      'um feedback que já estava disponível para você recebeu uma alteração.',
      '/feedbacks'
    );
  end if;

  return new;
end
$function$;

create or replace function private.rh_notify_feedback_followup()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
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

  perform private.rh_emit_employee_event(
    employee_identifier,
    'feedback.followup',
    format('feedback-followup:%s',new.id),
    'Nova resposta em feedback',
    'seu feedback recebeu uma nova resposta.',
    '/feedbacks'
  );

  return new;
end
$function$;

create or replace function private.rh_notify_justification_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.rh_emit_employee_event(
    new.employee_id,
    'justification.created',
    format('justification:%s:created',new.id),
    'Justificativa enviada',
    'sua justificativa foi registrada e está aguardando análise.',
    '/justificativas'
  );
  return new;
end
$function$;

create or replace function private.push_notification_after_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  hook_secret text;
  payload jsonb;
begin
  if new.scope is distinct from 'rh' then return new; end if;

  select ds.decrypted_secret into hook_secret
    from vault.decrypted_secrets ds
   where ds.name='raizes_push_webhook_secret'
   limit 1;

  if hook_secret is null then return new; end if;

  payload := jsonb_build_object(
    'notification',jsonb_build_object(
      'id',new.id,
      'user_id',new.user_id,
      'title',new.title,
      'body',new.body,
      'path',new.path,
      'scope',new.scope,
      'event_type',new.event_type,
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
$function$;
