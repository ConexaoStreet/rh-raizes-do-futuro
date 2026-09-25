create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
on public.push_subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
on public.push_subscriptions for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own
on public.push_subscriptions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
on public.push_subscriptions for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.push_config (
  id smallint primary key check (id = 1),
  vapid_public_key text not null,
  vapid_private_key text not null,
  webhook_secret text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
grant select on public.push_config to service_role;

create or replace function public.register_push_subscription(
  endpoint_value text,
  p256dh_value text,
  auth_value text,
  user_agent_value text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  subscription_id uuid;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if endpoint_value is null or endpoint_value !~ '^https://' or length(endpoint_value) > 4096 then
    raise exception 'INVALID_ENDPOINT';
  end if;
  if coalesce(length(p256dh_value),0) < 20 or coalesce(length(auth_value),0) < 8 then
    raise exception 'INVALID_SUBSCRIPTION';
  end if;

  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,updated_at)
  values(current_user_id,endpoint_value,p256dh_value,auth_value,left(user_agent_value,500),now())
  on conflict(endpoint) do update
    set user_id=excluded.user_id,
        p256dh=excluded.p256dh,
        auth=excluded.auth,
        user_agent=excluded.user_agent,
        updated_at=now()
  returning id into subscription_id;

  return subscription_id;
end;
$$;

revoke all on function public.register_push_subscription(text,text,text,text) from public, anon;
grant execute on function public.register_push_subscription(text,text,text,text) to authenticated;

create or replace function public.unregister_push_subscription(endpoint_value text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.push_subscriptions
   where user_id = auth.uid()
     and endpoint = endpoint_value;
$$;

revoke all on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.unregister_push_subscription(text) to authenticated;

create or replace function private.push_notification_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_secret text;
begin
  select webhook_secret into hook_secret
    from public.push_config
   where id = 1;

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
end;
$$;

drop trigger if exists notifications_web_push on public.notifications;
create trigger notifications_web_push
after insert on public.notifications
for each row execute function private.push_notification_after_insert();
