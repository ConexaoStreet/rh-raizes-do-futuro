-- Maximum security hardening phase 1: backward-compatible database changes.

create or replace function private.account_ready()
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
select
  private.session_valid()
  and exists(
    select 1
    from public.profiles p
    where p.id=auth.uid()
      and p.status='active'
      and p.onboarded_at is not null
      and p.terms_accepted_at is not null
  )
  and (
    not private.is_privileged()
    or exists(
      select 1
      from private.session_security s
      where s.session_id=private.session_id()
        and s.user_id=auth.uid()
        and s.verified_until > now()
        and s.revoked_at is null
    )
  )
  and (
    not coalesce(
      (select (value->>'enabled')::boolean from public.settings where key='maintenance'),
      false
    )
    or 'SUPER_ADMIN'=any(private.roles_for_current_user())
    or 'TI_ADMIN'=any(private.roles_for_current_user())
    or (
      coalesce(
        (select (value->>'allow_managers')::boolean from public.settings where key='maintenance'),
        false
      )
      and private.is_privileged()
    )
  )
$function$;

revoke all on function private.account_ready() from public, anon;
grant execute on function private.account_ready() to authenticated;

create or replace function public.consume_edge_rate_limit(
  rate_scope text,
  fingerprint_hash text,
  max_attempts integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  bucket timestamptz;
  next_attempts integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if length(coalesce(rate_scope,'')) < 3
     or length(coalesce(fingerprint_hash,'')) < 32
     or max_attempts < 1
     or max_attempts > 1000
     or window_seconds < 10
     or window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into private.edge_rate_limits(
    scope, fingerprint_hash, bucket_start, attempts, updated_at
  )
  values(rate_scope, fingerprint_hash, bucket, 1, now())
  on conflict(scope, fingerprint_hash, bucket_start)
  do update
  set attempts=private.edge_rate_limits.attempts+1,
      updated_at=now()
  returning attempts into next_attempts;

  delete from private.edge_rate_limits
  where updated_at < now() - interval '2 days';

  return next_attempts <= max_attempts;
end
$function$;

revoke all on function public.consume_edge_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text,text,integer,integer)
  to service_role;

drop function if exists public.consume_ti_access_code(text,text);
drop function if exists public.confirm_ti_access_code_session(uuid,uuid,uuid);

revoke all on schema graphql_public from anon, authenticated;
revoke execute on function graphql_public.graphql(text,text,jsonb,jsonb)
  from public, anon, authenticated;

do $block$
declare
  config_row public.push_config%rowtype;
begin
  select * into config_row from public.push_config where id=1;
  if found then
    if not exists(select 1 from vault.secrets where name='raizes_push_vapid_private_key') then
      perform vault.create_secret(
        config_row.vapid_private_key,
        'raizes_push_vapid_private_key',
        'Raizes do Futuro Web Push VAPID private key'
      );
    end if;
    if not exists(select 1 from vault.secrets where name='raizes_push_webhook_secret') then
      perform vault.create_secret(
        config_row.webhook_secret,
        'raizes_push_webhook_secret',
        'Raizes do Futuro internal push webhook secret'
      );
    end if;
  end if;
end
$block$;

create or replace function public.service_push_config()
returns table(
  vapid_public_key text,
  vapid_private_key text,
  webhook_secret text
)
language plpgsql
security definer
set search_path=''
as $function$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    pc.vapid_public_key,
    (select ds.decrypted_secret
       from vault.decrypted_secrets ds
      where ds.name='raizes_push_vapid_private_key'
      limit 1),
    (select ds.decrypted_secret
       from vault.decrypted_secrets ds
      where ds.name='raizes_push_webhook_secret'
      limit 1)
  from public.push_config pc
  where pc.id=1;
end
$function$;

revoke all on function public.service_push_config() from public, anon, authenticated;
grant execute on function public.service_push_config() to service_role;

create or replace function private.push_notification_after_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  hook_secret text;
begin
  select ds.decrypted_secret into hook_secret
    from vault.decrypted_secrets ds
   where ds.name='raizes_push_webhook_secret'
   limit 1;

  if hook_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://fiuealmgufpmtgmxxpna.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-push-webhook-secret',hook_secret
    ),
    body := jsonb_build_object(
      'action','webhook',
      'notification',jsonb_build_object(
        'id',new.id,
        'user_id',new.user_id,
        'title',new.title,
        'body',new.body,
        'path',new.path,
        'created_at',new.created_at
      )
    ),
    timeout_milliseconds := 5000
  );

  return new;
end
$function$;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
