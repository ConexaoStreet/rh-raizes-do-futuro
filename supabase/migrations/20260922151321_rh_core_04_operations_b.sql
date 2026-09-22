create function private.finalize_attendance(session_identifier uuid,reason text default null) returns void language plpgsql security definer set search_path='' as $$
 declare s public.attendance_sessions; begin perform private.require_permission('attendance.manage');
 select * into s from public.attendance_sessions where id=session_identifier for update;
 if s.id is null or s.status<>'editing' then raise exception 'INVALID_TRANSITION'; end if;
 if not private.normal_window(s.class_id,s.scheduled_date) then raise exception 'OUTSIDE_WINDOW'; end if;
 if exists(select 1 from public.attendance_members where session_id=s.id and status='pending') and coalesce(length(trim(reason)),0)<3 then raise exception 'PENDING_MEMBERS'; end if;
 update public.attendance_sessions set status='finalized',finalized_by=auth.uid(),finalized_at=now(),finalization_reason=reason where id=s.id; end
$$;
create function private.start_maintenance(session_identifier uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$
 declare s public.attendance_sessions; identifier uuid; begin perform private.require_permission('attendance.maintenance');
 if coalesce(length(trim(reason)),0)<3 then raise exception 'REASON_REQUIRED'; end if;
 select * into s from public.attendance_sessions where id=session_identifier for update;
 if s.id is null or s.status='maintenance' or (s.status='editing' and private.normal_window(s.class_id,s.scheduled_date)) then raise exception 'INVALID_TRANSITION'; end if;
 insert into public.attendance_maintenance(session_id,opened_by,reason) values(s.id,auth.uid(),trim(reason)) returning id into identifier;
 update public.attendance_sessions set status='maintenance' where id=s.id;
 perform private.log('start','attendance_maintenance',identifier,null,null,'attendance_maintenance',jsonb_build_object('reason',reason)); return identifier; end
$$;
create function private.end_maintenance(session_identifier uuid) returns void language plpgsql security definer set search_path='' as $$
 declare s public.attendance_sessions; begin perform private.require_permission('attendance.maintenance');
 select * into s from public.attendance_sessions where id=session_identifier for update;
 if s.status<>'maintenance' then raise exception 'INVALID_TRANSITION'; end if;
 if (select count(*) from public.attendance_members where session_id=s.id)<>s.original_member_count then raise exception 'SNAPSHOT_IMMUTABLE'; end if;
 update public.attendance_maintenance set closed_by=auth.uid(),closed_at=now() where session_id=s.id and closed_at is null;
 update public.attendance_sessions set status='finalized',finalized_by=coalesce(finalized_by,auth.uid()),finalized_at=coalesce(finalized_at,now()) where id=s.id;
 perform private.log('end','attendance_maintenance',s.id,null,null,'attendance_maintenance'); end
$$;
create function private.course_status(class_identifier uuid,day date) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not private.account_ready() then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object('server_time',now(),'has_course',private.course_allowed(class_identifier,day),'can_open',private.can('attendance.manage') and private.normal_window(class_identifier,day)); end $$;
create function private.submit_justification(member_identifier uuid,category_identifier uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$
 declare employee_identifier uuid; identifier uuid; begin
 select employee_id into employee_identifier from public.attendance_members where id=member_identifier;
 if not (private.can('justification.manage') or private.owns_employee(employee_identifier)) then raise exception 'FORBIDDEN'; end if;
 insert into public.absence_justifications(member_id,employee_id,category_id,reason) values(member_identifier,employee_identifier,category_identifier,trim(reason)) returning id into identifier;
 insert into public.notifications(user_id,title,path) select distinct ur.user_id,'Justificativa aguardando análise','/justificativas' from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where p.code='justification.manage';
 return identifier; end
$$;
create function private.review_justification(identifier uuid,decision text,note text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
 declare j public.absence_justifications; begin perform private.require_permission('justification.manage');
 select * into j from public.absence_justifications where id=identifier for update;
 if j.version is distinct from expected_version then raise exception 'CONFLICT'; end if;
 if decision not in ('accepted','rejected') or coalesce(length(trim(note)),0)<3 then raise exception 'REASON_REQUIRED'; end if;
 update public.absence_justifications set status=decision,review_comment=note,reviewed_by=auth.uid(),reviewed_at=now() where id=identifier;
 insert into public.notifications(user_id,title,path) select profile_id,'Justificativa analisada','/justificativas' from public.employees where id=j.employee_id and profile_id is not null;
 end
$$;
create function private.feedback_reply(identifier uuid,body text default null,mark_read boolean default false) returns void language plpgsql security definer set search_path='' as $$
 declare f public.feedbacks; begin select * into f from public.feedbacks where id=identifier for update;
 if not (private.can('feedback.manage') or (f.released and private.owns_employee(f.employee_id))) then raise exception 'FORBIDDEN'; end if;
 if mark_read and private.owns_employee(f.employee_id) then update public.feedbacks set read_at=coalesce(read_at,now()) where id=identifier; end if;
 if body is not null and length(trim(body))>0 then
 if not f.allow_response and not private.can('feedback.manage') then raise exception 'FORBIDDEN'; end if;
 insert into public.feedback_followups(feedback_id,body) values(identifier,left(trim(body),5000)); end if; end
$$;
create function private.save_performance(employee_identifier uuid,cycle_identifier uuid,scores jsonb,notes text,released boolean,expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare identifier uuid; current_version integer; item jsonb; criterion public.performance_criteria; begin perform private.require_permission('performance.manage');
 if not exists(select 1 from public.performance_cycles where id=cycle_identifier and status='open') then raise exception 'INVALID_TRANSITION'; end if;
 perform pg_advisory_xact_lock(hashtextextended(employee_identifier::text||cycle_identifier::text,0));
 select id,version into identifier,current_version from public.performance_reviews where employee_id=employee_identifier and cycle_id=cycle_identifier for update;
 if identifier is not null and current_version is distinct from expected_version then raise exception 'CONFLICT'; end if;
 if identifier is null then insert into public.performance_reviews(employee_id,cycle_id,notes,released) values(employee_identifier,cycle_identifier,notes,released) returning id into identifier;
 else
 perform private.log('scores_before','performance_reviews',identifier,(select jsonb_agg(to_jsonb(s)) from public.performance_scores s where review_id=identifier),scores);
 update public.performance_reviews r set notes=save_performance.notes,released=save_performance.released where id=identifier;
 end if;
 if jsonb_array_length(scores)<>(select count(*) from public.performance_criteria where active) then raise exception 'INVALID_TRANSITION'; end if;
 delete from public.performance_scores where review_id=identifier;
 for item in select * from jsonb_array_elements(scores) loop
 select * into criterion from public.performance_criteria where id=(item->>'criterion_id')::uuid and active;
 if criterion.id is null then raise exception 'INVALID_TRANSITION'; end if;
 insert into public.performance_scores(review_id,criterion_id,criterion_name,score,weight) values(identifier,criterion.id,criterion.name,(item->>'score')::numeric,criterion.weight); end loop;
 perform private.log('scores_saved','performance_reviews',identifier,null,scores); return identifier; end
$$;
create function private.save_review_cycle(payload jsonb,manager_identifiers uuid[],expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare identifier uuid=(payload->>'id')::uuid; previous public.manager_review_cycles; begin perform private.require_permission('review.manage');
 if identifier is not null then select * into previous from public.manager_review_cycles where id=identifier for update;
 if previous.version is distinct from expected_version then raise exception 'CONFLICT'; end if;
 if previous.status not in ('draft','scheduled') then raise exception 'INVALID_TRANSITION'; end if;
 end if;
 if coalesce(array_length(manager_identifiers,1),0)=0 then raise exception 'INVALID_TRANSITION'; end if;
 if identifier is null then insert into public.manager_review_cycles(title,description,start_date,end_date,minimum_responses) values(payload->>'title',coalesce(payload->>'description',''),(payload->>'start_date')::date,(payload->>'end_date')::date,greatest(5,coalesce((payload->>'minimum_responses')::int,5))) returning id into identifier;
 else update public.manager_review_cycles set title=payload->>'title',description=coalesce(payload->>'description',''),start_date=(payload->>'start_date')::date,end_date=(payload->>'end_date')::date,minimum_responses=greatest(5,coalesce((payload->>'minimum_responses')::int,5)) where id=identifier;
 end if;
 delete from public.manager_cycle_targets where cycle_id=identifier;
 insert into public.manager_cycle_targets select identifier,unnest(manager_identifiers);
 delete from public.manager_cycle_criteria where cycle_id=identifier;
 insert into public.manager_cycle_criteria select identifier,id,name from public.manager_review_criteria where active;
 return identifier; end
$$;
create function private.set_review_cycle_status(identifier uuid,next_status text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
 declare previous public.manager_review_cycles; begin perform private.require_permission('review.manage');
 select * into previous from public.manager_review_cycles where id=identifier for update;
 if previous.version is distinct from expected_version then raise exception 'CONFLICT'; end if;
 if not ((previous.status in ('draft','scheduled') and next_status in ('scheduled','open','archived')) or (previous.status='open' and next_status='closed') or (previous.status='closed' and next_status='archived')) then raise exception 'INVALID_TRANSITION'; end if;
 if next_status='open' then
 if previous.start_date>(private.business_now() at time zone 'America/Sao_Paulo')::date or previous.end_date<(private.business_now() at time zone 'America/Sao_Paulo')::date then raise exception 'INVALID_TRANSITION'; end if;
 insert into private.manager_review_eligibility(cycle_id,manager_id,user_id)
 select identifier,t.manager_id,p.id from public.manager_cycle_targets t cross join public.profiles p join public.employees e on e.profile_id=p.id
 where t.cycle_id=identifier and p.status='active' and e.status='active' and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p.id and r.code='COLLABORATOR') and not exists(select 1 from public.managers m where m.profile_id=p.id) on conflict do nothing;
 insert into public.notifications(user_id,title,path) select distinct user_id,'Avaliação da gestão aberta','/gestao' from private.manager_review_eligibility where cycle_id=identifier;
 end if;
 update public.manager_review_cycles set status=next_status where id=identifier; end
$$;
create function private.my_review_tasks() returns jsonb language plpgsql security definer set search_path='' as $$
 begin if not private.account_ready() then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('cycle_id',e.cycle_id,'manager_id',e.manager_id,'manager_name',m.full_name,'title',c.title,'end_date',c.end_date,'used',e.used,'criteria',(select jsonb_agg(jsonb_build_object('id',criterion_id,'name',name_snapshot) order by name_snapshot) from public.manager_cycle_criteria where cycle_id=c.id))) from private.manager_review_eligibility e join public.manager_review_cycles c on c.id=e.cycle_id join public.managers m on m.id=e.manager_id where e.user_id=auth.uid() and c.status='open' and (private.business_now() at time zone 'America/Sao_Paulo')::date between c.start_date and c.end_date),'[]'); end
$$;
create function private.submit_manager_review(cycle_identifier uuid,manager_identifier uuid,scores jsonb,strengths text,improvements text,message text) returns void language plpgsql security definer set search_path='' as $$
 declare used_value boolean; criterion record; score_value numeric; expected integer; begin
 if not private.account_ready() then raise exception 'FORBIDDEN'; end if;
 perform 1 from public.manager_review_cycles where id=cycle_identifier and status='open' and (private.business_now() at time zone 'America/Sao_Paulo')::date between start_date and end_date for share;
 if not found then raise exception 'INVALID_TRANSITION'; end if;
 select used into used_value from private.manager_review_eligibility where cycle_id=cycle_identifier and manager_id=manager_identifier and user_id=auth.uid() for update;
 if used_value is null then raise exception 'FORBIDDEN'; end if;
 if used_value then raise exception 'DUPLICATE_VOTE'; end if;
 select count(*) into expected from public.manager_cycle_criteria where cycle_id=cycle_identifier;
 if jsonb_typeof(scores)<>'object' or (select count(*) from jsonb_object_keys(scores))<>expected or expected=0 then raise exception 'INVALID_TRANSITION'; end if;
 for criterion in select criterion_id from public.manager_cycle_criteria where cycle_id=cycle_identifier loop
 score_value=(scores->>criterion.criterion_id::text)::numeric;
 if score_value is null or score_value<1 or score_value>5 or score_value<>trunc(score_value) then raise exception 'INVALID_TRANSITION'; end if; end loop;
 update private.manager_review_eligibility set used=true where cycle_id=cycle_identifier and manager_id=manager_identifier and user_id=auth.uid();
 insert into private.anonymous_manager_reviews(cycle_id,manager_id,scores,strengths,improvements,message) values(cycle_identifier,manager_identifier,scores,coalesce(strengths,''),coalesce(improvements,''),coalesce(message,'')); end
$$;
create function private.manager_results(cycle_identifier uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare c public.manager_review_cycles; result jsonb='[]'; target record; total integer; criterion_averages jsonb; themes jsonb; begin perform private.require_permission('review.results');
 select * into c from public.manager_review_cycles where id=cycle_identifier;
 if c.status not in ('closed','archived') then return jsonb_build_object('available',false,'reason','cycle_open','managers','[]'::jsonb); end if;
 for target in select m.id,m.full_name from public.manager_cycle_targets t join public.managers m on m.id=t.manager_id where t.cycle_id=c.id loop
 select count(*) into total from private.anonymous_manager_reviews where cycle_id=c.id and manager_id=target.id;
 if total < c.minimum_responses then result=result||jsonb_build_array(jsonb_build_object('manager_name',target.full_name,'available',false)); continue; end if;
 select jsonb_agg(jsonb_build_object('name',x.name_snapshot,'average',x.average) order by x.name_snapshot) into criterion_averages from (
 select mc.name_snapshot,round(avg((r.scores->>mc.criterion_id::text)::numeric),2) average from public.manager_cycle_criteria mc join private.anonymous_manager_reviews r on r.cycle_id=mc.cycle_id and r.manager_id=target.id where mc.cycle_id=c.id group by mc.name_snapshot) x;
 select coalesce(jsonb_agg(jsonb_build_object('theme',theme,'mentions',mentions)),'[]') into themes from (
 select theme,count(*) mentions from private.anonymous_manager_reviews r cross join (values('comunicação'),('respeito'),('organização'),('clareza'),('apoio'),('liderança'),('disponibilidade')) t(theme) where r.cycle_id=c.id and r.manager_id=target.id and lower(r.strengths||' '||r.improvements||' '||r.message) like '%'||theme||'%' group by theme having count(*)>=c.minimum_responses) x;
 result=result||jsonb_build_array(jsonb_build_object('manager_name',target.full_name,'available',true,'responses',total,'participation',round(total*100.0/nullif((select count(*) from private.manager_review_eligibility where cycle_id=c.id and manager_id=target.id),0),1),'criteria',criterion_averages,'themes',themes));
 end loop;
 return jsonb_build_object('available',true,'title',c.title,'managers',result); end
$$;
create function private.mark_notification(identifier uuid) returns void language plpgsql security definer set search_path='' as $$ begin if not private.account_ready() then raise exception 'FORBIDDEN'; end if; update public.notifications set read_at=coalesce(read_at,now()) where id=identifier and user_id=auth.uid(); end $$;
