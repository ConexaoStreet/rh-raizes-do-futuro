create schema if not exists private;

create table if not exists private.ti_access_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claim_hash text,
  claim_fingerprint text
);

create table if not exists private.ti_access_code_attempts (
  id bigint generated always as identity primary key,
  fingerprint_hash text not null,
  success boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists ti_access_codes_user_active_idx
  on private.ti_access_codes(user_id, expires_at)
  where used_at is null;

create index if not exists ti_access_code_attempts_fingerprint_idx
  on private.ti_access_code_attempts(fingerprint_hash, attempted_at desc);

alter table private.ti_access_codes enable row level security;
alter table private.ti_access_code_attempts enable row level security;

revoke all on table private.ti_access_codes from public, anon, authenticated;
revoke all on table private.ti_access_code_attempts from public, anon, authenticated;

create or replace function private.rotate_ti_access_codes(target_user uuid)
returns table(access_code text, valid_until timestamptz)
language plpgsql
security definer
set search_path=''
as $function$
declare
  new_batch uuid := gen_random_uuid();
  expiry timestamptz;
  raw_code text;
  formatted_code text;
  i integer;
begin
  if target_user is null or not exists(
    select 1 from auth.users u where u.id=target_user
  ) then
    raise exception 'INVALID_USER';
  end if;

  expiry := (
    date_trunc('week', now() at time zone 'America/Sao_Paulo')
    + interval '8 days 8 hours'
  ) at time zone 'America/Sao_Paulo';

  update private.ti_access_codes c
  set expires_at=least(c.expires_at, now())
  where c.user_id=target_user
    and c.used_at is null
    and c.expires_at > now();

  for i in 1..5 loop
    raw_code := 'RF' || upper(encode(extensions.gen_random_bytes(10),'hex'));
    formatted_code :=
      substr(raw_code,1,4) || '-' ||
      substr(raw_code,5,4) || '-' ||
      substr(raw_code,9,4) || '-' ||
      substr(raw_code,13,4) || '-' ||
      substr(raw_code,17,4) || '-' ||
      substr(raw_code,21,2);

    insert into private.ti_access_codes(
      user_id,batch_id,code_hash,expires_at
    )
    values(
      target_user,
      new_batch,
      extensions.crypt(
        upper(regexp_replace(formatted_code,'[^A-Z0-9]','','g')),
        extensions.gen_salt('bf',12)
      ),
      expiry
    );

    access_code := formatted_code;
    valid_until := expiry;
    return next;
  end loop;

  delete from private.ti_access_code_attempts
  where attempted_at < now() - interval '7 days';
end
$function$;

create or replace function public.claim_ti_access_code(input_code text, fingerprint_hash text, claim_hash text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  normalized text := upper(regexp_replace(coalesce(input_code,''),'[^A-Z0-9]','','g'));
  matched private.ti_access_codes%rowtype;
  recent_attempts integer;
begin
  if length(coalesce(fingerprint_hash,'')) < 16
     or length(coalesce(claim_hash,'')) < 32 then
    raise exception 'INVALID_REQUEST';
  end if;

  select count(*) into recent_attempts
  from private.ti_access_code_attempts a
  where a.fingerprint_hash=claim_ti_access_code.fingerprint_hash
    and a.attempted_at > now() - interval '15 minutes';

  if recent_attempts >= 10 then
    raise exception 'RATE_LIMITED';
  end if;

  if length(normalized) <> 22 or left(normalized,2) <> 'RF' then
    insert into private.ti_access_code_attempts(fingerprint_hash,success)
    values(claim_ti_access_code.fingerprint_hash,false);
    raise exception 'INVALID_CODE';
  end if;

  select c.*
  into matched
  from private.ti_access_codes c
  where c.used_at is null
    and c.expires_at > now()
    and (
      c.claimed_at is null
      or c.claimed_at < now() - interval '5 minutes'
      or c.claim_fingerprint=claim_ti_access_code.fingerprint_hash
    )
    and extensions.crypt(normalized,c.code_hash)=c.code_hash
  order by c.created_at desc
  limit 1
  for update skip locked;

  if matched.id is null then
    insert into private.ti_access_code_attempts(fingerprint_hash,success)
    values(claim_ti_access_code.fingerprint_hash,false);
    raise exception 'INVALID_CODE';
  end if;

  update private.ti_access_codes
  set claimed_at=now(),
      claim_hash=claim_ti_access_code.claim_hash,
      claim_fingerprint=claim_ti_access_code.fingerprint_hash
  where id=matched.id;

  insert into private.ti_access_code_attempts(fingerprint_hash,success)
  values(claim_ti_access_code.fingerprint_hash,true);

  return jsonb_build_object(
    'code_id',matched.id,
    'user_id',matched.user_id,
    'expires_at',matched.expires_at
  );
end
$function$;

create or replace function public.confirm_ti_access_code_session(code_identifier uuid, user_identifier uuid, session_identifier uuid, claim_token text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
begin
  if length(coalesce(claim_token,'')) < 32 then
    raise exception 'INVALID_CLAIM';
  end if;

  if not exists(
    select 1
    from private.ti_access_codes c
    where c.id=code_identifier
      and c.user_id=user_identifier
      and c.used_at is null
      and c.expires_at > now()
      and c.claimed_at > now()-interval '5 minutes'
      and c.claim_hash=encode(
        extensions.digest(claim_token,'sha256'),
        'hex'
      )
  ) then
    raise exception 'INVALID_CODE_SESSION';
  end if;

  if not exists(
    select 1 from auth.sessions s
    where s.id=session_identifier
      and s.user_id=user_identifier
      and (s.not_after is null or s.not_after>now())
  ) then
    raise exception 'INVALID_SESSION';
  end if;

  if not exists(
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id=ur.role_id
    join public.permissions p on p.id=rp.permission_id
    where ur.user_id=user_identifier
      and p.code='ti.view'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update private.ti_access_codes
  set used_at=now(),
      claim_hash=null,
      claim_fingerprint=null
  where id=code_identifier
    and user_id=user_identifier;

  insert into private.session_security(
    session_id,user_id,verified_at,verified_until,revoked_at
  )
  values(
    session_identifier,user_identifier,now(),now()+interval '8 hours',null
  )
  on conflict(session_id) do update
  set verified_at=now(),
      verified_until=now()+interval '8 hours',
      revoked_at=null
  where private.session_security.user_id=user_identifier;

  insert into public.audit_logs(
    actor_user_id,actor_name,event_type,action,module,success
  )
  select
    user_identifier,
    p.full_name,
    'authentication',
    'ti_access_code_login',
    'security',
    true
  from public.profiles p
  where p.id=user_identifier;

  return true;
end
$function$;

create or replace function public.confirm_ti_access_code_session(code_identifier uuid, user_identifier uuid, session_identifier uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
begin
  if current_user <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if not exists(
    select 1
    from private.ti_access_codes c
    where c.id=code_identifier
      and c.user_id=user_identifier
      and c.used_at is not null
      and c.used_at > now()-interval '5 minutes'
  ) then
    raise exception 'INVALID_CODE_SESSION';
  end if;

  if not exists(
    select 1 from auth.sessions s
    where s.id=session_identifier
      and s.user_id=user_identifier
      and (s.not_after is null or s.not_after>now())
  ) then
    raise exception 'INVALID_SESSION';
  end if;

  if not exists(
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id=ur.role_id
    join public.permissions p on p.id=rp.permission_id
    where ur.user_id=user_identifier
      and p.code='ti.view'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  insert into private.session_security(
    session_id,user_id,verified_at,verified_until,revoked_at
  )
  values(
    session_identifier,user_identifier,now(),now()+interval '8 hours',null
  )
  on conflict(session_id) do update
  set verified_at=now(),
      verified_until=now()+interval '8 hours',
      revoked_at=null
  where private.session_security.user_id=user_identifier;

  insert into public.audit_logs(
    actor_user_id,actor_name,event_type,action,module,success
  )
  select
    user_identifier,
    p.full_name,
    'authentication',
    'ti_recovery_code_login',
    'security',
    true
  from public.profiles p
  where p.id=user_identifier;

  return true;
end
$function$;

create or replace function public.consume_ti_access_code(input_code text, fingerprint_hash text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  normalized text := upper(regexp_replace(coalesce(input_code,''),'[^A-Z0-9]','','g'));
  matched private.ti_access_codes%rowtype;
  recent_attempts integer;
begin
  if current_user <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if length(coalesce(fingerprint_hash,'')) < 16 then
    raise exception 'INVALID_FINGERPRINT';
  end if;

  select count(*) into recent_attempts
  from private.ti_access_code_attempts a
  where a.fingerprint_hash=consume_ti_access_code.fingerprint_hash
    and a.attempted_at > now() - interval '15 minutes';

  if recent_attempts >= 10 then
    raise exception 'RATE_LIMITED';
  end if;

  if length(normalized) <> 22 or left(normalized,2) <> 'RF' then
    insert into private.ti_access_code_attempts(fingerprint_hash,success)
    values(consume_ti_access_code.fingerprint_hash,false);
    raise exception 'INVALID_CODE';
  end if;

  select c.*
  into matched
  from private.ti_access_codes c
  where c.used_at is null
    and c.expires_at > now()
    and extensions.crypt(normalized,c.code_hash)=c.code_hash
  order by c.created_at desc
  limit 1
  for update skip locked;

  if matched.id is null then
    insert into private.ti_access_code_attempts(fingerprint_hash,success)
    values(consume_ti_access_code.fingerprint_hash,false);
    raise exception 'INVALID_CODE';
  end if;

  update private.ti_access_codes
  set used_at=now()
  where id=matched.id;

  insert into private.ti_access_code_attempts(fingerprint_hash,success)
  values(consume_ti_access_code.fingerprint_hash,true);

  return jsonb_build_object(
    'code_id',matched.id,
    'user_id',matched.user_id,
    'expires_at',matched.expires_at
  );
end
$function$;

revoke all on function private.rotate_ti_access_codes(uuid) from public, anon, authenticated;
revoke all on function public.claim_ti_access_code(text,text,text) from public, anon, authenticated;
revoke all on function public.confirm_ti_access_code_session(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.confirm_ti_access_code_session(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.consume_ti_access_code(text,text) from public, anon, authenticated, service_role;

grant execute on function public.claim_ti_access_code(text,text,text) to service_role;
grant execute on function public.confirm_ti_access_code_session(uuid,uuid,uuid,text) to service_role;
grant execute on function public.confirm_ti_access_code_session(uuid,uuid,uuid) to service_role;

insert into public.permissions(code,name,module)
values('performance.grade','Lançar e editar notas','Desempenho')
on conflict(code) do update
set name=excluded.name,module=excluded.module;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
cross join public.permissions p
where r.code in ('DIRECTOR','INSTRUCTOR','MANAGER','SUPER_ADMIN')
  and p.code='performance.grade'
on conflict do nothing;
