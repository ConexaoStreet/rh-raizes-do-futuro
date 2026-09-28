import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create schema graphql_public; create schema vault;
 create function graphql_public.graphql(text,text,jsonb,jsonb) returns jsonb language sql as $graphql$ select '{}'::jsonb $graphql$;
 create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text not null,name text unique not null,description text);
 create table vault.decrypted_secrets(id uuid primary key,name text unique not null,decrypted_secret text not null);
 create function vault.create_secret(secret text,name text,description text default '') returns uuid language plpgsql as $vault$ declare created_id uuid := gen_random_uuid(); begin insert into vault.secrets(id,secret,name,description) values(created_id,secret,name,description); insert into vault.decrypted_secrets(id,name,decrypted_secret) values(created_id,name,secret); return created_id; end $vault$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz default now(),updated_at timestamptz default now(),not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth to authenticated,anon,service_role; grant execute on all functions in schema auth to authenticated,anon,service_role;
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
    if (file === "20260924171425_add_web_push_notifications.sql") {
      await db.exec(
        "insert into public.push_config(id,vapid_public_key,vapid_private_key,webhook_secret) values(1,'test-public-key','test-private-key','test-webhook-secret') on conflict(id) do nothing",
      );
      await db.exec(
        "select vault.create_secret('test-private-key','raizes_push_vapid_private_key','test-only VAPID secret'); select vault.create_secret('test-webhook-secret','raizes_push_webhook_secret','test-only webhook secret');",
      );
    }
  }
  return db;
}
