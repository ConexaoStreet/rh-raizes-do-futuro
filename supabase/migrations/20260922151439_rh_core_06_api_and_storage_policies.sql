create function private.file_read_allowed(bucket_name text,file_path text) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_ready() and ((bucket_name='exports' and private.can('report.view') and exists(select 1 from public.report_exports where path=file_path)) or (bucket_name='institutional-images' and private.can('report.view')) or exists(select 1 from public.attachments a where a.bucket=bucket_name and a.path=file_path and not a.archived and (private.can('files.manage') or (private.owns_employee(a.employee_id) and (a.feedback_id is null or exists(select 1 from public.feedbacks f where f.id=a.feedback_id and f.released))))))
$$;
create policy rh_files_insert on storage.objects for insert to authenticated with check(private.file_upload_allowed(bucket_id,name));
create policy rh_files_read on storage.objects for select to authenticated using(private.file_read_allowed(bucket_id,name));
create function private.authenticate_event(action_name text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.session_valid() or action_name not in ('login','logout','password_changed','recovery_requested') then raise exception 'FORBIDDEN'; end if;
 if action_name='login' then update public.profiles set last_seen_at=now() where id=auth.uid(); end if;
 perform private.log(action_name,'auth',auth.uid(),null,null,'authentication'); end $$;
DO $$ declare fn record; signature text; argument_names text; service_only boolean; begin
 for fn in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) identity_arguments,pg_get_function_arguments(p.oid) all_arguments,pg_get_function_result(p.oid) result_type from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('bootstrap','complete_profile','approve_user','manage_user','save_role','my_sessions','revoke_session','save_entity','open_attendance','save_attendance','finalize_attendance','start_maintenance','end_maintenance','course_status','submit_justification','review_justification','feedback_reply','save_performance','save_review_cycle','set_review_cycle_status','my_review_tasks','submit_manager_review','manager_results','mark_notification','attach_file','archive_attachment','report_snapshot','register_report','register_export','import_employees','system_health','issue_otp','verify_otp','expire_security_data','authenticate_event') loop
 select string_agg(format('%I',arg),',') into argument_names from unnest((select proargnames from pg_proc where oid=fn.oid)) arg;
 signature=format('%I(%s)',fn.proname,fn.identity_arguments);
 execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as %L',fn.proname,fn.all_arguments,fn.result_type,format('select private.%I(%s)',fn.proname,coalesce(argument_names,'')));
 service_only=fn.proname in ('issue_otp','verify_otp','expire_security_data');
 execute 'revoke all on function private.'||signature||' from public,anon,authenticated';
 execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
 execute 'grant execute on function private.'||signature||' to '||case when service_only then 'service_role' else 'authenticated' end;
 execute 'grant execute on function public.'||signature||' to '||case when service_only then 'service_role' else 'authenticated' end;
 end loop; end $$;
grant usage on schema private to authenticated,service_role;
grant execute on function private.session_id(),private.session_valid(),private.roles_for_current_user(),private.is_privileged(),private.account_ready(),private.can(text),private.owns_employee(uuid),private.review_eligible(uuid),private.file_read_allowed(text,text),private.file_upload_allowed(text,text) to authenticated;
revoke all on all tables in schema private from public,anon,authenticated;
create function private.import_calendar(rows jsonb) returns integer language plpgsql security definer set search_path='' as $$ declare item jsonb; imported integer=0; begin perform private.require_permission('calendar.manage'); if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>1000 then raise exception 'INVALID_TRANSITION'; end if; for item in select * from jsonb_array_elements(rows) loop perform private.save_entity('course_calendar',item,null); imported=imported+1; end loop; return imported; end $$;
create function public.import_calendar(rows jsonb) returns integer language sql security invoker set search_path='' as $$ select private.import_calendar(rows) $$;
revoke all on function public.import_calendar(jsonb),private.import_calendar(jsonb) from public,anon;
grant execute on function public.import_calendar(jsonb),private.import_calendar(jsonb) to authenticated;
create function private.dashboard_snapshot(period_start date,period_end date) returns jsonb language plpgsql security definer set search_path='' as $$ declare series jsonb; begin
 perform private.require_permission('dashboard.view'); if period_end<period_start or period_end-period_start>366 then raise exception 'INVALID_TRANSITION'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by "month"),'[]') into series from (select to_char(s.scheduled_date,'YYYY-MM') as "month",count(*) filter(where m.status in ('present','late','early_exit','occurrence')) present,count(*) filter(where m.status='absent') absent,count(*) filter(where m.status='justified') justified,count(*) filter(where m.delay_minutes>0) late from public.attendance_members m join public.attendance_sessions s on s.id=m.session_id where s.scheduled_date between period_start and period_end group by 1) x;
 return jsonb_build_object('period_start',period_start,'period_end',period_end,'generated_at',now(),'metrics',private.metrics(period_start,period_end,null,null),'previous',private.metrics(period_start-(period_end-period_start+1),period_start-1,null,null),'series',series,'records','[]'::jsonb,'grades','[]'::jsonb,'feedbacks','[]'::jsonb); end $$;
create function public.dashboard_snapshot(period_start date,period_end date) returns jsonb language sql security invoker set search_path='' as $$ select private.dashboard_snapshot(period_start,period_end) $$;
revoke all on function public.dashboard_snapshot(date,date),private.dashboard_snapshot(date,date) from public,anon;
grant execute on function public.dashboard_snapshot(date,date),private.dashboard_snapshot(date,date) to authenticated;
