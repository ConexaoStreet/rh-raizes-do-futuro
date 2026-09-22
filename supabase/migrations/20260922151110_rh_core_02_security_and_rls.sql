create index audit_entity on public.audit_logs(module,entity_id,created_at desc);
create index attachments_employee on public.attachments(employee_id);
create index anonymous_reviews_aggregate on private.anonymous_manager_reviews(cycle_id,manager_id);
create index user_roles_role on public.user_roles(role_id,user_id);
insert into public.roles(code,name,description,level,scope,privileged) values
 ('SUPER_ADMIN','Administrador Total / Desenvolvedor','Administração do sistema',100,'organization',true),
 ('MANAGER','Gestor','Gestão operacional do RH',70,'organization',true),
 ('COLLABORATOR','Colaborador','Acesso aos próprios registros',10,'self',false);
insert into public.permissions(code,name,module) values
 ('dashboard.view','Visualizar','Dashboard'),('employee.view','Visualizar','Colaboradores'),('employee.manage','Cadastrar e editar','Colaboradores'),
 ('attendance.view','Visualizar','Chamada'),('attendance.manage','Fazer chamada','Chamada'),('attendance.maintenance','Fazer manutenção','Chamada'),
 ('justification.view','Visualizar','Justificativas'),('justification.manage','Analisar','Justificativas'),('feedback.view','Visualizar','Feedbacks'),('feedback.manage','Criar e editar','Feedbacks'),
 ('performance.view','Visualizar','Notas'),('performance.manage','Avaliar','Notas'),('review.manage','Gerenciar ciclos','Avaliação da Gestão'),('review.results','Resultados agregados','Avaliação da Gestão'),
 ('report.view','Visualizar','Relatórios'),('report.export','Exportar','Relatórios'),('user.view','Visualizar','Usuários'),('user.approve','Aprovar colaboradores','Usuários'),
 ('user.manage','Gerenciar acessos','Usuários'),('role.manage','Gerenciar','Cargos'),('audit.view','Visualizar','Auditoria'),('audit.security','Visualizar segurança','Auditoria'),
 ('calendar.manage','Configurar datas','Calendário'),('settings.manage','Configurar RH','Configurações'),('system.manage','Manutenção técnica','Sistema'),('files.manage','Gerenciar documentos','Documentos');
insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p where r.code='SUPER_ADMIN' or (r.code='MANAGER' and p.code not in ('user.manage','role.manage','audit.security','system.manage'));
insert into public.managers(full_name) values ('Rafaella Negrelli'),('Nícolas Martinez');
insert into public.justification_categories(name) values ('Atestado'),('Consulta'),('Emergência'),('Compromisso autorizado'),('Transporte'),('Questão familiar'),('Outra justificativa');
insert into public.performance_criteria(name,weight) values ('Responsabilidade',2),('Pontualidade',2),('Participação',1),('Comunicação',1),('Trabalho em equipe',1),('Comprometimento',1),('Organização',1),('Evolução',1),('Postura',1),('Entrega',1);
insert into public.manager_review_criteria(name) values ('Comunicação'),('Respeito'),('Organização'),('Clareza nas orientações'),('Disponibilidade'),('Capacidade de ouvir'),('Tratamento da equipe'),('Liderança'),('Resolução de problemas'),('Imparcialidade'),('Apoio ao desenvolvimento'),('Ambiente criado para a equipe'),('Nota geral');
insert into public.settings(key,value) values ('general','{"name":"Raízes do Futuro","timezone":"America/Sao_Paulo"}'),('lateness','{"light":10,"moderate":20}'),('maintenance','{"enabled":false,"allow_managers":false}');
insert into public.releases(version,changes) values ('1.0.0','Gestão de RH, chamada, avaliações, relatórios e administração.');
create function private.session_id() returns uuid language sql stable set search_path='' as $$ select nullif(auth.jwt()->>'session_id','')::uuid $$;
create function private.roles_for_current_user() returns text[] language sql stable security definer set search_path='' as $$ select coalesce(array_agg(r.code),'{}') from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.active and not r.archived $$;
create function private.is_privileged() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.active and not r.archived and r.privileged) $$;
create function private.session_valid() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions s where s.id=private.session_id() and s.user_id=auth.uid() and (s.not_after is null or s.not_after > now())) and not exists(select 1 from private.session_security x where x.session_id=private.session_id() and x.revoked_at is not null)
$$;
create function private.account_ready() returns boolean language sql stable security definer set search_path='' as $$
 select private.session_valid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active' and p.onboarded_at is not null and p.terms_accepted_at is not null)
 and (not private.is_privileged() or exists(select 1 from private.session_security s where s.session_id=private.session_id() and s.user_id=auth.uid() and s.verified_until > now() and s.revoked_at is null))
 and (not coalesce((select (value->>'enabled')::boolean from public.settings where key='maintenance'),false) or 'SUPER_ADMIN'=any(private.roles_for_current_user()) or (coalesce((select (value->>'allow_managers')::boolean from public.settings where key='maintenance'),false) and private.is_privileged()))
