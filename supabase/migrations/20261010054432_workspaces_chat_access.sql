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
