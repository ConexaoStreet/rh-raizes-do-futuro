
    revoke all on function public.registration_options() from public, anon, authenticated;
    revoke all on function public.match_pre_registered_user(text) from public, anon, authenticated;
    drop function public.registration_options();
    drop function public.match_pre_registered_user(text);
  