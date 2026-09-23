create table public.ti_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('bug','error','access','question','suggestion','other')),
  subject text not null check (char_length(subject) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  page_path text not null default '/',
  page_url text not null default '',
  page_title text not null default '',
  technical_context jsonb not null default '{}'::jsonb,
  attachment_path text,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ti_support_tickets_user_created_idx
  on public.ti_support_tickets(user_id, created_at desc);
create index ti_support_tickets_status_created_idx
  on public.ti_support_tickets(status, created_at desc);

alter table public.ti_support_tickets enable row level security;

grant select, insert, update on public.ti_support_tickets to authenticated;

create policy ti_support_tickets_select
on public.ti_support_tickets
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_permission('ti.manage')
);

create policy ti_support_tickets_insert
on public.ti_support_tickets
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'open'
);

create policy ti_support_tickets_update
on public.ti_support_tickets
for update
to authenticated
using (public.has_permission('ti.manage'))
with check (public.has_permission('ti.manage'));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'ti-support',
  'ti-support',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
