create table public.site_maintenance (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  title text not null default 'O site está em manutenção',
  message text not null default '',
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.site_updates (
  sequence bigint generated always as identity primary key,
  pack integer not null check (pack > 0),
  kind text not null default 'progress' check (kind in ('progress','release')),
  status text not null default 'working' check (status in ('planned','working','verifying','published','blocked')),
  title text not null check (length(btrim(title)) between 1 and 140),
  body text not null check (length(btrim(body)) between 1 and 1200),
  release_tag text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_maintenance enable row level security;
alter table public.site_updates enable row level security;
revoke all on public.site_maintenance, public.site_updates from public, anon, authenticated;
grant select on public.site_maintenance, public.site_updates to anon, authenticated;
grant all on public.site_maintenance, public.site_updates to service_role;
grant usage, select on sequence public.site_updates_sequence_seq to service_role;
create policy site_maintenance_public_read on public.site_maintenance for select to anon, authenticated using (true);
create policy site_updates_public_read on public.site_updates for select to anon, authenticated using (true);

create function private.sync_public_maintenance() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.site_maintenance(id,enabled,title,message,started_at,updated_at)
  values(true,coalesce((new.value->>'enabled')::boolean,false),coalesce(nullif(new.value->>'title',''),'O site está em manutenção'),coalesce(new.value->>'message',''),nullif(new.value->>'started_at','')::timestamptz,now())
  on conflict(id) do update set enabled=excluded.enabled,title=excluded.title,message=excluded.message,started_at=excluded.started_at,updated_at=excluded.updated_at;
  return new;
end;
$$;
revoke all on function private.sync_public_maintenance() from public, anon, authenticated;
create trigger sync_public_maintenance after insert or update on public.settings for each row when (new.key='maintenance') execute function private.sync_public_maintenance();

insert into public.site_maintenance(id,enabled,title,message,started_at)
select true,coalesce((value->>'enabled')::boolean,false),coalesce(nullif(value->>'title',''),'O site está em manutenção'),coalesce(value->>'message',''),nullif(value->>'started_at','')::timestamptz from public.settings where key='maintenance';

create function public.site_status() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
  'maintenance',coalesce((select jsonb_build_object('enabled',enabled,'title',title,'message',message,'started_at',started_at,'updated_at',updated_at) from public.site_maintenance where id=true),'{}'::jsonb),
  'updates',coalesce((select jsonb_agg(to_jsonb(u) order by sequence desc) from (select sequence,pack,kind,status,title,body,release_tag,created_at,updated_at from public.site_updates order by sequence desc limit 60) u),'[]'::jsonb),
  'server_time',now()
);
$$;
revoke all on function public.site_status() from public;
grant execute on function public.site_status() to anon, authenticated, service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array['site_maintenance','site_updates'] loop
    if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end;
$$;
