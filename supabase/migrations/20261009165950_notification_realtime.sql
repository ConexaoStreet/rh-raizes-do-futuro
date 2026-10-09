create index if not exists notifications_rh_unread_owner
  on public.notifications (user_id, created_at desc)
  where scope = 'rh' and read_at is null;

do $migration$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$migration$;
