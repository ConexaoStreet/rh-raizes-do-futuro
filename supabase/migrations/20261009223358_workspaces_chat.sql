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

create function private.chat_filter(body text) returns text language plpgsql immutable set search_path='' as $$
declare normalized text;
begin
normalized:=regexp_replace(translate(lower(body),'áàâãäéèêëíìîïóòôõöúùûüç013457','aaaaaeeeeiiiiooooouuuucoieast'),'[^a-z ]','','g');
if normalized ~ '\y(porra|caralho|merda|puta|puto|foda|foder|fodase|buceta|cacete|arrombado|arrombada|piranha)\y'
or lower(body) ~ '\y(p[^[:alnum:]]*o[^[:alnum:]]*r[^[:alnum:]]*r[^[:alnum:]]*a|c[^[:alnum:]]*a[^[:alnum:]]*r[^[:alnum:]]*a[^[:alnum:]]*l[^[:alnum:]]*h[^[:alnum:]]*o)\y'
then return '[Mensagem filtrada por linguagem inadequada]'; end if;
return body;
end;
$$;

create function private.chat_rooms_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
perform private.require_permission('chat.use');
return jsonb_build_object('viewer',auth.uid(),'moderator',private.can('chat.moderate'),'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'department_id',r.department_id,'name',r.name) order by r.department_id nulls first,r.name) from public.chat_rooms r where private.chat_room_allowed(r.id)),'[]'::jsonb));
end;
$$;
create function private.chat_message_payload(message public.chat_messages) returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object('id',message.id,'sequence',message.sequence,'room_id',message.room_id,'author_id',message.author_id,'author_name',message.author_name,'body',case when message.moderated_at is null then message.body else 'Mensagem removida pela moderação.' end,'filtered',message.filtered,'moderated',message.moderated_at is not null,'created_at',message.created_at,'attachments',case when message.moderated_at is null then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'path',a.path,'filename',a.filename,'size_bytes',a.size_bytes,'mime_type',a.mime_type) order by a.created_at) from public.chat_attachments a where a.message_id=message.id),'[]'::jsonb) else '[]'::jsonb end)
$$;
create function private.chat_history(room_identifier uuid,before_sequence bigint default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare messages jsonb;
begin
if not private.chat_room_allowed(room_identifier) then raise exception 'FORBIDDEN'; end if;
select coalesce(jsonb_agg(private.chat_message_payload(m) order by m.sequence desc),'[]'::jsonb)
into messages from (select * from public.chat_messages where room_id=room_identifier and (before_sequence is null or sequence<before_sequence) order by sequence desc limit 30) m;
return jsonb_build_object('viewer',auth.uid(),'room_id',room_identifier,'messages',messages,'has_more',jsonb_array_length(messages)=30);
end;
$$;

create function private.reserve_chat_attachment(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare room uuid; filename text; mime text; size integer; extension text; attachment public.chat_attachments; allowed boolean;
begin
room:=(payload->>'room_id')::uuid;
if not private.chat_room_allowed(room) then raise exception 'FORBIDDEN'; end if;
filename:=btrim(payload->>'filename'); mime:=payload->>'mime_type'; size:=(payload->>'size_bytes')::integer;
extension:=lower(substring(filename from '\.([^.]+)$'));
allowed:=case extension when 'pdf' then mime='application/pdf' when 'jpg' then mime='image/jpeg' when 'jpeg' then mime='image/jpeg' when 'png' then mime='image/png' when 'webp' then mime='image/webp' when 'xlsx' then mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' when 'csv' then mime in ('text/csv','application/vnd.ms-excel') when 'docx' then mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document' when 'txt' then mime='text/plain' else false end;
if filename is null or length(filename) not between 1 and 160 or filename ~ '[[:cntrl:]/\\]' or size is null or size not between 1 and 10485760 or allowed is distinct from true then raise exception 'INVALID_FILE'; end if;
perform 1 from public.profiles where id=auth.uid() for update;
if (select count(*) from public.chat_attachments where owner_id=auth.uid() and message_id is null and expires_at>now())>=8 then raise exception 'ATTACHMENT_LIMIT'; end if;
attachment.id:=gen_random_uuid();
insert into public.chat_attachments(id,room_id,owner_id,path,filename,mime_type,size_bytes)
values(attachment.id,room,auth.uid(),room::text||'/'||auth.uid()::text||'/'||attachment.id::text||'.'||extension,filename,mime,size) returning * into attachment;
return to_jsonb(attachment);
end;
$$;

create function private.send_chat_message(room_identifier uuid,body text,attachment_identifiers uuid[] default '{}',request_identifier uuid default gen_random_uuid()) returns jsonb language plpgsql security definer set search_path='' as $$
declare message public.chat_messages; clean text; author text; expected integer;
begin
if not private.chat_room_allowed(room_identifier) then raise exception 'FORBIDDEN'; end if;
if request_identifier is null then raise exception 'INVALID_MESSAGE'; end if;
perform 1 from public.profiles where id=auth.uid() for update;
select * into message from public.chat_messages where author_id=auth.uid() and request_id=request_identifier;
if found then
if message.room_id<>room_identifier then raise exception 'INVALID_MESSAGE'; end if;
return private.chat_message_payload(message);
end if;
expected:=coalesce(cardinality(attachment_identifiers),0);
if body is null or length(btrim(body))>2000 or (length(btrim(body))=0 and expected=0) or expected>3 or (select count(distinct a) from unnest(attachment_identifiers) a)<>expected then raise exception 'INVALID_MESSAGE'; end if;
if exists(select 1 from public.chat_messages where author_id=auth.uid() and created_at>private.chat_now()-interval '2 seconds') or (select count(*) from public.chat_messages where author_id=auth.uid() and created_at>private.chat_now()-interval '1 minute')>=10 then raise exception 'RATE_LIMIT'; end if;
perform 1 from public.chat_attachments where id=any(attachment_identifiers) and owner_id=auth.uid() and room_id=room_identifier order by id for update;
if expected<>(select count(*) from public.chat_attachments a where a.id=any(attachment_identifiers) and a.owner_id=auth.uid() and a.room_id=room_identifier and a.message_id is null and a.expires_at>now() and exists(select 1 from storage.objects o where o.bucket_id='chat-files' and o.name=a.path and (to_jsonb(o)->'metadata'->>'size')::bigint=a.size_bytes and to_jsonb(o)->'metadata'->>'mimetype'=a.mime_type)) then raise exception 'INVALID_ATTACHMENT'; end if;
clean:=private.chat_filter(btrim(body));
select full_name into author from public.profiles where id=auth.uid();
insert into public.chat_messages(room_id,author_id,author_name,body,filtered,request_id,created_at)
values(room_identifier,auth.uid(),author,clean,clean<>btrim(body),request_identifier,private.chat_now()) returning * into message;
update public.chat_attachments set message_id=message.id where id=any(attachment_identifiers);
return private.chat_message_payload(message);
end;
$$;

create function private.report_chat_message(message_identifier uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare room uuid;
begin
select room_id into room from public.chat_messages where id=message_identifier;
if not private.chat_room_allowed(room) then raise exception 'FORBIDDEN'; end if;
insert into public.chat_reports(message_id,reporter_id,reason) values(message_identifier,auth.uid(),btrim(reason)) on conflict(message_id,reporter_id) do update set reason=excluded.reason,resolved_at=null,resolved_by=null,resolution_reason=null;
end;
$$;
create function private.moderate_chat_message(message_identifier uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare room uuid;
begin
perform private.require_permission('chat.moderate');
select room_id into room from public.chat_messages where id=message_identifier for update;
if not private.chat_room_allowed(room) then raise exception 'FORBIDDEN'; end if;
if length(btrim(reason))<3 or reason is null or length(reason)>1000 then raise exception 'REASON_REQUIRED'; end if;
update public.chat_messages set body='Mensagem removida pela moderação.',moderated_at=now(),moderated_by=auth.uid(),moderation_reason=btrim(reason) where id=message_identifier;
update public.chat_reports set resolved_at=now(),resolved_by=auth.uid(),resolution_reason=btrim(moderate_chat_message.reason) where message_id=message_identifier and resolved_at is null;
perform private.log('moderate','chat_messages',message_identifier,null,jsonb_build_object('reason',reason),'data_change');
end;
$$;
create function private.chat_reports_queue(room_identifier uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
perform private.require_permission('chat.moderate');
if not private.chat_room_allowed(room_identifier) then raise exception 'FORBIDDEN'; end if;
return jsonb_build_object('viewer',auth.uid(),'room_id',room_identifier,'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'reason',r.reason,'created_at',r.created_at,'message',private.chat_message_payload(m)) order by r.created_at) from public.chat_reports r join public.chat_messages m on m.id=r.message_id where m.room_id=room_identifier and r.resolved_at is null),'[]'::jsonb));
end;
$$;
create function private.dismiss_chat_report(report_identifier uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare room uuid;
begin
perform private.require_permission('chat.moderate');
select m.room_id into room from public.chat_reports r join public.chat_messages m on m.id=r.message_id where r.id=report_identifier for update of r;
if not private.chat_room_allowed(room) then raise exception 'FORBIDDEN'; end if;
if reason is null or length(btrim(reason))<3 or length(reason)>1000 then raise exception 'REASON_REQUIRED'; end if;
update public.chat_reports set resolved_at=now(),resolved_by=auth.uid(),resolution_reason=btrim(dismiss_chat_report.reason) where id=report_identifier;
perform private.log('review_report','chat_reports',report_identifier,null,jsonb_build_object('reason',reason),'data_change');
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chat-files','chat-files',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
create function private.chat_file_allowed(file_path text,operation text) returns boolean language sql stable security definer set search_path='' as $$
select private.can('chat.use') and exists(select 1 from public.chat_attachments a where a.path=file_path and
case operation when 'upload' then private.chat_room_allowed(a.room_id) and a.owner_id=auth.uid() and a.message_id is null and a.expires_at>now()
when 'delete' then a.owner_id=auth.uid() and a.message_id is null
when 'read' then (a.owner_id=auth.uid() and a.message_id is null) or (private.chat_room_allowed(a.room_id) and exists(select 1 from public.chat_messages m where m.id=a.message_id and m.moderated_at is null))
else false end)
$$;
grant delete on storage.objects to authenticated;
create function private.chat_file_mutation_allowed(file_path text,operation text) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare attachment public.chat_attachments;
begin
if not private.can('chat.use') then return false; end if;
select * into attachment from public.chat_attachments where path=file_path and owner_id=auth.uid() for update;
if not found or attachment.message_id is not null then return false; end if;
if operation='upload' then return private.chat_room_allowed(attachment.room_id) and attachment.expires_at>now(); end if;
return operation='delete';
end;
$$;
create policy chat_files_insert on storage.objects for insert to authenticated with check(bucket_id='chat-files' and private.chat_file_mutation_allowed(name,'upload'));
create policy chat_files_read on storage.objects for select to authenticated using(bucket_id='chat-files' and private.chat_file_allowed(name,'read'));
create policy chat_files_delete on storage.objects for delete to authenticated using(bucket_id='chat-files' and private.chat_file_mutation_allowed(name,'delete'));
create function private.discard_chat_attachment(attachment_identifier uuid) returns void language plpgsql security definer set search_path='' as $$
declare attachment public.chat_attachments;
begin
select * into attachment from public.chat_attachments where id=attachment_identifier for update;
if not found or not private.can('chat.use') or attachment.owner_id<>auth.uid() or attachment.message_id is not null then raise exception 'FORBIDDEN'; end if;
if exists(select 1 from storage.objects where bucket_id='chat-files' and name=attachment.path) then raise exception 'FILE_STILL_PRESENT'; end if;
delete from public.chat_attachments where id=attachment.id;
end;
$$;

create policy instructor_attachments_read on public.attachments for select to authenticated using((select private.can('workspace.overview')) and not archived);
create policy instructor_files_read on storage.objects for select to authenticated using((select private.can('workspace.overview')) and exists(select 1 from public.attachments a where a.bucket=bucket_id and a.path=name and not a.archived));
create policy instructor_review_cycles_read on public.manager_review_cycles for select to authenticated using((select private.can('workspace.overview')));

do $$ declare fn record; names text; begin
for fn in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) signature,pg_get_function_arguments(p.oid) arguments,pg_get_function_result(p.oid) result from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('workspace_snapshot','save_sector_task','chat_rooms_snapshot','chat_history','reserve_chat_attachment','send_chat_message','report_chat_message','moderate_chat_message','discard_chat_attachment','chat_reports_queue','dismiss_chat_report') loop
select string_agg(format('%I',arg),',') into names from unnest((select proargnames from pg_proc where oid=fn.oid)) arg;
execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as %L',fn.proname,fn.arguments,fn.result,format('select private.%I(%s)',fn.proname,names));
execute format('revoke all on function private.%I(%s),public.%I(%s) from public,anon,authenticated',fn.proname,fn.signature,fn.proname,fn.signature);
execute format('grant execute on function private.%I(%s),public.%I(%s) to authenticated',fn.proname,fn.signature,fn.proname,fn.signature);
end loop;
end $$;
revoke all on function private.workspace_allowed(uuid),private.chat_room_allowed(uuid),private.chat_file_allowed(text,text),private.chat_file_mutation_allowed(text,text),private.chat_filter(text),private.chat_now() from public,anon,authenticated;
grant execute on function private.workspace_allowed(uuid),private.chat_room_allowed(uuid),private.chat_file_allowed(text,text),private.chat_file_mutation_allowed(text,text) to authenticated;
do $$ declare table_name text; begin
foreach table_name in array array['chat_messages','sector_tasks'] loop
if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then execute format('alter publication supabase_realtime add table public.%I',table_name); end if;
end loop;
end $$;
