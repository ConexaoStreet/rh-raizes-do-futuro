create or replace function private.rh_notify_profile_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if (
    to_jsonb(new) - 'last_seen_at' - 'updated_at' - 'version'
  ) is distinct from (
    to_jsonb(old) - 'last_seen_at' - 'updated_at' - 'version'
  ) then
    perform private.rh_notify_profile(
      new.id,
      'Seu perfil foi atualizado',
      'uma informação do seu perfil no RH foi alterada.',
      '/'
    );
  end if;

  return new;
end
$$;
