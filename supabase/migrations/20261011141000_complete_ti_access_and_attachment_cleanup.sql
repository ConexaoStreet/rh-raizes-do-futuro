create policy ti_support_account_ready
on public.ti_support_tickets as restrictive for all to authenticated
using ((select private.account_ready()))
with check ((select private.account_ready()));

create policy ti_support_storage_account_ready
on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'ti-support' or (select private.account_ready()))
with check (bucket_id <> 'ti-support' or (select private.account_ready()));

create function private.support_file_discard_allowed(file_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select private.account_ready()
    and split_part(file_path,'/',1)=auth.uid()::text
    and not exists (
      select 1 from public.ti_support_tickets t where t.attachment_path=file_path
    )
$$;
revoke all on function private.support_file_discard_allowed(text) from public,anon;
grant execute on function private.support_file_discard_allowed(text) to authenticated;
create policy ti_support_registered_files_preserved
on storage.objects as restrictive for delete to authenticated
using (bucket_id <> 'ti-support' or private.support_file_discard_allowed(name));

create function private.file_discard_allowed(bucket_name text,file_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select bucket_name in ('justifications','medical-certificates','documents','feedback-files')
    and private.file_upload_allowed(bucket_name,file_path)
    and exists (
      select 1 from storage.objects o
      where o.bucket_id=bucket_name and o.name=file_path
        and o.owner_id=auth.uid()::text
    )
    and not exists (
      select 1 from public.attachments a
      where a.bucket=bucket_name and a.path=file_path
    )
$$;
revoke all on function private.file_discard_allowed(text,text) from public,anon;
grant execute on function private.file_discard_allowed(text,text) to authenticated;

create policy rh_unregistered_files_read on storage.objects
for select to authenticated using (private.file_discard_allowed(bucket_id,name));
create policy rh_unregistered_files_delete on storage.objects
for delete to authenticated using (private.file_discard_allowed(bucket_id,name));

create function private.ti_update_setting(setting_key text,setting_value jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare before_row public.settings;
begin
  perform private.require_permission('ti.manage');
  perform private.require_recent_verification(15);
  if setting_key not in ('maintenance','general','ti_control','ti_datasul','ti_github','ti_vercel','ti_email','ti_site')
    or setting_key is null then raise exception 'FORBIDDEN'; end if;
  if setting_value is null or jsonb_typeof(setting_value)<>'object' then
    raise exception 'INVALID_TRANSITION';
  end if;
  if setting_key='maintenance' and (
    (setting_value ? 'enabled' and jsonb_typeof(setting_value->'enabled')<>'boolean')
    or (setting_value ? 'allow_managers' and jsonb_typeof(setting_value->'allow_managers')<>'boolean')
    or (setting_value ? 'title' and jsonb_typeof(setting_value->'title')<>'string')
    or (setting_value ? 'message' and jsonb_typeof(setting_value->'message')<>'string')
  ) then raise exception 'INVALID_TRANSITION'; end if;
  select * into before_row from public.settings where key=setting_key for update;
  if before_row.id is null then raise exception 'NOT_FOUND'; end if;
  update public.settings set value=setting_value,updated_at=now()
    where id=before_row.id;
end
$$;
create function public.ti_update_setting(setting_key text,setting_value jsonb)
returns void language sql security invoker set search_path='' as $$
  select private.ti_update_setting(setting_key,setting_value)
$$;
revoke all on function private.ti_update_setting(text,jsonb) from public,anon;
revoke all on function public.ti_update_setting(text,jsonb) from public,anon;
grant execute on function private.ti_update_setting(text,jsonb) to authenticated;
grant execute on function public.ti_update_setting(text,jsonb) to authenticated;
