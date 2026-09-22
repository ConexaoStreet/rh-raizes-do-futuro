create policy attendance_sessions_read on public.attendance_sessions for select to authenticated using ((select private.can('attendance.view')) or exists(select 1 from public.attendance_members m where m.session_id=attendance_sessions.id and private.owns_employee(m.employee_id)));
create function private.bootstrap() returns jsonb language plpgsql security definer set search_path='' as $$
 declare p public.profiles; granted text[]; begin
 if not private.session_valid() then raise exception 'FORBIDDEN'; end if;
 select * into p from public.profiles where id=auth.uid();
 select coalesce(array_agg(distinct pe.code),'{}') into granted from public.user_roles ur join public.roles r on r.id=ur.role_id join public.role_permissions rp on rp.role_id=r.id join public.permissions pe on pe.id=rp.permission_id where ur.user_id=auth.uid() and r.active and not r.archived;
 return jsonb_build_object('profile',to_jsonb(p),'roles',private.roles_for_current_user(),'permissions',case when private.account_ready() then granted else '{}'::text[] end,'privileged',private.is_privileged(),'mfa_verified',exists(select 1 from private.session_security where session_id=private.session_id() and verified_until > now() and revoked_at is null),'ready',private.account_ready(),'server_time',now(),'maintenance',coalesce((select value from public.settings where key='maintenance'),'{}'),'employee_id',(select id from public.employees where profile_id=auth.uid())); end
