drop policy if exists ti_support_upload_own on storage.objects;
drop policy if exists ti_support_read_own_or_ti on storage.objects;
drop policy if exists ti_support_delete_own on storage.objects;

create policy ti_support_upload_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ti-support'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create policy ti_support_read_own_or_ti
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ti-support'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or public.has_permission('ti.manage')
  )
);

create policy ti_support_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ti-support'
  and split_part(name, '/', 1) = (select auth.uid())::text
);
