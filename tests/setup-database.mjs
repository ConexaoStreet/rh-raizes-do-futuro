import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz default now(),updated_at timestamptz default now(),not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth to authenticated,anon,service_role; grant execute on all functions in schema auth to authenticated,anon,service_role;
 create schema graphql_public;
 create function graphql_public.graphql(text,text,jsonb,jsonb) returns jsonb language sql as $ select '{}'::jsonb $;
 grant usage on schema graphql_public to anon,authenticated,service_role;
 grant execute on function graphql_public.graphql(text,text,jsonb,jsonb) to anon,authenticated,service_role;
 create schema vault;
 create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text,description text);
 create view vault.decrypted_secrets as select id,name,secret as decrypted_secret,description from vault.secrets;
 create function vault.create_secret(new_secret text,new_name text default null,new_description text default null,new_key_id uuid default null) returns uuid language plpgsql as $vault$ declare sid uuid; begin insert into vault.secrets(name,secret,description) values(new_name,new_secret,new_description) returning id into sid; return sid; end $vault$;
 create schema net;
 create table net.http_request_queue(id bigint);
 create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds integer default 5000) returns bigint language sql as $pgnet$ select 1::bigint $pgnet$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;`);
  for (const file of (await fs.readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const source = (await fs.readFile(`supabase/migrations/${file}`, "utf8"))
      .replace(/create extension if not exists pg_net\s*;/gi, "")
      .replace(/drop extension(?: if exists)? pg_net\s*;/gi, "")
      .replace(/create extension pg_net(?: with)? schema extensions\s*;/gi, "");
    await db
      .exec(source)
      .catch((error) => {
        process.stderr.write(
          JSON.stringify({
            message: error.message,
            detail: error.detail,
            position: error.position,
            where: error.where,
          }) + "\n",
        );
        process.exit(1);
      });
  }
  return db;
}
