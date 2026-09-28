create or replace function private.rh_notify_employee_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.profile_id is null then return new; end if;

  if (
    to_jsonb(new) - 'profile_id' - 'updated_at' - 'version'
  ) is distinct from (
    to_jsonb(old) - 'profile_id' - 'updated_at' - 'version'
  ) then
    perform private.rh_notify_employee(
      new.id,
      'Seu cadastro foi atualizado',
      'uma informação ligada ao seu cadastro no RH foi alterada.',
      '/colaboradores/'||new.id::text
    );
  end if;

  return new;
end
$$;
