insert into public.permissions(code,name,module) values
('workspace.view','Acessar espaço do setor','Setores'),
('workspace.overview','Acompanhar todos os setores','Setores'),
('workspace.instructor','Acessar área do instrutor','Setores'),
('chat.use','Participar do chat','Chat'),
('chat.moderate','Moderar o chat','Chat') on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (p.code in ('workspace.view','chat.use') and r.code in ('SUPER_ADMIN','TI_ADMIN','DIRECTOR','MANAGER','INSTRUCTOR','COLLABORATOR'))
or (p.code in ('workspace.overview','chat.moderate') and r.code in ('SUPER_ADMIN','TI_ADMIN','DIRECTOR','MANAGER','INSTRUCTOR'))
or (r.code='INSTRUCTOR' and p.code in ('report.export','review.results'))
or (p.code='workspace.instructor' and r.code in ('INSTRUCTOR','SUPER_ADMIN','TI_ADMIN'))
on conflict do nothing;

create function private.workspace_allowed(department_identifier uuid) returns boolean language sql stable security definer set search_path='' as $$
select private.can('workspace.view') and exists(select 1 from public.departments d where d.id=department_identifier and d.active and (private.can('workspace.overview') or exists(select 1 from public.employees e where e.profile_id=auth.uid() and e.status='active' and e.department_id=d.id)))
$$;

create table public.sector_tasks (
id uuid primary key default gen_random_uuid(), department_id uuid not null references public.departments(id),
title text not null check(length(btrim(title)) between 3 and 140), description text not null default '' check(length(description)<=2000),
status text not null default 'todo' check(status in ('todo','doing','done','blocked')),
priority text not null default 'normal' check(priority in ('low','normal','high')), due_date date,
assigned_to uuid references public.profiles(id), created_by uuid not null references public.profiles(id),
created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create index sector_tasks_department on public.sector_tasks(department_id,updated_at desc);
create index sector_tasks_author on public.sector_tasks(created_by);
create index sector_tasks_assignee on public.sector_tasks(assigned_to) where assigned_to is not null;
alter table public.sector_tasks enable row level security;
revoke all on public.sector_tasks from public,anon,authenticated;
grant select on public.sector_tasks to authenticated;
grant all on public.sector_tasks to service_role;
create policy sector_tasks_read on public.sector_tasks for select to authenticated using(private.workspace_allowed(department_id));
create trigger sector_tasks_touch before update on public.sector_tasks for each row execute function private.touch();
create trigger sector_tasks_audit after insert or update or delete on public.sector_tasks for each row execute function private.audit_change();

create function private.workspace_snapshot(department_identifier uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare selected uuid; overview boolean; departments jsonb; members jsonb; tasks jsonb; department jsonb;
begin
perform private.require_permission('workspace.view');
overview:=private.can('workspace.overview');
select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'members',(select count(*) from public.employees e where e.department_id=d.id and e.status='active'),'open_tasks',(select count(*) from public.sector_tasks t where t.department_id=d.id and t.status<>'done')) order by d.name),'[]'::jsonb)
into departments from public.departments d where private.workspace_allowed(d.id);
selected:=department_identifier;
if selected is null then
select e.department_id into selected from public.employees e where e.profile_id=auth.uid() and e.status='active';
if overview and selected is null then selected:=(departments->0->>'id')::uuid; end if;
end if;
if selected is not null and not private.workspace_allowed(selected) then raise exception 'FORBIDDEN'; end if;
select jsonb_build_object('id',id,'name',name) into department from public.departments where id=selected;
select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'full_name',e.full_name,'status',e.status,'profile_id',e.profile_id,'account_active',exists(select 1 from public.profiles p where p.id=e.profile_id and p.status='active')) order by e.full_name),'[]'::jsonb) into members from public.employees e where e.department_id=selected and e.status='active';
select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb) into tasks from (select * from public.sector_tasks where department_id=selected order by updated_at desc limit 200) t;
return jsonb_build_object('viewer',auth.uid(),'overview',overview,'department',department,'departments',departments,'members',members,'tasks',tasks,'metrics',jsonb_build_object(
'active_members',jsonb_array_length(members),'open_tasks',(select count(*) from public.sector_tasks where department_id=selected and status<>'done'),'completed_tasks',(select count(*) from public.sector_tasks where department_id=selected and status='done'),
'attendance_records',case when overview then (select count(*) from public.attendance_members m join public.attendance_sessions s on s.id=m.session_id join public.employees e on e.id=m.employee_id where e.department_id=selected and s.scheduled_date>=current_date-30) else null end,
'pending_justifications',case when overview then (select count(*) from public.absence_justifications j join public.employees e on e.id=j.employee_id where e.department_id=selected and j.status='pending') else null end),'generated_at',now());
end;
$$;

