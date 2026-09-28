revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;

do $block$
declare
  fn record;
begin
  for fn in
    select
      priv.proname,
      pg_get_function_identity_arguments(priv.oid) as args
    from pg_proc priv
    join pg_namespace priv_ns on priv_ns.oid=priv.pronamespace
    join pg_proc pub
      on pub.proname=priv.proname
     and pg_get_function_identity_arguments(pub.oid)=pg_get_function_identity_arguments(priv.oid)
    join pg_namespace pub_ns on pub_ns.oid=pub.pronamespace
    where priv_ns.nspname='private'
      and pub_ns.nspname='public'
      and has_function_privilege('authenticated',pub.oid,'EXECUTE')
  loop
    execute format(
      'grant execute on function private.%I(%s) to authenticated',
      fn.proname,
      fn.args
    );
  end loop;

  for fn in
    select distinct
      proc.proname,
      pg_get_function_identity_arguments(proc.oid) as args
    from pg_policy pol
    join pg_depend dep
      on dep.classid='pg_policy'::regclass
     and dep.objid=pol.oid
     and dep.refclassid='pg_proc'::regclass
    join pg_proc proc on proc.oid=dep.refobjid
    join pg_namespace ns on ns.oid=proc.pronamespace
    where ns.nspname='private'
  loop
    execute format(
      'grant execute on function private.%I(%s) to authenticated',
      fn.proname,
      fn.args
    );
  end loop;
end
$block$;
