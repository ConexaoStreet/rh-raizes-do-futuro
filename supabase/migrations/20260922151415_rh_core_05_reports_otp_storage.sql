create function private.attach_file(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare identifier uuid; employee_identifier uuid=(payload->>'employee_id')::uuid; bucket_name text=payload->>'bucket'; file_path text=payload->>'path'; begin
 if not (private.can('files.manage') or private.owns_employee(employee_identifier)) then raise exception 'FORBIDDEN'; end if;
 if split_part(file_path,'/',1)<>employee_identifier::text then raise exception 'FORBIDDEN'; end if;
 if (payload->>'justification_id') is not null and not exists(select 1 from public.absence_justifications where id=(payload->>'justification_id')::uuid and employee_id=employee_identifier) then raise exception 'FORBIDDEN'; end if;
 if (payload->>'feedback_id') is not null and not exists(select 1 from public.feedbacks where id=(payload->>'feedback_id')::uuid and employee_id=employee_identifier and (released or private.can('files.manage'))) then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from storage.objects where bucket_id=bucket_name and name=file_path) then raise exception 'INVALID_TRANSITION'; end if;
 insert into public.attachments(employee_id,justification_id,feedback_id,bucket,path,filename,size_bytes,mime_type) values(employee_identifier,(payload->>'justification_id')::uuid,(payload->>'feedback_id')::uuid,bucket_name,file_path,left(payload->>'filename',180),(payload->>'size_bytes')::int,payload->>'mime_type') returning id into identifier; return identifier; end
$$;
create function private.archive_attachment(identifier uuid,reason text) returns void language plpgsql security definer set search_path='' as $$ begin perform private.require_permission('files.manage'); if coalesce(length(trim(reason)),0)<3 then raise exception 'REASON_REQUIRED'; end if; update public.attachments set archived=true where id=identifier; perform private.log('archive','attachments',identifier,null,null,'data_change',jsonb_build_object('reason',reason)); end $$;
create function private.metrics(period_start date,period_end date,employee_identifier uuid default null,class_identifier uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 with a as (select m.* from public.attendance_members m join public.attendance_sessions s on s.id=m.session_id where s.scheduled_date between period_start and period_end and (employee_identifier is null or m.employee_id=employee_identifier) and (class_identifier is null or s.class_id=class_identifier)),
 grades as (select r.id,sum(sc.score*sc.weight)/nullif(sum(sc.weight),0) average from public.performance_reviews r join public.performance_cycles c on c.id=r.cycle_id join public.performance_scores sc on sc.review_id=r.id join public.employees e on e.id=r.employee_id where c.end_date between period_start and period_end and (employee_identifier is null or r.employee_id=employee_identifier) and (class_identifier is null or e.class_id=class_identifier) group by r.id)
 select jsonb_build_object('employees',(select count(*) from public.employees where (employee_identifier is null or id=employee_identifier) and (class_identifier is null or class_id=class_identifier)),'active_employees',(select count(*) from public.employees where status='active' and (employee_identifier is null or id=employee_identifier) and (class_identifier is null or class_id=class_identifier)),
 'records',count(*) filter(where status<>'pending'),'pending',count(*) filter(where status='pending'),'present',count(*) filter(where status in ('present','late','early_exit','occurrence')),'absent',count(*) filter(where status in ('absent','justified')),'justified',count(*) filter(where status='justified'),'unjustified',count(*) filter(where status='absent'),'late',count(*) filter(where delay_minutes>0),'delay_total',coalesce(sum(delay_minutes),0),'delay_average',round(avg(delay_minutes) filter(where delay_minutes>0),1),
 'attendance_rate',round(count(*) filter(where status in ('present','late','early_exit','occurrence'))*100.0/nullif(count(*) filter(where status<>'pending'),0),1),
 'punctuality_rate',round(count(*) filter(where status in ('present','late','early_exit','occurrence') and delay_minutes=0)*100.0/nullif(count(*) filter(where status in ('present','late','early_exit','occurrence')),0),1),
 'performance_average',(select round(avg(average),2) from grades),'feedback_count',(select count(*) from public.feedbacks f join public.employees e on e.id=f.employee_id where f.created_at >= period_start::timestamp at time zone 'America/Sao_Paulo' and f.created_at < (period_end+1)::timestamp at time zone 'America/Sao_Paulo' and (employee_identifier is null or f.employee_id=employee_identifier) and (class_identifier is null or e.class_id=class_identifier))) from a
$$;
create function private.report_snapshot(period_start date,period_end date,employee_identifier uuid default null,class_identifier uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare series jsonb; records jsonb; grade_rows jsonb; feedback_rows jsonb; begin perform private.require_permission('report.view');
 if period_end<period_start or period_end-period_start>366 then raise exception 'INVALID_TRANSITION'; end if;
 if (select count(*) from public.attendance_members m join public.attendance_sessions s on s.id=m.session_id where s.scheduled_date between period_start and period_end and (employee_identifier is null or m.employee_id=employee_identifier) and (class_identifier is null or s.class_id=class_identifier))>10000 then raise exception 'NARROW_PERIOD'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into records from (select s.scheduled_date date,c.name class_name,m.full_name_snapshot name,m.registration_snapshot registration,m.status,m.expected_arrival,m.actual_arrival,m.actual_departure,m.delay_minutes,m.early_minutes,m.notes,s.status session_status,s.finalized_at,p.full_name responsible,(select count(*) from public.attendance_maintenance where session_id=s.id) maintenance_count from public.attendance_members m join public.attendance_sessions s on s.id=m.session_id join public.classes c on c.id=s.class_id left join public.profiles p on p.id=s.finalized_by where s.scheduled_date between period_start and period_end and (employee_identifier is null or m.employee_id=employee_identifier) and (class_identifier is null or s.class_id=class_identifier) order by s.scheduled_date,m.full_name_snapshot) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by "month"),'[]') into series from (select to_char(s.scheduled_date,'YYYY-MM') as "month",count(*) filter(where m.status in ('present','late','early_exit','occurrence')) present,count(*) filter(where m.status='absent') absent,count(*) filter(where m.status='justified') justified,count(*) filter(where m.delay_minutes>0) late from public.attendance_members m join public.attendance_sessions s on s.id=m.session_id where s.scheduled_date between period_start and period_end and (employee_identifier is null or m.employee_id=employee_identifier) and (class_identifier is null or s.class_id=class_identifier) group by 1) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into grade_rows from (select e.full_name name,c.title cycle,c.end_date date,round(sum(s.score*s.weight)/nullif(sum(s.weight),0),2) average from public.performance_reviews r join public.performance_cycles c on c.id=r.cycle_id join public.employees e on e.id=r.employee_id join public.performance_scores s on s.review_id=r.id where c.end_date between period_start and period_end and (employee_identifier is null or e.id=employee_identifier) and (class_identifier is null or e.class_id=class_identifier) group by e.full_name,c.title,c.end_date,r.id) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into feedback_rows from (select e.full_name name,f.title,f.kind,f.status,f.due_date,f.created_at,f.strengths,f.improvements,f.actions from public.feedbacks f join public.employees e on e.id=f.employee_id where f.created_at>=period_start::timestamp at time zone 'America/Sao_Paulo' and f.created_at<(period_end+1)::timestamp at time zone 'America/Sao_Paulo' and (employee_identifier is null or e.id=employee_identifier) and (class_identifier is null or e.class_id=class_identifier) order by f.created_at desc) x;
 return jsonb_build_object('period_start',period_start,'period_end',period_end,'generated_at',now(),'metrics',private.metrics(period_start,period_end,employee_identifier,class_identifier),'previous',private.metrics(period_start-(period_end-period_start+1),period_start-1,employee_identifier,class_identifier),'series',series,'records',records,'grades',grade_rows,'feedbacks',feedback_rows); end
