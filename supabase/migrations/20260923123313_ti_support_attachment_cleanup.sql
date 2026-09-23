create policy ti_support_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ti-support'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
