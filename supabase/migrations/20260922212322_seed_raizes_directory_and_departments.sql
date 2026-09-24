insert into public.classes(name,code,active)
values ('Turma 16807 - Anhanguera Guarulhos','16807',true)
on conflict (code) do update set name=excluded.name,active=true;

insert into public.departments(name,active)
values
  ('Recursos Humanos',true),
  ('Eventos',true),
  ('Educação',true),
  ('Ecológico',true),
  ('Marketing',true)
on conflict (name) do update set active=true;

insert into public.releases(version,changes)
values (
  '1.0.3',
  'Personalização Raízes do Futuro: turma 16807 e estrutura inicial de setores.'
)
on conflict (version) do nothing;