$$;
create function private.can(permission_code text) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_ready() and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id where ur.user_id=auth.uid() and r.active and not r.archived and p.code=permission_code)
$$;
create function private.owns_employee(employee uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.account_ready() and exists(select 1 from public.employees e where e.id=employee and e.profile_id=auth.uid()) $$;
create function private.require_permission(permission_code text) returns void language plpgsql security definer set search_path='' as $$ begin if not private.can(permission_code) then raise exception 'FORBIDDEN'; end if; end $$;
create function private.log(action_name text,module_name text,target uuid,before_value jsonb,after_value jsonb,event_name text default 'data_change',extra jsonb default '{}',ok boolean default true) returns void language sql security definer set search_path='' as $$
 insert into public.audit_logs(actor_user_id,actor_name,actor_roles,action,module,entity_id,old_values,new_values,event_type,context,success)
 select auth.uid(),(select full_name from public.profiles where id=auth.uid()),private.roles_for_current_user(),action_name,module_name,target,before_value,after_value,event_name,extra,ok
$$;
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
 declare old_doc jsonb; new_doc jsonb; identifier uuid; begin
 if tg_op <> 'INSERT' then old_doc=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then new_doc=to_jsonb(new); end if;
 identifier=coalesce((new_doc->>'id')::uuid,(old_doc->>'id')::uuid,(new_doc->>'user_id')::uuid,(old_doc->>'user_id')::uuid);
 perform private.log(lower(tg_op),tg_table_name,identifier,old_doc,new_doc,case when tg_table_name in ('roles','role_permissions','user_roles') then 'permission_change' else 'data_change' end,
 case when tg_table_name='attendance_members' then jsonb_build_object('maintenance_id',(select id from public.attendance_maintenance where session_id=coalesce((new_doc->>'session_id')::uuid,(old_doc->>'session_id')::uuid) and closed_at is null),'reason',(select reason from public.attendance_maintenance where session_id=coalesce((new_doc->>'session_id')::uuid,(old_doc->>'session_id')::uuid) and closed_at is null)) else '{}'::jsonb end);
 return coalesce(new,old); end
$$;
create function private.touch() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); new.version=old.version+1; return new; end $$;
create function private.deny_log_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'AUDIT_IMMUTABLE'; end $$;
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function private.deny_log_mutation();
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.profiles(id,full_name,email) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Novo cadastro'),160),new.email);
 insert into public.notifications(user_id,title,path) select ur.user_id,'Novo cadastro pendente','/usuarios' from public.user_roles ur join public.roles r on r.id=ur.role_id where r.code in ('SUPER_ADMIN','MANAGER');
 return new; end
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.create_profile();
create function private.business_now() returns timestamptz language sql stable set search_path='' as $$ select now() $$;
create function private.course_allowed(class_identifier uuid,day date) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classes where id=class_identifier and active) and coalesce((select c.has_course from public.course_calendar c where c.scheduled_date=day and (c.class_id=class_identifier or c.class_id is null) order by c.class_id nulls last limit 1),extract(isodow from day)=2)
$$;
create function private.normal_window(class_identifier uuid,day date) returns boolean language sql stable security definer set search_path='' as $$
 select day=(private.business_now() at time zone 'America/Sao_Paulo')::date and (private.business_now() at time zone 'America/Sao_Paulo')::time >= time '08:00' and (private.business_now() at time zone 'America/Sao_Paulo')::time < time '14:00' and private.course_allowed(class_identifier,day)
$$;
create function private.guard_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
 declare s public.attendance_sessions; begin
 if tg_op='DELETE' then raise exception 'SNAPSHOT_IMMUTABLE'; end if;
 select * into s from public.attendance_sessions where id=new.session_id;
 if tg_op='INSERT' and (s.original_member_count <> 0 or s.status <> 'editing' or current_user <> 'postgres') then raise exception 'SNAPSHOT_IMMUTABLE'; end if;
 if tg_op='UPDATE' then
 if (new.id,new.session_id,new.employee_id,new.full_name_snapshot,new.registration_snapshot,new.expected_arrival,new.expected_departure,new.created_at) is distinct from (old.id,old.session_id,old.employee_id,old.full_name_snapshot,old.registration_snapshot,old.expected_arrival,old.expected_departure,old.created_at) then raise exception 'SNAPSHOT_IMMUTABLE'; end if;
 if s.status='maintenance' then
 if not private.can('attendance.maintenance') or not exists(select 1 from public.attendance_maintenance where session_id=s.id and closed_at is null) then raise exception 'FORBIDDEN'; end if;
 elsif s.status <> 'editing' then raise exception 'INVALID_TRANSITION';
 elsif not private.normal_window(s.class_id,s.scheduled_date) then raise exception 'OUTSIDE_WINDOW';
 elsif not private.can('attendance.manage') then raise exception 'FORBIDDEN'; end if;
 end if; return new; end
