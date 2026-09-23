create or replace function private.account_ready()
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
select
  private.session_valid()
  and exists(
    select 1
    from public.profiles p
    where p.id=auth.uid()
      and p.status='active'
      and p.onboarded_at is not null
      and p.terms_accepted_at is not null
  )
  and (
    not private.is_privileged()
    or exists(
      select 1
      from private.session_security s
      where s.session_id=private.session_id()
        and s.user_id=auth.uid()
        and s.verified_until > now()
        and s.revoked_at is null
    )
  )
  and (
    not coalesce(
      (select (value->>'enabled')::boolean from public.settings where key='maintenance'),
      false
    )
    or 'SUPER_ADMIN'=any(private.roles_for_current_user())
    or 'TI_ADMIN'=any(private.roles_for_current_user())
    or (
      coalesce(
        (select (value->>'allow_managers')::boolean from public.settings where key='maintenance'),
        false
      )
      and private.is_privileged()
    )
  )
$function$;
