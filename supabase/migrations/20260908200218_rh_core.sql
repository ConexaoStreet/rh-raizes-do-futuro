create schema if not exists private;
revoke all on schema private from public;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

create table public.profiles (
 id uuid primary key references auth.users(id), full_name text not null check(length(full_name) between 2 and 160),
 email text not null, phone text, registration text, requested_class text,
 status text not null default 'pending' check(status in ('pending','active','suspended','inactive','blocked')),
 onboarded_at timestamptz, terms_accepted_at timestamptz, last_seen_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.roles (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, description text not null default '',
 level integer not null default 1 check(level between 1 and 100), scope text not null default 'organization' check(scope in ('organization','self')),
 privileged boolean not null default true, active boolean not null default true, archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.permissions (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, module text not null);
create table public.role_permissions (role_id uuid references public.roles(id), permission_id uuid references public.permissions(id), primary key(role_id,permission_id));
create table public.user_roles (user_id uuid references public.profiles(id), role_id uuid references public.roles(id), primary key(user_id,role_id));
create table public.classes (id uuid primary key default gen_random_uuid(), name text not null unique, code text not null unique, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.departments (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.job_positions (id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.managers (id uuid primary key default gen_random_uuid(), full_name text not null, profile_id uuid unique references public.profiles(id), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.employees (
 id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id), full_name text not null check(length(full_name) between 2 and 160), social_name text,
 email text, phone text, registration text not null unique, join_date date not null default current_date,
 class_id uuid references public.classes(id), department_id uuid references public.departments(id), job_position_id uuid references public.job_positions(id), manager_id uuid references public.managers(id),
 expected_arrival time not null default '08:00', expected_departure time not null default '14:00', status text not null default 'active' check(status in ('active','inactive')),
 photo_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 check(expected_departure > expected_arrival)
);
create table public.employee_admin_notes (id uuid primary key default gen_random_uuid(), employee_id uuid not null unique references public.employees(id), notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.course_calendar (
 id uuid primary key default gen_random_uuid(), class_id uuid references public.classes(id), scheduled_date date not null, has_course boolean not null default false,
 kind text not null check(kind in ('holiday','recess','cancelled','replacement','exception','normal')), reason text not null check(length(trim(reason)) >= 3),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique nulls not distinct(class_id,scheduled_date)
);
create table public.attendance_sessions (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id), scheduled_date date not null,
 status text not null default 'editing' check(status in ('editing','finalized','maintenance','closed')),
 original_member_count integer not null default 0, opened_by uuid not null references public.profiles(id), opened_at timestamptz not null default now(),
 finalized_by uuid references public.profiles(id), finalized_at timestamptz, finalization_reason text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, unique(class_id,scheduled_date)
);
create table public.attendance_members (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.attendance_sessions(id), employee_id uuid not null references public.employees(id),
 full_name_snapshot text not null, registration_snapshot text not null, expected_arrival time not null, expected_departure time not null,
 status text not null default 'pending' check(status in ('pending','present','absent','justified','late','early_exit','occurrence')),
 actual_arrival time, actual_departure time, notes text not null default '',
 delay_minutes integer generated always as (greatest(0,(extract(epoch from (actual_arrival-expected_arrival))/60)::integer)) stored,
 early_minutes integer generated always as (greatest(0,(extract(epoch from (expected_departure-actual_departure))/60)::integer)) stored,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(session_id,employee_id), check(status <> 'late' or actual_arrival is not null), check(status <> 'early_exit' or actual_departure is not null)
);
create table public.attendance_maintenance (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.attendance_sessions(id), opened_by uuid not null references public.profiles(id),
 opened_at timestamptz not null default now(), reason text not null check(length(trim(reason)) >= 3), closed_by uuid references public.profiles(id), closed_at timestamptz
);
create unique index one_open_maintenance on public.attendance_maintenance(session_id) where closed_at is null;
create table public.justification_categories (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.absence_justifications (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.attendance_members(id), employee_id uuid not null references public.employees(id), category_id uuid references public.justification_categories(id),
 reason text not null check(length(trim(reason)) >= 3), status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 review_comment text, reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.feedbacks (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id), author_id uuid not null default auth.uid() references public.profiles(id),
 title text not null check(length(title) >= 3), kind text not null check(kind in ('positive','development','alignment','recognition','guidance','formal','other')),
 description text not null, strengths text not null default '', improvements text not null default '', actions text not null default '', due_date date,
 status text not null default 'open' check(status in ('open','following','completed','archived')), released boolean not null default false, allow_response boolean not null default true,
 read_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.feedback_followups (
 id uuid primary key default gen_random_uuid(), feedback_id uuid not null references public.feedbacks(id), author_id uuid not null default auth.uid() references public.profiles(id),
 body text not null check(length(trim(body)) >= 1), created_at timestamptz not null default now()
);
create table public.performance_cycles (
 id uuid primary key default gen_random_uuid(), title text not null, start_date date not null, end_date date not null,
 status text not null default 'draft' check(status in ('draft','scheduled','open','closed','archived')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, check(end_date >= start_date)
);
create table public.performance_criteria (
 id uuid primary key default gen_random_uuid(), name text not null unique, weight numeric not null default 1 check(weight > 0 and weight <= 100), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.performance_reviews (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id), cycle_id uuid not null references public.performance_cycles(id),
 reviewer_id uuid not null default auth.uid() references public.profiles(id), notes text not null default '', released boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, unique(employee_id,cycle_id)
);
create table public.performance_scores (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references public.performance_reviews(id), criterion_id uuid not null references public.performance_criteria(id),
 criterion_name text not null, score numeric not null check(score between 0 and 10), weight numeric not null check(weight > 0 and weight <= 100), unique(review_id,criterion_id)
);
create table public.manager_review_cycles (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '', start_date date not null, end_date date not null,
 status text not null default 'draft' check(status in ('draft','scheduled','open','closed','archived')),
 minimum_responses integer not null default 5 check(minimum_responses >= 5),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, check(end_date >= start_date)
);
create table public.manager_review_criteria (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.manager_cycle_targets (cycle_id uuid references public.manager_review_cycles(id), manager_id uuid references public.managers(id), primary key(cycle_id,manager_id));
create table public.manager_cycle_criteria (cycle_id uuid references public.manager_review_cycles(id), criterion_id uuid references public.manager_review_criteria(id), name_snapshot text not null, primary key(cycle_id,criterion_id));
create table private.manager_review_eligibility (
 cycle_id uuid not null, manager_id uuid not null, user_id uuid not null references public.profiles(id), used boolean not null default false,
 primary key(cycle_id,manager_id,user_id), foreign key(cycle_id,manager_id) references public.manager_cycle_targets(cycle_id,manager_id)
);
create table private.anonymous_manager_reviews (
 id uuid primary key default gen_random_uuid(), cycle_id uuid not null, manager_id uuid not null, scores jsonb not null,
 strengths text not null default '', improvements text not null default '', message text not null default '',
 foreign key(cycle_id,manager_id) references public.manager_cycle_targets(cycle_id,manager_id),
 check(length(strengths) <= 1500 and length(improvements) <= 1500 and length(message) <= 1500)
);
create table public.events (id uuid primary key default gen_random_uuid(), title text not null, event_date date not null, class_id uuid references public.classes(id), description text not null default '', status text not null default 'open' check(status in ('open','completed','cancelled')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), title text not null, body text not null default '', path text not null default '/', read_at timestamptz, created_at timestamptz not null default now());
create table public.reports (id uuid primary key default gen_random_uuid(), title text not null, kind text not null, period_start date not null, period_end date not null, employee_id uuid references public.employees(id), class_id uuid references public.classes(id), created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), check(period_end >= period_start));
create table public.report_exports (id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id), format text not null check(format in ('pdf','pptx','xlsx','csv','png')), path text not null, created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now());
create table public.attachments (
 id uuid primary key default gen_random_uuid(), employee_id uuid references public.employees(id), justification_id uuid references public.absence_justifications(id), feedback_id uuid references public.feedbacks(id),
 bucket text not null check(bucket in ('justifications','medical-certificates','documents','feedback-files','exports','institutional-images')), path text not null unique, filename text not null,
 size_bytes integer not null check(size_bytes between 1 and 10485760), mime_type text not null, created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), archived boolean not null default false
);
create table public.settings (id uuid primary key default gen_random_uuid(), key text not null unique, value jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), event_type text not null default 'data_change', severity text not null default 'info', actor_user_id uuid, actor_name text, actor_roles text[],
 action text not null, module text not null, entity_id uuid, old_values jsonb, new_values jsonb, context jsonb not null default '{}', success boolean not null default true, created_at timestamptz not null default now()
);
create table public.releases (id uuid primary key default gen_random_uuid(), version text not null unique, changes text not null, created_at timestamptz not null default now());
create table private.session_security (session_id uuid primary key, user_id uuid not null references public.profiles(id), verified_until timestamptz, revoked_at timestamptz, created_at timestamptz not null default now());
create table private.otp_challenges (id uuid primary key default gen_random_uuid(), session_id uuid not null, user_id uuid not null references public.profiles(id), code_hash text not null, expires_at timestamptz not null, attempts integer not null default 0, consumed_at timestamptz, created_at timestamptz not null default now());
create index otp_rate_window on private.otp_challenges(user_id,created_at desc);
create index session_security_user on private.session_security(user_id);
create index attendance_members_employee on public.attendance_members(employee_id,session_id);
create index attendance_sessions_date on public.attendance_sessions(scheduled_date desc,class_id);
create index employees_class_status on public.employees(class_id,status,full_name);
create index feedbacks_employee_created on public.feedbacks(employee_id,created_at desc);
create index feedback_followups_parent on public.feedback_followups(feedback_id,created_at);
create index justifications_employee on public.absence_justifications(employee_id,status);
create index justifications_member on public.absence_justifications(member_id);
create index review_scores_parent on public.performance_scores(review_id);
create index performance_reviews_cycle on public.performance_reviews(cycle_id);
create index notification_owner on public.notifications(user_id,created_at desc);
create index audit_created on public.audit_logs(created_at desc);
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
