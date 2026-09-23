create policy manager_activation_deny_anon
on public.manager_activation_invites
for all
to anon
using (false)
with check (false);

create policy manager_activation_deny_authenticated
on public.manager_activation_invites
for all
to authenticated
using (false)
with check (false);
