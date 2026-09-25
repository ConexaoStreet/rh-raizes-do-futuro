revoke all privileges on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

revoke all privileges on table public.ti_support_tickets from anon, authenticated;
grant select, insert, update on table public.ti_support_tickets to authenticated;

revoke all privileges on table public.user_role_history from anon, authenticated;
grant select on table public.user_role_history to authenticated;