$$;
create function private.register_report(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare identifier uuid; begin perform private.require_permission('report.export');
 insert into public.reports(title,kind,period_start,period_end,employee_id,class_id) values(payload->>'title',payload->>'kind',(payload->>'period_start')::date,(payload->>'period_end')::date,(payload->>'employee_id')::uuid,(payload->>'class_id')::uuid) returning id into identifier;
 return identifier; end
$$;
create function private.register_export(report_identifier uuid,format_name text,file_path text) returns uuid language plpgsql security definer set search_path='' as $$
 declare identifier uuid; begin perform private.require_permission('report.export');
 if split_part(file_path,'/',1)<>auth.uid()::text or not exists(select 1 from public.reports where id=report_identifier and created_by=auth.uid()) or not exists(select 1 from storage.objects where bucket_id='exports' and name=file_path) then raise exception 'FORBIDDEN'; end if;
 insert into public.report_exports(report_id,format,path) values(report_identifier,format_name,file_path) returning id into identifier;
 perform private.log('export','reports',report_identifier,null,jsonb_build_object('format',format_name),'export'); return identifier; end
$$;
create function private.import_employees(rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
 declare item jsonb; imported integer=0; begin perform private.require_permission('employee.manage');
 if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>1000 then raise exception 'INVALID_TRANSITION'; end if;
 for item in select * from jsonb_array_elements(rows) loop perform private.save_entity('employees',item,null); imported=imported+1; end loop; return imported; end
$$;
create function private.system_health() returns jsonb language plpgsql security definer set search_path='' as $$ begin perform private.require_permission('system.manage');
 return jsonb_build_object('version','1.0.0','server_time',now(),'active_users',(select count(*) from public.profiles where status='active'),'pending_users',(select count(*) from public.profiles where status='pending'),'sessions',(select count(*) from auth.sessions s where not exists(select 1 from private.session_security x where x.session_id=s.id and x.revoked_at is not null)),'failed_2fa_today',(select count(*) from public.audit_logs where event_type='authentication' and not success and created_at>=current_date),'exports',(select count(*) from public.report_exports),'snapshot_errors',(select count(*) from public.attendance_sessions s where original_member_count<>(select count(*) from public.attendance_members where session_id=s.id)),'tables_without_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity)); end $$;
create function private.issue_otp(user_identifier uuid,session_identifier uuid,hash_value text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare last_sent timestamptz; request_count integer; identifier uuid; begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from auth.sessions where id=session_identifier and user_id=user_identifier and (not_after is null or not_after>now())) or exists(select 1 from private.session_security where session_id=session_identifier and revoked_at is not null) or not exists(select 1 from public.profiles where id=user_identifier and status='active') or not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=user_identifier and r.active and r.privileged) then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(user_identifier::text,1));
 select max(created_at),count(*) filter(where created_at>now()-interval '1 hour') into last_sent,request_count from private.otp_challenges where user_id=user_identifier;
 if last_sent>now()-interval '60 seconds' or request_count>=5 then return jsonb_build_object('ok',false,'error','RATE_LIMITED'); end if;
 update private.otp_challenges set consumed_at=coalesce(consumed_at,now()) where user_id=user_identifier and session_id=session_identifier;
 insert into private.otp_challenges(user_id,session_id,code_hash,expires_at) values(user_identifier,session_identifier,hash_value,now()+interval '5 minutes') returning id into identifier;
 insert into private.session_security(session_id,user_id) values(session_identifier,user_identifier) on conflict(session_id) do update set verified_until=null;
 insert into public.audit_logs(actor_user_id,actor_name,event_type,action,module) select user_identifier,full_name,'authentication','otp_requested','security' from public.profiles where id=user_identifier;
 return jsonb_build_object('ok',true,'challenge_id',identifier); end
$$;
create function private.verify_otp(user_identifier uuid,session_identifier uuid,hash_value text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare challenge private.otp_challenges; valid boolean; begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(user_identifier::text,1));
 if not exists(select 1 from auth.sessions where id=session_identifier and user_id=user_identifier and (not_after is null or not_after>now())) or exists(select 1 from private.session_security where session_id=session_identifier and revoked_at is not null) or not exists(select 1 from public.profiles where id=user_identifier and status='active') then return jsonb_build_object('ok',false); end if;
 select * into challenge from private.otp_challenges where user_id=user_identifier and session_id=session_identifier order by created_at desc limit 1 for update;
 valid=challenge.id is not null and challenge.consumed_at is null and challenge.expires_at>now() and challenge.attempts<5 and challenge.code_hash=hash_value;
 if challenge.id is not null and challenge.consumed_at is null then update private.otp_challenges set attempts=attempts+1,consumed_at=case when valid or attempts+1>=5 then now() else null end where id=challenge.id; end if;
 if valid then update private.session_security set verified_until=now()+interval '8 hours' where session_id=session_identifier and user_id=user_identifier and revoked_at is null; end if;
 insert into public.audit_logs(actor_user_id,actor_name,event_type,action,module,success) select user_identifier,full_name,'authentication',case when valid then 'otp_verified' else 'otp_failed' end,'security',valid from public.profiles where id=user_identifier;
 return jsonb_build_object('ok',coalesce(valid,false)); end
$$;
create function private.expire_security_data() returns integer language plpgsql security definer set search_path='' as $$ declare removed integer; begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN'; end if;
 delete from private.otp_challenges where expires_at<now()-interval '1 day'; get diagnostics removed=row_count; return removed; end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('justifications','justifications',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('medical-certificates','medical-certificates',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('documents','documents',false,10485760,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
 ('feedback-files','feedback-files',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('exports','exports',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','image/png']),
 ('institutional-images','institutional-images',false,10485760,array['image/jpeg','image/png']) on conflict(id) do nothing;
create function private.file_upload_allowed(bucket_name text,file_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
 declare identifier uuid; begin if not private.account_ready() then return false; end if;
 begin identifier=split_part(file_path,'/',1)::uuid; exception when invalid_text_representation then return false; end;
 if bucket_name='exports' then return private.can('report.export') and identifier=auth.uid(); end if;
 if bucket_name='institutional-images' then return private.can('system.manage'); end if;
 return bucket_name in ('justifications','medical-certificates','documents','feedback-files') and (private.can('files.manage') or private.owns_employee(identifier)); end $$;
