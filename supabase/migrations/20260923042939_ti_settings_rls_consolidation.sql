drop policy if exists settings_ti_read on public.settings;
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings
for select to authenticated
using (
  (select private.can('settings.manage'))
  or (select private.can('ti.view'))
  or (
    key='lateness'
    and (select private.account_ready())
  )
);
