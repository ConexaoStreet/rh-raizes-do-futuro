insert into public.roles(code,name,description,level,scope,privileged,active,archived)
values
(
  'DIRECTOR',
  'Diretor',
  'Acesso de direção para acompanhamento e gestão do RH, sem administração técnica.',
  85,
  'organization',
  true,
  true,
  false
),
(
  'INSTRUCTOR',
  'Instrutor',
  'Professor da turma com acesso à chamada, notas, feedbacks e acompanhamento dos alunos.',
  60,
  'organization',
  false,
  true,
  false
)
on conflict(code) do update
set name=excluded.name,
    description=excluded.description,
    level=excluded.level,
    scope=excluded.scope,
    privileged=excluded.privileged,
    active=excluded.active,
    archived=excluded.archived;

with grants(role_code,permission_code) as (
  values
  ('DIRECTOR','attendance.maintenance'),
  ('DIRECTOR','attendance.manage'),
  ('DIRECTOR','attendance.view'),
  ('DIRECTOR','audit.view'),
  ('DIRECTOR','calendar.manage'),
  ('DIRECTOR','dashboard.view'),
  ('DIRECTOR','employee.manage'),
  ('DIRECTOR','employee.view'),
  ('DIRECTOR','feedback.manage'),
  ('DIRECTOR','feedback.view'),
  ('DIRECTOR','files.manage'),
  ('DIRECTOR','justification.manage'),
  ('DIRECTOR','justification.view'),
  ('DIRECTOR','performance.grade'),
  ('DIRECTOR','performance.manage'),
  ('DIRECTOR','performance.view'),
  ('DIRECTOR','report.export'),
  ('DIRECTOR','report.view'),
  ('DIRECTOR','review.manage'),
  ('DIRECTOR','review.results'),
  ('DIRECTOR','settings.manage'),
  ('DIRECTOR','user.manage'),
  ('DIRECTOR','user.view'),
  ('INSTRUCTOR','attendance.manage'),
  ('INSTRUCTOR','attendance.view'),
  ('INSTRUCTOR','dashboard.view'),
  ('INSTRUCTOR','employee.view'),
  ('INSTRUCTOR','feedback.manage'),
  ('INSTRUCTOR','feedback.view'),
  ('INSTRUCTOR','justification.view'),
  ('INSTRUCTOR','performance.grade'),
  ('INSTRUCTOR','performance.view'),
  ('INSTRUCTOR','report.view')
)
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from grants g
join public.roles r on r.code=g.role_code
join public.permissions p on p.code=g.permission_code
on conflict do nothing;
