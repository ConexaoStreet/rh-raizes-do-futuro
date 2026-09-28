create or replace function public.consume_edge_rate_limit(
  rate_scope text,
  fingerprint_hash text,
  max_attempts integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  bucket timestamptz;
  next_attempts integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if length(coalesce(rate_scope,'')) < 3
     or length(coalesce(fingerprint_hash,'')) < 32
     or max_attempts < 1
     or max_attempts > 1000
     or window_seconds < 10
     or window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into private.edge_rate_limits(
    scope, fingerprint_hash, bucket_start, attempts, updated_at
  )
  values(rate_scope, fingerprint_hash, bucket, 1, now())
  on conflict on constraint edge_rate_limits_pkey
  do update
  set attempts=private.edge_rate_limits.attempts+1,
      updated_at=now()
  returning private.edge_rate_limits.attempts into next_attempts;

  delete from private.edge_rate_limits
  where updated_at < now() - interval '2 days';

  return next_attempts <= max_attempts;
end
$function$;

revoke all on function public.consume_edge_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text,text,integer,integer)
  to service_role;
