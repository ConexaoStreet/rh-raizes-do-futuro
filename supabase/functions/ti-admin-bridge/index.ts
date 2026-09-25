import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { withSupabase } from "npm:@supabase/server";

const ORIGINS = new Set([
  "https://ti-raizes-do-futuro.vercel.app",
  "http://127.0.0.1:4174",
  "http://localhost:4174",
]);

function headers(origin: string) {
  const safe = ORIGINS.has(origin)
    ? origin
    : "https://ti-raizes-do-futuro.vercel.app";
  return {
    "Access-Control-Allow-Origin": safe,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function response(origin: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers(origin),
  });
}

async function hasPermission(
  supabase: ReturnType<typeof createClient>,
  code: string,
) {
  const { data, error } = await supabase.rpc("has_permission", {
    permission_code: code,
  });
  return !error && data === true;
}

async function recentlyVerified(
  supabase: ReturnType<typeof createClient>,
) {
  const { data, error } = await supabase.rpc("bootstrap");
  return (
    !error &&
    Boolean(data) &&
    typeof data === "object" &&
    (data as Record<string, unknown>).recently_verified === true
  );
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("CONFIGURATION_REQUIRED");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function actor(
  supabase: ReturnType<typeof createClient>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, name: "Sistema" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    name: profile?.full_name || user.email || "Usuário T.I.",
  };
}

Deno.serve(
  withSupabase({ auth: "user" }, async (request, context) => {
    const origin =
      request.headers.get("origin") ||
      "https://ti-raizes-do-futuro.vercel.app";
    if (!ORIGINS.has(origin)) return new Response(null, { status: 403 });
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: headers(origin),
      });
    }
    if (request.method !== "POST") {
      return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
    }
    if (!(await hasPermission(context.supabase, "ti.view"))) {
      return response(origin, { error: "FORBIDDEN" }, 403);
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      bucket?: string;
      prefix?: string;
      path?: string;
      limit?: number;
    };
    const action = body.action || "inventory";
    let admin: ReturnType<typeof createClient>;
    try {
      admin = adminClient();
    } catch {
      return response(origin, { error: "CONFIGURATION_REQUIRED" }, 503);
    }

    if (action === "inventory") {
      const [bucketResult, snapshotResult, rolesResult, profilesResult] =
        await Promise.all([
          admin.storage.listBuckets(),
          context.supabase.rpc("ti_snapshot"),
          admin
            .from("roles")
            .select("code,name,level,privileged,active,archived")
            .order("level", { ascending: false }),
          admin
            .from("profiles")
            .select("id", { count: "exact", head: true }),
        ]);

      if (bucketResult.error) {
        return response(origin, { error: "STORAGE_INVENTORY_FAILED" }, 500);
      }

      const bucketCounts: Record<string, number> = {};
      for (const bucket of bucketResult.data || []) {
        const { data: objects } = await admin.storage
          .from(bucket.id)
          .list("", { limit: 1000 });
        bucketCounts[bucket.id] = objects?.length || 0;
      }

      return response(origin, {
        snapshot: snapshotResult.data || null,
        buckets: (bucketResult.data || []).map((bucket) => ({
          id: bucket.id,
          name: bucket.name,
          public: bucket.public,
          file_size_limit: bucket.file_size_limit,
          allowed_mime_types: bucket.allowed_mime_types,
          top_level_items: bucketCounts[bucket.id] || 0,
        })),
        roles: rolesResult.data || [],
        profiles_count: profilesResult.count || 0,
      });
    }

    if (action === "database") {
      if (!(await hasPermission(context.supabase, "ti.database.view"))) {
        return response(origin, { error: "FORBIDDEN" }, 403);
      }
      const { data, error } = await context.supabase.rpc(
        "ti_database_snapshot",
      );
      if (error) {
        return response(
          origin,
          {
            error: "DATABASE_SNAPSHOT_FAILED",
            detail: error.message,
          },
          500,
        );
      }
      return response(origin, data);
    }

    if (action === "storage_list") {
      if (!(await hasPermission(context.supabase, "ti.storage.manage"))) {
        return response(origin, { error: "FORBIDDEN" }, 403);
      }
      const bucket = String(body.bucket || "").trim();
      const prefix = String(body.prefix || "").replace(/^\/+/, "");
      const limit = Math.min(
        Math.max(Number(body.limit || 100), 1),
        500,
      );
      if (!bucket) {
        return response(origin, { error: "BUCKET_REQUIRED" }, 400);
      }

      const { data: buckets, error: bucketError } =
        await admin.storage.listBuckets();
      if (bucketError) {
        return response(origin, { error: "STORAGE_LIST_FAILED" }, 500);
      }
      if (!(buckets || []).some((item) => item.id === bucket)) {
        return response(origin, { error: "INVALID_BUCKET" }, 404);
      }

      const { data, error } = await admin.storage.from(bucket).list(
        prefix,
        {
          limit,
          sortBy: { column: "updated_at", order: "desc" },
        },
      );
      if (error) {
        return response(
          origin,
          { error: "STORAGE_LIST_FAILED", detail: error.message },
          500,
        );
      }
      return response(origin, {
        bucket,
        prefix,
        items: data || [],
      });
    }

    if (action === "storage_delete") {
      if (!(await hasPermission(context.supabase, "ti.storage.manage"))) {
        return response(origin, { error: "FORBIDDEN" }, 403);
      }
      if (!(await recentlyVerified(context.supabase))) {
        return response(
          origin,
          { error: "RECENT_VERIFICATION_REQUIRED" },
          428,
        );
      }

      const bucket = String(body.bucket || "").trim();
      const path = String(body.path || "").replace(/^\/+/, "");
      if (!bucket || !path || path.includes("..")) {
        return response(origin, { error: "INVALID_STORAGE_PATH" }, 400);
      }

      const { data: buckets } = await admin.storage.listBuckets();
      if (!(buckets || []).some((item) => item.id === bucket)) {
        return response(origin, { error: "INVALID_BUCKET" }, 404);
      }

      const { error } = await admin.storage.from(bucket).remove([path]);
      if (error) {
        return response(
          origin,
          { error: "STORAGE_DELETE_FAILED", detail: error.message },
          500,
        );
      }

      const currentActor = await actor(context.supabase);
      await admin.from("audit_logs").insert({
        event_type: "data_change",
        severity: "warning",
        actor_user_id: currentActor.id,
        actor_name: currentActor.name,
        actor_roles: [],
        action: "ti_storage_delete",
        module: "storage",
        entity_id: null,
        old_values: { bucket, path },
        new_values: null,
        context: {},
        success: true,
      });

      return response(origin, { ok: true, bucket, path });
    }

    return response(origin, { error: "UNKNOWN_ACTION" }, 400);
  }),
);
