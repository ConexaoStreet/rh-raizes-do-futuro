
do $block$
begin
  if not exists (
    select 1 from vault.secrets
    where name='raizes_push_vapid_private_key'
  ) or not exists (
    select 1 from vault.secrets
    where name='raizes_push_webhook_secret'
  ) then
    raise exception 'VAULT_PUSH_SECRETS_REQUIRED';
  end if;
end
$block$;

alter table public.push_config
  alter column vapid_private_key drop not null,
  alter column webhook_secret drop not null;

update public.push_config
   set vapid_private_key=null,
       webhook_secret=null
 where vapid_private_key is not null
    or webhook_secret is not null;