$$;
create function private.complete_profile(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
 begin if not private.session_valid() or coalesce((payload->>'terms')::boolean,false)=false then raise exception 'FORBIDDEN'; end if;
 update public.profiles set full_name=trim(payload->>'full_name'),phone=left(payload->>'phone',30),registration=left(payload->>'registration',80),requested_class=left(payload->>'requested_class',120),terms_accepted_at=coalesce(terms_accepted_at,now()),onboarded_at=coalesce(onboarded_at,now()) where id=auth.uid(); end
$$;
create function private.approve_user(user_identifier uuid,employee_identifier uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
 begin perform private.require_permission('user.approve');
 if user_identifier=auth.uid() or length(trim(reason))<3 or reason is null then raise exception 'FORBIDDEN'; end if;
 perform 1 from public.profiles where id=user_identifier and status='pending' and onboarded_at is not null and terms_accepted_at is not null for update;
 if not found then raise exception 'INVALID_TRANSITION'; end if;
 update public.employees set profile_id=user_identifier where id=employee_identifier and profile_id is null and status='active';
 if not found then raise exception 'INVALID_TRANSITION'; end if;
 update public.profiles set status='active' where id=user_identifier;
 insert into public.user_roles(user_id,role_id) select user_identifier,id from public.roles where code='COLLABORATOR' on conflict do nothing;
 perform private.log('approve','profiles',user_identifier,null,null,'permission_change',jsonb_build_object('reason',reason)); end
$$;
create function private.manage_user(user_identifier uuid,new_status text,role_identifiers uuid[],reason text) returns void language plpgsql security definer set search_path='' as $$
 declare rid uuid; begin perform private.require_permission('user.manage');
 if user_identifier=auth.uid() then raise exception 'FORBIDDEN'; end if;
 if reason is null or length(trim(reason))<3 then raise exception 'REASON_REQUIRED'; end if;
 if new_status not in ('active','suspended','inactive','blocked') or coalesce(array_length(role_identifiers,1),0)=0 then raise exception 'INVALID_TRANSITION'; end if;
 perform 1 from public.profiles where id=user_identifier for update; if not found then raise exception 'INVALID_TRANSITION'; end if;
 foreach rid in array role_identifiers loop if not exists(select 1 from public.roles where id=rid and active and not archived) then raise exception 'INVALID_TRANSITION'; end if; end loop;
 update public.profiles set status=new_status where id=user_identifier;
 delete from public.user_roles where user_id=user_identifier;
 insert into public.user_roles select user_identifier,unnest(role_identifiers);
 insert into private.session_security(session_id,user_id,revoked_at) select id,user_id,now() from auth.sessions where user_id=user_identifier on conflict(session_id) do update set revoked_at=now(),verified_until=null;
 perform private.log('change_access','profiles',user_identifier,null,jsonb_build_object('status',new_status,'roles',role_identifiers),'permission_change',jsonb_build_object('reason',reason)); end
$$;
create function private.save_role(payload jsonb,permission_identifiers uuid[],expected_version integer,reason text) returns uuid language plpgsql security definer set search_path='' as $$
 declare rid uuid=(payload->>'id')::uuid; previous public.roles; privileged_value boolean; old_permissions uuid[]; begin perform private.require_permission('role.manage');
 if reason is null or length(trim(reason))<3 then raise exception 'REASON_REQUIRED'; end if;
 privileged_value=exists(select 1 from public.permissions where id=any(permission_identifiers));
 if rid is null then
 insert into public.roles(code,name,description,level,scope,privileged) values('CUSTOM_'||replace(gen_random_uuid()::text,'-',''),payload->>'name',coalesce(payload->>'description',''),least(69,greatest(1,coalesce((payload->>'level')::integer,1))),case when privileged_value then 'organization' else 'self' end,privileged_value) returning id into rid;
 else
 select * into previous from public.roles where id=rid for update;
 if previous.id is null or previous.version is distinct from expected_version then raise exception 'CONFLICT'; end if;
 if previous.code='SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
 update public.roles set name=payload->>'name',description=coalesce(payload->>'description',''),active=coalesce((payload->>'active')::boolean,true),archived=coalesce((payload->>'archived')::boolean,false),level=least(69,greatest(1,coalesce((payload->>'level')::integer,previous.level))),privileged=privileged_value or previous.code='MANAGER',scope=case when privileged_value then 'organization' else 'self' end where id=rid;
 end if;
 select coalesce(array_agg(permission_id),'{}'::uuid[]) into old_permissions from public.role_permissions where role_id=rid;
 delete from public.role_permissions where role_id=rid;
 insert into public.role_permissions select rid,unnest(permission_identifiers);
 insert into private.session_security(session_id,user_id,revoked_at) select s.id,s.user_id,now() from auth.sessions s join public.user_roles ur on ur.user_id=s.user_id where ur.role_id=rid on conflict(session_id) do update set revoked_at=now(),verified_until=null;
 perform private.log('save_role','roles',rid,to_jsonb(previous),(select to_jsonb(r) from public.roles r where r.id=rid),'permission_change',jsonb_build_object('reason',reason,'old_permissions',old_permissions,'new_permissions',permission_identifiers)); return rid; end
$$;
create function private.my_sessions(target_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
 begin if not private.account_ready() then raise exception 'FORBIDDEN'; end if;
 if target_user is not null and target_user <> auth.uid() then perform private.require_permission('user.manage'); end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'created_at',s.created_at,'updated_at',s.updated_at,'current',s.id=private.session_id(),'revoked',x.revoked_at is not null) order by s.created_at desc) from auth.sessions s left join private.session_security x on x.session_id=s.id where s.user_id=coalesce(target_user,auth.uid())),'[]'); end
$$;
create function private.revoke_session(session_identifier uuid) returns void language plpgsql security definer set search_path='' as $$
 declare owner_id uuid; begin if not private.account_ready() then raise exception 'FORBIDDEN'; end if;
 select user_id into owner_id from auth.sessions where id=session_identifier;
 if owner_id is null then raise exception 'INVALID_TRANSITION'; end if;
 if owner_id <> auth.uid() then perform private.require_permission('user.manage'); end if;
 insert into private.session_security(session_id,user_id,revoked_at) values(session_identifier,owner_id,now()) on conflict(session_id) do update set revoked_at=now(),verified_until=null;
 perform private.log('revoke_session','sessions',session_identifier,null,null,'security'); end
