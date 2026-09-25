do $$
begin
  if exists (select 1 from net.http_request_queue limit 1) then
    raise exception 'PG_NET_QUEUE_NOT_EMPTY';
  end if;
end;
$$;

create schema if not exists extensions;

drop extension pg_net;
create extension pg_net with schema extensions;
