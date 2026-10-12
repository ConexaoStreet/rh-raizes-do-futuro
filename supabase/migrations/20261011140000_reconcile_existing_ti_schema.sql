CREATE OR REPLACE FUNCTION private.instructor_employee_allowed(employee_identifier uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    not private.has_role('INSTRUCTOR')
    or exists(
      select 1
      from public.employees target
      where target.id=employee_identifier
        and target.status='active'
        and target.member_group='class'
        and target.class_id=private.current_employee_class()
    )
$function$
;
revoke all on function private.instructor_employee_allowed(uuid) from public,anon;
grant execute on function private.instructor_employee_allowed(uuid) to authenticated;

alter table public.employees add column if not exists access_role_code text not null default 'COLLABORATOR';
alter table public.profiles add column if not exists requested_role_code text;
alter table public.profiles add column if not exists espro_photo_path text;
alter table public.profiles add column if not exists espro_photo_status text not null default 'missing';
alter table public.profiles add column if not exists espro_photo_verification jsonb not null default '{}';
alter table public.profiles add column if not exists espro_photo_submitted_at timestamptz;
alter table public.profiles add column if not exists espro_photo_reviewed_at timestamptz;
alter table public.profiles add column if not exists espro_photo_reviewed_by uuid;
alter table public.profiles add column if not exists espro_photo_rejection_reason text;

insert into public.permissions(code,name,module) values
('ti.users.manage','Gerenciar usuários pela Central T.I.','ti'),
('ti.storage.manage','Gerenciar arquivos e storage','ti'),
('ti.database.view','Visualizar diagnóstico do banco','ti'),
('ti.notifications.manage','Gerenciar notificações','ti'),
('ti.datasul.read','Consultar Datasul','ti'),
('ti.datasul.write','Alterar dados no Datasul','ti'),
('ti.datasul.delete','Excluir dados no Datasul','ti')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='TI_ADMIN' and p.code in ('ti.view','ti.manage','ti.users.manage','ti.storage.manage','ti.database.view','ti.notifications.manage','ti.datasul.read','ti.datasul.write','ti.datasul.delete','ti.datasul.sync','ti.deploy.manage','ti.security.view','attendance.manage','attendance.view','audit.security','audit.view','calendar.manage','chat.moderate','chat.use','dashboard.view','employee.manage','employee.view','feedback.manage','feedback.view','files.manage','justification.manage','justification.view','performance.manage','performance.view','report.export','report.view','role.manage','settings.manage','user.manage','user.view','workspace.instructor','workspace.overview','workspace.view')) or (r.code='SUPER_ADMIN' and p.code in ('ti.view','ti.manage','ti.users.manage','ti.storage.manage','ti.database.view','ti.notifications.manage','ti.datasul.read','ti.datasul.write','ti.datasul.delete','ti.datasul.sync','ti.deploy.manage','ti.security.view'))
on conflict do nothing;

