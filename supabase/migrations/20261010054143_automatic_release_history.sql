alter table public.site_updates add column release_commit text check(release_commit is null or release_commit ~ '^[a-f0-9]{40}$');
create unique index site_updates_release_commit_unique on public.site_updates(release_commit) where release_commit is not null;
create table private.release_monitor (
  id boolean primary key default true check(id),
  request_id bigint,
  requested_at timestamptz,
  checked_at timestamptz,
  last_seen_commit text,
  last_error text
);
alter table private.release_monitor enable row level security;
revoke all on private.release_monitor from public,anon,authenticated;
insert into private.release_monitor(id) values(true);

create function private.record_site_release(payload jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare version_name text; commit_hash text; pack_number integer; publication timestamptz; description text; recorded bigint;
begin
if jsonb_typeof(payload) is distinct from 'object' then return false; end if;
version_name:=payload->>'version'; commit_hash:=payload->>'commit';
if version_name is null or version_name !~ '^[a-zA-Z0-9.+-]{1,80}$' or commit_hash is null or commit_hash !~ '^[a-f0-9]{40}$' or coalesce(payload->>'pack','') !~ '^[1-9][0-9]{0,3}$' or jsonb_typeof(payload->'changes') is distinct from 'array' then return false; end if;
if jsonb_array_length(payload->'changes') not between 1 and 8 then return false; end if;
if exists(select 1 from jsonb_array_elements(payload->'changes') change where jsonb_typeof(change)<>'string' or length(btrim(change#>>'{}')) not between 3 and 240) then return false; end if;
pack_number:=(payload->>'pack')::integer;
begin publication:=(payload->>'published_at')::timestamptz; exception when others then return false; end;
if publication is null or not isfinite(publication) or publication>now()+interval '1 day' then return false; end if;
select string_agg(btrim(change#>>'{}'),' ' order by position) into description from jsonb_array_elements(payload->'changes') with ordinality changes(change,position);
if length(description) not between 3 and 1200 then return false; end if;
insert into public.site_updates(pack,kind,status,title,body,release_tag,release_commit)
values(pack_number,'release','published','Versão '||version_name||' publicada',description,version_name,commit_hash)
on conflict do nothing returning sequence into recorded;
if recorded is null then return false; end if;
update private.release_monitor set last_seen_commit=commit_hash where id=true;
return true;
end;
$$;

create function private.poll_site_release() returns void language plpgsql security definer set search_path='' as $$
declare monitor private.release_monitor; response record; payload jsonb; queued bigint;
begin
select * into monitor from private.release_monitor where id=true for update;
if monitor.request_id is not null then
select status_code,content,timed_out,error_msg into response from net._http_response where id=monitor.request_id;
if not found and monitor.requested_at>now()-interval '2 minutes' then return; end if;
if found and response.status_code=200 and not coalesce(response.timed_out,false) then
begin
payload:=response.content::jsonb;
perform private.record_site_release(payload);
update private.release_monitor set last_error=null where id=true;
exception when others then update private.release_monitor set last_error='Não foi possível ler a versão publicada.' where id=true;
end;
else
update private.release_monitor set last_error='A consulta da versão será tentada novamente.' where id=true;
end if;
end if;
select net.http_get(url:='https://rh-raizes-do-futuro.vercel.app/release.json',headers:='{"Cache-Control":"no-cache"}'::jsonb,timeout_milliseconds:=5000) into queued;
update private.release_monitor set request_id=queued,requested_at=now(),checked_at=now() where id=true;
end;
$$;
revoke all on function private.record_site_release(jsonb),private.poll_site_release() from public,anon,authenticated;

do $$
begin
if exists(select 1 from pg_available_extensions where name='pg_cron') then
if not exists(select 1 from pg_extension where extname='pg_cron') then execute 'create extension pg_cron'; end if;
if not exists(select 1 from cron.job where jobname='raizes-public-release-history') then perform cron.schedule('raizes-public-release-history','*/5 * * * *','select private.poll_site_release()'); end if;
end if;
end;
$$;
