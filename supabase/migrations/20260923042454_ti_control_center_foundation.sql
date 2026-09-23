insert into public.permissions(code,name,module)
values
('ti.view','Visualizar Central de T.I','ti'),
('ti.manage','Gerenciar Central de T.I','ti'),
('ti.datasul.sync','Sincronizar Datasul','ti'),
('ti.deploy.manage','Gerenciar deploys','ti'),
('ti.security.view','Visualizar segurança técnica','ti')
on conflict (code) do update set name=excluded.name,module=excluded.module;

insert into public.roles(code,name,description,level,scope,privileged,active,archived)
values ('TI_ADMIN','Administrador de T.I','Controle técnico do Raízes do Futuro',90,'organization',true,true,false)
on conflict (code) do update set
name=excluded.name,
description=excluded.description,
level=excluded.level,
scope=excluded.scope,
privileged=true,
active=true,
archived=false;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
cross join public.permissions p
where r.code='SUPER_ADMIN'
and p.code in ('ti.view','ti.manage','ti.datasul.sync','ti.deploy.manage','ti.security.view')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
cross join public.permissions p
where r.code='TI_ADMIN'
and p.code in (
  'ti.view','ti.manage','ti.datasul.sync','ti.deploy.manage','ti.security.view',
  'audit.view','audit.security','settings.manage','dashboard.view'
)
on conflict do nothing;

insert into public.settings(key,value)
values
('ti_control',jsonb_build_object(
  'version','0.1.0',
  'enabled',true,
  'site_url','https://rh-raizes-do-futuro.vercel.app',
  'environment','production'
)),
('ti_datasul',jsonb_build_object(
  'enabled',false,
  'status','needs_connection',
  'auth_mode','basic',
  'health_path','/api/btb/v1/companies',
  'employees_path',null,
  'company_id',null,
  'last_check_at',null,
  'last_sync_at',null,
  'last_error',null
)),
('ti_github',jsonb_build_object(
  'enabled',false,
  'status','needs_secret',
  'repository','ConexaoStreet/rh-raizes-do-futuro',
  'branch','main',
  'last_check_at',null,
  'last_error',null
)),
('ti_vercel',jsonb_build_object(
  'enabled',false,
  'status','needs_secret',
  'project','rh-raizes-do-futuro',
  'production_url','https://rh-raizes-do-futuro.vercel.app',
  'last_check_at',null,
  'last_error',null
)),
('ti_email',jsonb_build_object(
  'enabled',true,
  'status','partial',
  'sender_label','Comunicado T.I Raízes do Futuro',
  'transport','resend',
  'last_check_at',null,
  'last_error',null
)),
('ti_site',jsonb_build_object(
  'maintenance_title','Sistema em manutenção',
  'maintenance_message','Alguns recursos podem ficar temporariamente indisponíveis.',
  'maintenance_severity','warning',
  'announcement_enabled',false,
  'announcement_title','',
  'announcement_body','',
  'announcement_tone','info'
))
on conflict (key) do nothing;

drop policy if exists settings_ti_read on public.settings;
create policy settings_ti_read on public.settings
for select to authenticated
using ((select private.can('ti.view')));

drop policy if exists settings_ti_update on public.settings;
create policy settings_ti_update on public.settings
for update to authenticated
using (
  (select private.can('ti.manage'))
  and key in ('maintenance','general','ti_control','ti_datasul','ti_github','ti_vercel','ti_email','ti_site')
)
with check (
  (select private.can('ti.manage'))
  and key in ('maintenance','general','ti_control','ti_datasul','ti_github','ti_vercel','ti_email','ti_site')
);

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security invoker
set search_path=''
as $function$
select private.can(permission_code)
$function$;

revoke all on function public.has_permission(text) from public,anon;
grant execute on function public.has_permission(text) to authenticated;
