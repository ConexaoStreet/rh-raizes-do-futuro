insert into public.settings(key, value, updated_at)
values ('registration_access_window', '{"enabled":true}'::jsonb, now())
on conflict (key) do update
set value=excluded.value,
    updated_at=now(),
    version=public.settings.version+1;
