create table if not exists public.user_role_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  role_code text not null,
  role_name text not null,
  action text not null check (action in ('assigned','removed')),
  changed_by uuid references public.profiles(id) on delete set null,
  source text not null default 'system',
  created_at timestamptz not null default now()
);

alter table public.user_role_history enable row level security;

create index if not exists user_role_history_user_id_idx
  on public.user_role_history(user_id);
create index if not exists user_role_history_role_id_idx
  on public.user_role_history(role_id);
create index if not exists user_role_history_changed_by_idx
  on public.user_role_history(changed_by);

drop policy if exists user_role_history_read on public.user_role_history;
create policy user_role_history_read
on public.user_role_history
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.can('role.manage'))
  or (select private.can('user.manage'))
);

create or replace function private.capture_user_role_history()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  selected_role public.roles;
begin
  select * into selected_role
  from public.roles
  where id=coalesce(new.role_id,old.role_id);

  insert into public.user_role_history(
    user_id,role_id,role_code,role_name,action,changed_by,source
  )
  values(
    coalesce(new.user_id,old.user_id),
    selected_role.id,
    selected_role.code,
    selected_role.name,
    case when tg_op='INSERT' then 'assigned' else 'removed' end,
    auth.uid(),
    case when auth.uid() is null then 'system' else 'application' end
  );

  return coalesce(new,old);
end;
$$;

drop trigger if exists user_roles_history_insert on public.user_roles;
create trigger user_roles_history_insert
after insert on public.user_roles
for each row execute function private.capture_user_role_history();

drop trigger if exists user_roles_history_delete on public.user_roles;
create trigger user_roles_history_delete
after delete on public.user_roles
for each row execute function private.capture_user_role_history();

revoke all privileges on table public.user_role_history from anon, authenticated;
grant select on table public.user_role_history to authenticated;

revoke all on function private.capture_user_role_history() from public, anon, authenticated;
