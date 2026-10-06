create policy "deny_direct_client_access"
on private.edge_rate_limits
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_direct_client_access"
on private.notification_deliveries
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_direct_client_access"
on private.ti_access_code_attempts
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_direct_client_access"
on private.ti_access_codes
for all
to anon, authenticated
using (false)
with check (false);
