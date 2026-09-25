import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { withSupabase } from "npm:@supabase/server";

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://ti-raizes-do-futuro.vercel.app",
  "https://rh-raizes-do-futuro.vercel.app",
  "http://127.0.0.1:4174",
  "http://localhost:4174",
]);

function allowedOrigins() {
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}

function cors(origin: string) {
  const safe = allowedOrigins().has(origin)
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
    headers: cors(origin),
  });
}

function secret(name: string) {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function safePath(value: string) {
  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.includes("://") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.length > 1200
  ) {
    throw new Error("INVALID_PATH");
  }
  return path;
}

function buildUrl(base: string, path: string) {
  const url = new URL(base);
  url.pathname = safePath(path);
  url.search = "";
  url.hash = "";
  return url;
}

function parseResponse(raw: string) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { text: raw.slice(0, 12000) };
  }
}

function sanitize(value: unknown) {
  if (value === null || value === undefined) return null;
  const raw = JSON.stringify(value);
  return raw.length <= 6000
    ? value
    : { truncated: true, preview: raw.slice(0, 6000) };
}

async function hasPermission(
  supabase: any,
  code: string,
) {
  const { data, error } = await supabase.rpc("has_permission", {
    permission_code: code,
  });
  return !error && data === true;
}

async function recentlyVerified(
  supabase: any,
) {
  const { data, error } = await supabase.rpc("bootstrap");
  return (
    !error &&
    Boolean(data) &&
    typeof data === "object" &&
    (data as Record<string, unknown>).recently_verified === true
  );
}