$$;
create function private.save_entity(entity text,payload jsonb,expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare allowed text[]; permission_code text; identifier uuid=(payload->>'id')::uuid; previous jsonb; fields text; values_sql text; updates_sql text; key_name text; employee_identifier uuid;
 begin
 case entity
 when 'employees' then permission_code='employee.manage'; allowed=array['full_name','social_name','email','phone','registration','join_date','class_id','department_id','job_position_id','manager_id','expected_arrival','expected_departure','status','photo_path'];
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
$$;
create function private.open_attendance(class_identifier uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare identifier uuid; today date=(private.business_now() at time zone 'America/Sao_Paulo')::date; member_count integer;
 begin perform private.require_permission('attendance.manage');
 if not private.course_allowed(class_identifier,today) then raise exception 'INVALID_COURSE_DAY'; end if;
 if not private.normal_window(class_identifier,today) then raise exception 'OUTSIDE_WINDOW'; end if;
 perform pg_advisory_xact_lock(hashtextextended(class_identifier::text||today::text,0));
 select id into identifier from public.attendance_sessions where class_id=class_identifier and scheduled_date=today;
 if identifier is not null then return identifier; end if;
 insert into public.attendance_sessions(class_id,scheduled_date,opened_by) values(class_identifier,today,auth.uid()) returning id into identifier;
 insert into public.attendance_members(session_id,employee_id,full_name_snapshot,registration_snapshot,expected_arrival,expected_departure)
 select identifier,id,coalesce(nullif(social_name,''),full_name),registration,expected_arrival,expected_departure from public.employees where class_id=class_identifier and status='active' and join_date<=today order by full_name;
 get diagnostics member_count=row_count;
 if member_count=0 then raise exception 'EMPTY_CLASS'; end if;
 update public.attendance_sessions set original_member_count=member_count where id=identifier;
 perform private.log('snapshot','attendance_sessions',identifier,null,jsonb_build_object('members',(select jsonb_agg(jsonb_build_object('id',employee_id,'name',full_name_snapshot,'registration',registration_snapshot)) from public.attendance_members where session_id=identifier),'count',member_count));
 return identifier; end
$$;
create function private.save_attendance(session_identifier uuid,changes jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare s public.attendance_sessions; change jsonb; member public.attendance_members; next_status text; begin
 select * into s from public.attendance_sessions where id=session_identifier for update;
 if s.id is null then raise exception 'INVALID_TRANSITION'; end if;
 if s.status='maintenance' then perform private.require_permission('attendance.maintenance');
 elsif s.status='editing' then perform private.require_permission('attendance.manage'); if not private.normal_window(s.class_id,s.scheduled_date) then raise exception 'OUTSIDE_WINDOW'; end if;
 else raise exception 'INVALID_TRANSITION'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>1000 or jsonb_array_length(changes)=0 then raise exception 'INVALID_TRANSITION'; end if;
 for change in select * from jsonb_array_elements(changes) loop
 if exists(select 1 from jsonb_object_keys(change) k where k not in ('id','version','status','actual_arrival','actual_departure','notes')) then raise exception 'SNAPSHOT_IMMUTABLE'; end if;
 select * into member from public.attendance_members where id=(change->>'id')::uuid and session_id=session_identifier for update;
 if member.id is null then raise exception 'SNAPSHOT_IMMUTABLE'; end if;
 if member.version is distinct from (change->>'version')::integer then raise exception 'CONFLICT'; end if;
 next_status=coalesce(change->>'status',member.status);
 update public.attendance_members set status=next_status,actual_arrival=case when change?'actual_arrival' then nullif(change->>'actual_arrival','')::time else actual_arrival end,actual_departure=case when change?'actual_departure' then nullif(change->>'actual_departure','')::time else actual_departure end,notes=case when change?'notes' then left(coalesce(change->>'notes',''),3000) else notes end where id=member.id;
 end loop;
 if (select count(*) from public.attendance_members where session_id=session_identifier) <> s.original_member_count then raise exception 'SNAPSHOT_IMMUTABLE'; end if;
 update public.attendance_sessions set updated_at=now() where id=session_identifier;
 return jsonb_build_object('saved',jsonb_array_length(changes),'server_time',now()); end
$$;
