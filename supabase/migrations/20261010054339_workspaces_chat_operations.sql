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


revoke all on function private.chat_filter(text),private.chat_rooms_snapshot(),private.chat_message_payload(public.chat_messages),private.chat_history(uuid,bigint),private.reserve_chat_attachment(jsonb),private.send_chat_message(uuid,text,uuid[],uuid),private.report_chat_message(uuid,text),private.moderate_chat_message(uuid,text),private.chat_reports_queue(uuid),private.dismiss_chat_report(uuid,text) from public,anon,authenticated;