async function actor(
  supabase: any,
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

async function datasulRequest(args: {
  method: string;
  path: string;
  companyId: string | null;
  payload?: unknown;
  query?: Record<string, string | number | boolean | null>;
}) {
  const baseUrl = secret("DATASUL_BASE_URL");
  const username = secret("DATASUL_USERNAME");
  const password = secret("DATASUL_PASSWORD");

  if (!baseUrl || !username || !password) {
    return {
      configured: false as const,
      missing: [
        !baseUrl ? "DATASUL_BASE_URL" : null,
        !username ? "DATASUL_USERNAME" : null,
        !password ? "DATASUL_PASSWORD" : null,
      ].filter(Boolean),
    };
  }

  const method = args.method.toUpperCase();
  const url = buildUrl(baseUrl, args.path);
  for (const [key, value] of Object.entries(args.query || {})) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers({
    Accept: "application/json",
    Authorization: "Basic " + btoa(username + ":" + password),
  });
  if (args.companyId) headers.set("companyId", args.companyId);

  const init: RequestInit = { method, headers };
  if (!["GET", "HEAD"].includes(method) && args.payload !== undefined) {
    const body = JSON.stringify(args.payload);
    if (body.length > 150000) throw new Error("PAYLOAD_TOO_LARGE");
    headers.set("Content-Type", "application/json");
    init.body = body;
  }

  const started = Date.now();
  const result = await fetch(url, init);
  const raw = await result.text();

  return {
    configured: true as const,
    ok: result.ok,
    status: result.status,
    duration_ms: Date.now() - started,
    data: parseResponse(raw),
  };
}

function rowsFrom(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  for (const key of [
    "rows",
    "items",
    "data",
    "employees",
    "funcionarios",
    "value",
  ]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }
  return [];
}

Deno.serve(
  withSupabase({ auth: "user" }, async (request, context) => {
    const origin =
      request.headers.get("origin") ||
      "https://ti-raizes-do-futuro.vercel.app";

    if (!allowedOrigins().has(origin)) {
      return new Response(null, { status: 403 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== "POST") {
      return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
    }

    const canRead =
      (await hasPermission(context.supabase, "ti.datasul.read")) ||
      (await hasPermission(context.supabase, "ti.datasul.sync"));
    if (!canRead) return response(origin, { error: "FORBIDDEN" }, 403);

    const rawBody = await request.text();
    if (rawBody.length > 180000) {
      return response(origin, { error: "REQUEST_TOO_LARGE" }, 413);
    }

    let body: {
      action?: string;
      method?: string;
      path?: string;
      payload?: unknown;
      query?: Record<string, string | number | boolean | null>;
    };
    try {
      body = JSON.parse(rawBody || "{}");
    } catch {
      return response(origin, { error: "INVALID_JSON" }, 400);
    }

    const { data: row, error: settingError } = await context.supabase
      .from("settings")
      .select("value")
      .eq("key", "ti_datasul")
      .single();
    if (settingError) {
      return response(origin, { error: "SETTINGS_UNAVAILABLE" }, 500);
    }

    const config = (row?.value || {}) as Record<string, unknown>;
    const companyId = config.company_id ? String(config.company_id) : null;
    const healthPath = String(
      config.health_path || "/api/btb/v1/companies",
    );
    const employeesPath = config.employees_path
      ? String(config.employees_path)
      : "";
    const action = body.action || "status";

    if (action === "status") {
      return response(origin, {
        configured: Boolean(
          secret("DATASUL_BASE_URL") &&
            secret("DATASUL_USERNAME") &&
            secret("DATASUL_PASSWORD"),
        ),
        state: config,
        capabilities: {
          read: canRead,
          write: await hasPermission(
            context.supabase,
            "ti.datasul.write",
          ),
          delete: await hasPermission(
            context.supabase,
            "ti.datasul.delete",
          ),
          recently_verified: await recentlyVerified(context.supabase),
        },
        required_secrets: [
          "DATASUL_BASE_URL",
          "DATASUL_USERNAME",
          "DATASUL_PASSWORD",
        ],
      });
    }

    if (action === "health") {
      const result = await datasulRequest({
        method: "GET",
        path: healthPath,
        companyId,
      });
      const next = {
        ...config,
        enabled: result.configured,
        status: !result.configured
          ? "needs_connection"
          : result.ok
            ? "connected"
            : "error",
        last_check_at: new Date().toISOString(),
        last_error: !result.configured
          ? "Credenciais do Datasul ainda não configuradas."
          : result.ok
            ? null
            : "HTTP " + result.status,
      };
      await context.supabase
        .from("settings")
        .update({ value: next, updated_at: new Date().toISOString() })
        .eq("key", "ti_datasul");

      if (!result.configured) {
        return response(origin, { ok: false, ...result }, 424);
      }
      return response(
        origin,
        {
          ok: result.ok,
          status: result.status,
          duration_ms: result.duration_ms,
          preview: result.data,
        },
        result.ok ? 200 : 502,
      );
    }

    if (action === "preview") {
      if (!employeesPath) {
        return response(
          origin,
          {
            error: "EMPLOYEES_PATH_REQUIRED",
            message:
              "Defina o endpoint de colaboradores do Datasul antes de executar a prévia.",
          },
          409,
        );
      }
      const result = await datasulRequest({
        method: "GET",
        path: employeesPath,
        companyId,
      });
      if (!result.configured) {
        return response(origin, { ok: false, ...result }, 424);
      }
      if (!result.ok) {
        return response(
          origin,
          {
            ok: false,
            status: result.status,
            preview: result.data,
          },
          502,
        );
      }

      const rows = rowsFrom(result.data);
      const sample = rows.slice(0, 25);
      const keys = [
        ...new Set(
          sample.flatMap((item) =>
            item && typeof item === "object"
              ? Object.keys(item as Record<string, unknown>)
              : [],
          ),
        ),
      ].sort();

      return response(origin, {
        ok: true,
        status: result.status,
        total_returned: rows.length,
        keys,
        sample,
      });
    }

    if (action === "request") {
      const method = String(body.method || "GET").toUpperCase();
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        return response(origin, { error: "INVALID_METHOD" }, 400);
      }

      if (method !== "GET") {
        const permission =
          method === "DELETE"
            ? "ti.datasul.delete"
            : "ti.datasul.write";
        if (!(await hasPermission(context.supabase, permission))) {
          return response(origin, { error: "FORBIDDEN" }, 403);
        }
        if (!(await recentlyVerified(context.supabase))) {
          return response(
            origin,
            { error: "RECENT_VERIFICATION_REQUIRED" },
            428,
          );
        }
      }

      let path: string;
      try {
        path = safePath(String(body.path || ""));
      } catch {
        return response(origin, { error: "INVALID_PATH" }, 400);
      }

      const currentActor = await actor(context.supabase);
      const started = Date.now();
      let result: Awaited<ReturnType<typeof datasulRequest>> | null = null;
      let errorMessage: string | null = null;

      try {
        result = await datasulRequest({
          method,
          path,
          companyId,
          payload: body.payload,
          query: body.query,
        });
      } catch (error) {
        errorMessage =
          error instanceof Error ? error.message : "REQUEST_FAILED";
      }

      const url = secret("SUPABASE_URL");
      const serviceRole = secret("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !serviceRole) {
        return response(origin, { error: "CONFIGURATION_REQUIRED" }, 503);
      }
      const admin = createClient(url, serviceRole, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error: auditError } = await admin
        .from("ti_datasul_operations")
        .insert({
          actor_user_id: currentActor.id,
          actor_name: currentActor.name,
          method,
          path,
          request_body: method === "GET" ? null : sanitize(body.payload),
          response_status:
            result && result.configured ? result.status : null,
          response_preview:
            result && result.configured ? sanitize(result.data) : null,
          success: Boolean(
            result && result.configured && result.ok && !errorMessage,
          ),
          duration_ms:
            result && result.configured
              ? result.duration_ms
              : Date.now() - started,
          error_message: errorMessage,
        });

      if (auditError) {
        return response(origin, { error: "AUDIT_WRITE_FAILED" }, 500);
      }
      if (errorMessage) {
        return response(origin, { ok: false, error: errorMessage }, 500);
      }
      if (!result?.configured) {
        return response(origin, { ok: false, ...result }, 424);
      }

      return response(
        origin,
        {
          ok: result.ok,
          status: result.status,
          duration_ms: result.duration_ms,
          data: result.data,
        },
        result.ok ? 200 : 502,
      );
    }

    return response(origin, { error: "UNKNOWN_ACTION" }, 400);
  }),
);