CREATE OR REPLACE FUNCTION private.save_entity(entity text, payload jsonb, expected_version integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  allowed text[];
  permission_code text;
  identifier uuid=(payload->>'id')::uuid;
  previous jsonb;
  fields text;
  values_sql text;
  updates_sql text;
  key_name text;
  employee_identifier uuid;
begin
  case entity
    when 'employees' then
      permission_code='employee.manage';
      allowed=array[
        'full_name','social_name','email','phone','registration','join_date',
        'class_id','department_id','job_position_id','manager_id',
        'expected_arrival','expected_departure','status','photo_path',
        'member_group','access_role_code'
      ];
    when 'employee_admin_notes' then
      permission_code='employee.manage';
      allowed=array['employee_id','notes'];
    when 'classes' then
      permission_code='settings.manage';
      allowed=array['name','code','active'];
    when 'departments' then
      permission_code='settings.manage';
      allowed=array['name','active'];
    when 'job_positions' then
      permission_code='settings.manage';
      allowed=array['name','description','active'];
    when 'managers' then
      permission_code='system.manage';
      allowed=array['full_name','profile_id','active'];
    when 'course_calendar' then
      permission_code='calendar.manage';
      allowed=array['class_id','scheduled_date','has_course','kind','reason'];
    when 'events' then
      permission_code='calendar.manage';
      allowed=array['title','event_date','class_id','description','status'];
    when 'feedbacks' then
      permission_code='feedback.manage';
      allowed=array[
        'employee_id','title','kind','description','strengths','improvements',
        'actions','due_date','status','released','allow_response'
      ];
    when 'performance_cycles' then
      permission_code='performance.manage';
      allowed=array['title','start_date','end_date','status'];
    when 'performance_criteria' then
      permission_code='settings.manage';
      allowed=array['name','weight','active'];
    when 'manager_review_criteria' then
      permission_code='review.manage';
      allowed=array['name','active'];
    when 'justification_categories' then
      permission_code='settings.manage';
      allowed=array['name','active'];
    when 'settings' then
      permission_code='settings.manage';
      allowed=array['key','value'];
    else
      raise exception 'FORBIDDEN';
  end case;

  perform private.require_permission(permission_code);

  if entity='settings' then
    if payload->>'key'='maintenance' then perform private.require_permission('system.manage'); end if;
    if payload->>'key' not in ('maintenance','general','lateness') then raise exception 'FORBIDDEN'; end if;
    if payload->>'key'='lateness'
       and (
         coalesce((payload->'value'->>'light')::int,-1)<0
         or coalesce((payload->'value'->>'moderate')::int,-1)<(payload->'value'->>'light')::int
       )
    then
      raise exception 'INVALID_TRANSITION';
    end if;
  end if;

  if entity='employees' and identifier is not null and payload ? 'profile_id' then
    raise exception 'FORBIDDEN';
  end if;

  if entity='employees' and payload ? 'access_role_code'
     and upper(coalesce(payload->>'access_role_code','')) not in ('COLLABORATOR','MANAGER','DIRECTOR','INSTRUCTOR')
  then
    raise exception 'INVALID_ROLE';
  end if;

  if entity='feedbacks' and private.has_role('INSTRUCTOR') then
    employee_identifier=(payload->>'employee_id')::uuid;
    if not private.instructor_employee_allowed(employee_identifier) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  if identifier is not null then
    execute format('select to_jsonb(t) from public.%I t where id=$1 for update',entity)
    into previous
    using identifier;

    if previous is null or (previous->>'version')::integer is distinct from expected_version then
      raise exception 'CONFLICT';
    end if;

    if entity='settings' and previous->>'key' is distinct from payload->>'key' then
      raise exception 'FORBIDDEN';
    end if;

    if entity='feedbacks' and previous->>'employee_id' is distinct from payload->>'employee_id' then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  foreach key_name in array array(select jsonb_object_keys(payload)) loop
    if key_name<>'id' and not(key_name=any(allowed)) then
      raise exception 'FORBIDDEN';
    end if;
  end loop;

  select
    string_agg(format('%I',key),','),
    string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',entity,key),','),
    string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,entity,key),',')
  into fields,values_sql,updates_sql
  from jsonb_object_keys(payload) key
  where key=any(allowed);

  if fields is null then raise exception 'INVALID_TRANSITION'; end if;

  if identifier is null then
    execute format('insert into public.%I(%s) select %s returning id',entity,fields,values_sql)
    into identifier
    using payload;
  else
    execute format('update public.%I set %s where id=$2',entity,updates_sql)
    using payload,identifier;
  end if;

  if entity='feedbacks'
     and coalesce((payload->>'released')::boolean,false)
     and (previous is null or not coalesce((previous->>'released')::boolean,false))
  then
    employee_identifier=(payload->>'employee_id')::uuid;
    insert into public.notifications(user_id,title,path)
    select profile_id,'Novo feedback','/feedbacks'
    from public.employees
    where id=employee_identifier and profile_id is not null;
  end if;

  return identifier;
end;
$function$;