create function private.save_sector_task(payload jsonb,expected_version integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare task public.sector_tasks; identifier uuid; department uuid; assignee uuid;
begin
perform private.require_permission('workspace.view');
identifier:=nullif(payload->>'id','')::uuid;
if identifier is not null then
select * into task from public.sector_tasks where id=identifier for update;
if not found or not private.workspace_allowed(task.department_id) or (not private.can('workspace.overview') and task.created_by<>auth.uid() and task.assigned_to is distinct from auth.uid()) then raise exception 'FORBIDDEN'; end if;
if expected_version is null or task.version<>expected_version then raise exception 'CONFLICT'; end if;
department:=task.department_id;
if payload ? 'department_id' and (payload->>'department_id')::uuid<>department then raise exception 'FORBIDDEN'; end if;
else
department:=(payload->>'department_id')::uuid;
if not private.workspace_allowed(department) then raise exception 'FORBIDDEN'; end if;
end if;
assignee:=case when payload ? 'assigned_to' then nullif(payload->>'assigned_to','')::uuid else task.assigned_to end;
if assignee is not null and not exists(select 1 from public.employees e join public.profiles p on p.id=e.profile_id where e.department_id=department and e.status='active' and p.status='active' and e.profile_id=assignee) then raise exception 'INVALID_ASSIGNEE'; end if;
if identifier is null then
insert into public.sector_tasks(department_id,title,description,status,priority,due_date,assigned_to,created_by)
values(department,btrim(payload->>'title'),coalesce(payload->>'description',''),coalesce(payload->>'status','todo'),coalesce(payload->>'priority','normal'),nullif(payload->>'due_date','')::date,assignee,auth.uid()) returning * into task;
else
update public.sector_tasks set title=case when payload ? 'title' then btrim(payload->>'title') else title end,description=coalesce(payload->>'description',description),status=coalesce(payload->>'status',status),priority=coalesce(payload->>'priority',priority),due_date=case when payload ? 'due_date' then nullif(payload->>'due_date','')::date else due_date end,assigned_to=assignee where id=identifier returning * into task;
end if;
return to_jsonb(task);
end;
$$;

create table public.chat_rooms (
id uuid primary key default gen_random_uuid(), department_id uuid references public.departments(id), name text not null,
active boolean not null default true, created_at timestamptz not null default now(), unique nulls not distinct(department_id)
);
insert into public.chat_rooms(department_id,name) values(null,'Conversa geral');
insert into public.chat_rooms(department_id,name,active) select id,name,active from public.departments;
create function private.sync_chat_department() returns trigger language plpgsql security definer set search_path='' as $$
begin
insert into public.chat_rooms(department_id,name,active) values(new.id,new.name,new.active) on conflict(department_id) do update set name=excluded.name,active=excluded.active;
return new;
end;
$$;
revoke all on function private.sync_chat_department() from public,anon,authenticated;
create trigger sync_chat_department after insert or update on public.departments for each row execute function private.sync_chat_department();
create function private.chat_room_allowed(room_identifier uuid) returns boolean language sql stable security definer set search_path='' as $$
select private.can('chat.use') and exists(select 1 from public.chat_rooms r where r.id=room_identifier and r.active and (r.department_id is null or private.workspace_allowed(r.department_id)))
$$;
create function private.chat_now() returns timestamptz language sql stable set search_path='' as $$ select now() $$;

create table public.chat_messages (
id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
room_id uuid not null references public.chat_rooms(id), author_id uuid not null references public.profiles(id), author_name text not null,
body text not null check(length(body)<=2000), filtered boolean not null default false,
request_id uuid not null, moderated_at timestamptz, moderated_by uuid references public.profiles(id), moderation_reason text,
created_at timestamptz not null default now(), unique(author_id,request_id)
);
create index chat_messages_room on public.chat_messages(room_id,sequence desc);
create index chat_messages_rate on public.chat_messages(author_id,created_at desc);
create index chat_messages_moderator on public.chat_messages(moderated_by) where moderated_by is not null;
create table public.chat_attachments (
id uuid primary key default gen_random_uuid(), room_id uuid not null references public.chat_rooms(id), owner_id uuid not null references public.profiles(id),
message_id uuid references public.chat_messages(id), path text not null unique, filename text not null check(length(filename) between 1 and 160),
mime_type text not null, size_bytes integer not null check(size_bytes between 1 and 10485760),
created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '1 hour')
);
create index chat_attachments_message on public.chat_attachments(message_id);
create index chat_attachments_room on public.chat_attachments(room_id);
create index chat_attachments_owner on public.chat_attachments(owner_id,created_at desc);
create table public.chat_reports (
id uuid primary key default gen_random_uuid(), message_id uuid not null references public.chat_messages(id), reporter_id uuid not null references public.profiles(id),
reason text not null check(length(btrim(reason)) between 3 and 1000), created_at timestamptz not null default now(),
resolved_at timestamptz, resolved_by uuid references public.profiles(id), resolution_reason text,
unique(message_id,reporter_id)
);
create index chat_reports_reporter on public.chat_reports(reporter_id);
create index chat_reports_resolver on public.chat_reports(resolved_by) where resolved_by is not null;

do $$ declare table_name text; begin
foreach table_name in array array['chat_rooms','chat_messages','chat_attachments','chat_reports'] loop
execute format('alter table public.%I enable row level security',table_name);
execute format('revoke all on public.%I from public,anon,authenticated',table_name);
execute format('grant select on public.%I to authenticated',table_name);
execute format('grant all on public.%I to service_role',table_name);
end loop;
end $$;
grant usage,select on sequence public.chat_messages_sequence_seq to service_role;
create policy chat_rooms_read on public.chat_rooms for select to authenticated using(private.chat_room_allowed(id));
create policy chat_messages_read on public.chat_messages for select to authenticated using(private.chat_room_allowed(room_id));
create policy chat_attachments_read on public.chat_attachments for select to authenticated using((select private.can('chat.use')) and ((owner_id=(select auth.uid()) and message_id is null) or (private.chat_room_allowed(room_id) and exists(select 1 from public.chat_messages m where m.id=message_id and m.moderated_at is null))));
create policy chat_reports_read on public.chat_reports for select to authenticated using((select private.can('chat.moderate')) and exists(select 1 from public.chat_messages m where m.id=message_id and private.chat_room_allowed(m.room_id)));


revoke all on function private.workspace_allowed(uuid),private.workspace_snapshot(uuid),private.save_sector_task(jsonb,integer),private.chat_room_allowed(uuid),private.chat_now() from public,anon,authenticated;