$$;
create trigger attendance_snapshot_guard before insert or update or delete on public.attendance_members for each row execute function private.guard_snapshot();
DO $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t not in ('audit_logs','permissions','notifications','releases','performance_scores','manager_cycle_criteria','manager_cycle_targets') then execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function private.audit_change()',t,t); end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='version') then execute format('create trigger touch_%I before update on public.%I for each row execute function private.touch()',t,t); end if;
 end loop;
 for t in select tablename from pg_tables where schemaname='private' loop execute format('alter table private.%I enable row level security',t); end loop;
 end $$;
create policy profiles_read on public.profiles for select to authenticated using ((id=(select auth.uid()) and (select private.session_valid())) or (select private.can('user.view')));
create policy employees_read on public.employees for select to authenticated using ((select private.can('employee.view')) or private.owns_employee(id));
create policy admin_notes_read on public.employee_admin_notes for select to authenticated using ((select private.can('employee.view')));
create policy attendance_sessions_read on public.attendance_sessions for select to authenticated using ((select private.can('attendance.view')) or exists(select 1 from public.attendance_members m where m.session_id=id and private.owns_employee(m.employee_id)));
create policy attendance_members_read on public.attendance_members for select to authenticated using ((select private.can('attendance.view')) or private.owns_employee(employee_id));
create policy attendance_maintenance_read on public.attendance_maintenance for select to authenticated using ((select private.can('attendance.view')));
create policy justification_read on public.absence_justifications for select to authenticated using ((select private.can('justification.view')) or private.owns_employee(employee_id));
create policy feedback_read on public.feedbacks for select to authenticated using ((select private.can('feedback.view')) or (released and private.owns_employee(employee_id)));
create policy followups_read on public.feedback_followups for select to authenticated using (exists(select 1 from public.feedbacks f where f.id=feedback_id and ((select private.can('feedback.view')) or (f.released and private.owns_employee(f.employee_id)))));
create policy performance_read on public.performance_reviews for select to authenticated using ((select private.can('performance.view')) or (released and private.owns_employee(employee_id)));
create policy scores_read on public.performance_scores for select to authenticated using (exists(select 1 from public.performance_reviews r where r.id=review_id and ((select private.can('performance.view')) or (r.released and private.owns_employee(r.employee_id)))));
create policy notifications_read on public.notifications for select to authenticated using ((select private.account_ready()) and user_id=(select auth.uid()));
create policy audit_read on public.audit_logs for select to authenticated using ((select private.can('audit.security')) or ((select private.can('audit.view')) and event_type in ('data_change','export','attendance_maintenance') and module not in ('profiles','user_roles','roles','role_permissions','settings')));
create policy settings_read on public.settings for select to authenticated using ((select private.can('settings.manage')) or (key='lateness' and (select private.account_ready())));
create policy reports_read on public.reports for select to authenticated using ((select private.can('report.view')));
create policy exports_read on public.report_exports for select to authenticated using ((select private.can('report.view')));
create policy attachments_read on public.attachments for select to authenticated using ((select private.can('files.manage')) or (not archived and private.owns_employee(employee_id) and (feedback_id is null or exists(select 1 from public.feedbacks where id=feedback_id and released))));
create policy user_roles_read on public.user_roles for select to authenticated using ((select private.can('user.view')) or (select private.can('role.manage')) or ((select private.session_valid()) and user_id=(select auth.uid())));
create policy releases_read on public.releases for select to authenticated using ((select private.can('system.manage')));
DO $$ declare t text; begin foreach t in array array['roles','permissions','role_permissions','classes','departments','job_positions','managers','course_calendar','justification_categories','performance_cycles','performance_criteria','manager_review_criteria','manager_cycle_targets','manager_cycle_criteria','events'] loop execute format('create policy reference_read on public.%I for select to authenticated using ((select private.account_ready()))',t); end loop; end $$;
create policy manager_cycles_read on public.manager_review_cycles for select to authenticated using ((select private.can('review.manage')) or ((select private.account_ready()) and status in ('open','closed') and exists(select 1 from private.manager_review_eligibility e where e.cycle_id=id and e.user_id=auth.uid())));
create function private.review_eligible(cycle_identifier uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.account_ready() and exists(select 1 from private.manager_review_eligibility where cycle_id=cycle_identifier and user_id=auth.uid()) $$;
drop policy manager_cycles_read on public.manager_review_cycles;
create policy manager_cycles_read on public.manager_review_cycles for select to authenticated using ((select private.can('review.manage')) or (status in ('open','closed') and private.review_eligible(id)));
drop policy attendance_sessions_read on public.attendance_sessions;