CREATE OR REPLACE FUNCTION private.ti_database_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.can('ti.database.view') then raise exception 'FORBIDDEN'; end if;

  return jsonb_build_object(
    'tables',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'schema',s.schemaname,
        'table',s.relname,
        'estimated_rows',s.n_live_tup,
        'dead_rows',s.n_dead_tup,
        'last_analyze',s.last_analyze,
        'last_autoanalyze',s.last_autoanalyze,
        'size_bytes',pg_total_relation_size(format('%I.%I',s.schemaname,s.relname)::regclass)
      ) order by pg_total_relation_size(format('%I.%I',s.schemaname,s.relname)::regclass) desc),'[]'::jsonb)
      from pg_stat_user_tables s
      where s.schemaname in ('public','private')
    ),
    'rls',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'schema',n.nspname,
        'table',c.relname,
        'enabled',c.relrowsecurity,
        'forced',c.relforcerowsecurity
      ) order by n.nspname,c.relname),'[]'::jsonb)
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r'
        and n.nspname in ('public','private')
    ),
    'extensions',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'name',e.extname,
        'schema',n.nspname,
        'version',e.extversion
      ) order by e.extname),'[]'::jsonb)
      from pg_extension e
      join pg_namespace n on n.oid=e.extnamespace
    ),
    'database_size_bytes',pg_database_size(current_database()),
    'connections',(
      select count(*) from pg_stat_activity where datname=current_database()
    ),
    'server_time',now()
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.ti_review_espro_photo(target_profile uuid, review_status text, review_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  before_row jsonb;
  after_row jsonb;
begin
  if not private.can('ti.users.manage') then raise exception 'FORBIDDEN'; end if;
  perform private.require_recent_verification(15);

  if review_status not in ('approved','rejected') then raise exception 'INVALID_STATUS'; end if;
  if review_status='rejected' and length(trim(coalesce(review_reason,'')))<3
    then raise exception 'REASON_REQUIRED'; end if;

  select to_jsonb(p) into before_row
  from public.profiles p
  where p.id=target_profile
  for update;

  if before_row is null then raise exception 'INVALID_USER'; end if;

  update public.profiles
  set espro_photo_status=review_status,
      espro_photo_reviewed_at=now(),
      espro_photo_reviewed_by=auth.uid(),
      espro_photo_rejection_reason=case when review_status='rejected' then left(trim(review_reason),500) else null end,
      updated_at=now()
  where id=target_profile;

  select to_jsonb(p) into after_row
  from public.profiles p where p.id=target_profile;

  perform private.log(
    'ti_review_espro_photo','profiles',target_profile,before_row,after_row,
    'data_change',jsonb_build_object('review_status',review_status)
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.ti_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.can('ti.view') then raise exception 'FORBIDDEN'; end if;

  return jsonb_build_object(
    'profiles_total',(select count(*) from public.profiles),
    'profiles_active',(select count(*) from public.profiles where status='active'),
    'employees_total',(select count(*) from public.employees),
    'employees_active',(select count(*) from public.employees where status='active'),
    'auth_sessions',(select count(*) from auth.sessions),
    'push_devices',(select count(*) from public.push_subscriptions),
    'notifications_unread',(select count(*) from public.notifications where read_at is null),
    'audit_24h',(select count(*) from public.audit_logs where created_at >= now()-interval '24 hours'),
    'feedbacks',(select count(*) from public.feedbacks),
    'attendance_sessions',(select count(*) from public.attendance_sessions),
    'storage_objects',(select count(*) from storage.objects),
    'photo_status',(
      select coalesce(jsonb_object_agg(status,total),'{}'::jsonb)
      from (
        select espro_photo_status as status,count(*) as total
        from public.profiles
        group by espro_photo_status
      ) q
    ),
    'roles',(
      select coalesce(jsonb_object_agg(code,total),'{}'::jsonb)
      from (
        select r.code,count(ur.user_id) as total
        from public.roles r
        left join public.user_roles ur on ur.role_id=r.id
        where r.active and not r.archived
        group by r.code
      ) q
    ),
    'datasul_operations_24h',(select count(*) from public.ti_datasul_operations where created_at >= now()-interval '24 hours'),
    'datasul_failures_24h',(select count(*) from public.ti_datasul_operations where created_at >= now()-interval '24 hours' and not success),
    'server_time',now()
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.ti_database_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.ti_database_snapshot() $function$;

CREATE OR REPLACE FUNCTION public.ti_review_espro_photo(target_profile uuid, review_status text, review_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.ti_review_espro_photo(target_profile,review_status,review_reason) $function$;

CREATE OR REPLACE FUNCTION public.ti_send_notification(target_user uuid, notification_title text, notification_body text, notification_path text DEFAULT '/'::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.ti_send_notification(target_user,notification_title,notification_body,notification_path) $function$;

CREATE OR REPLACE FUNCTION public.ti_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.ti_snapshot() $function$;

revoke all on function private.ti_snapshot(),public.ti_snapshot(),private.ti_database_snapshot(),public.ti_database_snapshot(),private.ti_review_espro_photo(uuid,text,text),public.ti_review_espro_photo(uuid,text,text),public.ti_send_notification(uuid,text,text,text) from public,anon;
grant execute on function private.ti_snapshot(),public.ti_snapshot(),private.ti_database_snapshot(),public.ti_database_snapshot(),private.ti_review_espro_photo(uuid,text,text),public.ti_review_espro_photo(uuid,text,text),private.ti_send_notification(uuid,text,text,text),public.ti_send_notification(uuid,text,text,text) to authenticated;
