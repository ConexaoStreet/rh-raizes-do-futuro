alter table public.employees
  add column member_group text not null default 'class'
  constraint employees_member_group_check check (member_group in ('rh','class'));

create index employees_member_group_status
  on public.employees(member_group,status);

CREATE OR REPLACE FUNCTION private.save_entity(entity text, payload jsonb, expected_version integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 declare allowed text[]; permission_code text; identifier uuid=(payload->>'id')::uuid; previous jsonb; fields text; values_sql text; updates_sql text; key_name text; employee_identifier uuid;
 begin
 case entity
 when 'employees' then permission_code='employee.manage'; allowed=array['full_name','social_name','email','phone','registration','join_date','class_id','department_id','job_position_id','manager_id','expected_arrival','expected_departure','status','photo_path','member_group'];
 when 'employee_admin_notes' then permission_code='employee.manage'; allowed=array['employee_id','notes'];
 when 'classes' then permission_code='settings.manage'; allowed=array['name','code','active'];
 when 'departments' then permission_code='settings.manage'; allowed=array['name','active'];
 when 'job_positions' then permission_code='settings.manage'; allowed=array['name','description','active'];
 when 'managers' then permission_code='system.manage'; allowed=array['full_name','profile_id','active'];
 when 'course_calendar' then permission_code='calendar.manage'; allowed=array['class_id','scheduled_date','has_course','kind','reason'];
 when 'events' then permission_code='calendar.manage'; allowed=array['title','event_date','class_id','description','status'];
 when 'feedbacks' then permission_code='feedback.manage'; allowed=array['employee_id','title','kind','description','strengths','improvements','actions','due_date','status','released','allow_response'];
 when 'performance_cycles' then permission_code='performance.manage'; allowed=array['title','start_date','end_date','status'];
 when 'performance_criteria' then permission_code='settings.manage'; allowed=array['name','weight','active'];
 when 'manager_review_criteria' then permission_code='review.manage'; allowed=array['name','active'];
 when 'justification_categories' then permission_code='settings.manage'; allowed=array['name','active'];
 when 'settings' then permission_code='settings.manage'; allowed=array['key','value'];
 else raise exception 'FORBIDDEN'; end case;
 perform private.require_permission(permission_code);
 if entity='settings' then
 if payload->>'key'='maintenance' then perform private.require_permission('system.manage'); end if;
 if payload->>'key' not in ('maintenance','general','lateness') then raise exception 'FORBIDDEN'; end if;
 if payload->>'key'='lateness' and (coalesce((payload->'value'->>'light')::int,-1)<0 or coalesce((payload->'value'->>'moderate')::int,-1)<(payload->'value'->>'light')::int) then raise exception 'INVALID_TRANSITION'; end if;
 end if;
 if entity='employees' and identifier is not null and payload ? 'profile_id' then raise exception 'FORBIDDEN'; end if;
 if identifier is not null then
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',entity) into previous using identifier;
 if previous is null or (previous->>'version')::integer is distinct from expected_version then raise exception 'CONFLICT'; end if;
 if entity='settings' and previous->>'key' is distinct from payload->>'key' then raise exception 'FORBIDDEN'; end if;
 if entity='feedbacks' and previous->>'employee_id' is distinct from payload->>'employee_id' then raise exception 'FORBIDDEN'; end if;
 end if;
 foreach key_name in array array(select jsonb_object_keys(payload)) loop if key_name <> 'id' and not(key_name=any(allowed)) then raise exception 'FORBIDDEN'; end if; end loop;
 select string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',entity,key),','),string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,entity,key),',') into fields,values_sql,updates_sql from jsonb_object_keys(payload) key where key=any(allowed);
 if fields is null then raise exception 'INVALID_TRANSITION'; end if;
 if identifier is null then execute format('insert into public.%I(%s) select %s returning id',entity,fields,values_sql) into identifier using payload;
 else execute format('update public.%I set %s where id=$2',entity,updates_sql) using payload,identifier; end if;
 if entity='feedbacks' and coalesce((payload->>'released')::boolean,false) and (previous is null or not coalesce((previous->>'released')::boolean,false)) then
 employee_identifier=(payload->>'employee_id')::uuid;
 insert into public.notifications(user_id,title,path) select profile_id,'Novo feedback','/feedbacks' from public.employees where id=employee_identifier and profile_id is not null;
 end if;
 return identifier; end
$function$
;

insert into public.releases(version,changes)
values ('1.0.2','Separação entre Equipe de RH e membros da turma na gestão de pessoas, mantendo a chamada unificada.')
on conflict (version) do nothing;
