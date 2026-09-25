import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { withSupabase } from "npm:@supabase/server";

const PROD_ORIGINS = new Set([
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
  return new Set([...PROD_ORIGINS, ...extra]);
}

function cors(origin: string) {
  const allowed = allowedOrigins();
  const safeOrigin = allowed.has(origin)
    ? origin
    : "https://ti-raizes-do-futuro.vercel.app";
  return {
    "Access-Control-Allow-Origin": safeOrigin,
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

function safePath(path: string) {
  const clean = path.trim();
  if (
    !clean.startsWith("/") ||
    clean.includes("://") ||
    clean.includes("\\") ||
    clean.includes("\0") ||
    clean.length > 1200
  ) {
    throw new Error("INVALID_PATH");
  }
  return clean;
}

function joinUrl(base: string, path: string) {
  const url = new URL(base);
  const cleanPath = safePath(path);
  url.pathname = cleanPath;
  url.search = "";
  url.hash = "";
  return url;
}

function sanitizeForLog(value: unknown) {
  if (value === null || value === undefined) return null;
  const raw = JSON.stringify(value);
  if (raw.length <= 6000) return value;
  return { truncated: true, preview: raw.slice(0, 6000) };
}

function parsePayload(raw: string) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { text: raw.slice(0, 12000) };
  }
}

async function permission(
  supabase: ReturnType<typeof createClient>,
  code: string,
) {
  const { data, error } = await supabase.rpc("has_permission", {
    permission_code: code,
  });
  if (error) return false;
  return data === true;
}

async function recentVerification(
  supabase: ReturnType<typeof createClient>,
) {
  const { data, error } = await supabase.rpc("bootstrap");
  if (error || !data || typeof data !== "object") return false;
  return (data as Record<string, unknown>).recently_verified === true;
}

async function actorContext(
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
  const url = joinUrl(baseUrl, args.path);
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
    const serialized = JSON.stringify(args.payload);
    if (serialized.length > 150000) throw new Error("PAYLOAD_TOO_LARGE");
    headers.set("Content-Type", "application/json");
    init.body = serialized;
  }

  const started = Date.now();
  const res = await fetch(url, init);
  const raw = await res.text();
  const data = parsePayload(raw);

  return {
    configured: true as const,
    ok: res.ok,
    status: res.status,
    duration_ms: Date.now() - started,
    data,
  };
}

function extractRows(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const key of [
    "rows",
    "items",
    "data",
    "employees",
    "funcionarios",
    "value",
  ]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    const origin =
      req.headers.get("origin") ||
      "https://ti-raizes-do-futuro.vercel.app";
    if (!allowedOrigins().has(origin))
      return new Response(null, { status: 403 });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== "POST")
      return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

    const canRead =
      (await permission(ctx.supabase, "ti.datasul.read")) ||
      (await permission(ctx.supabase, "ti.datasul.sync"));
    if (!canRead) return response(origin, { error: "FORBIDDEN" }, 403);

    const rawBody = await req.text();
    if (rawBody.length > 180000)
      return response(origin, { error: "REQUEST_TOO_LARGE" }, 413);

    const body = JSON.parse(rawBody || "{}") as {
      action?: string;
      method?: string;
      path?: string;
      payload?: unknown;
      query?: Record<string, string | number | boolean | null>;
    };
    const action = body.action || "status";

    const { data: row, error: settingError } = await ctx.supabase
      .from("settings")
      .select("value")
      .eq("key", "ti_datasul")
      .single();
    if (settingError)
      return response(origin, { error: "SETTINGS_UNAVAILABLE" }, 500);

    const config = (row?.value || {}) as Record<string, unknown>;
    const healthPath = String(
      config.health_path || "/api/btb/v1/companies",
    );
    const employeesPath = config.employees_path
      ? String(config.employees_path)
      : "";
    const companyId = config.company_id
      ? String(config.company_id)
      : null;

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
          write: await permission(ctx.supabase, "ti.datasul.write"),
          delete: await permission(ctx.supabase, "ti.datasul.delete"),
          recently_verified: await recentVerification(ctx.supabase),
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
      await ctx.supabase
        .from("settings")
        .update({ value: next, updated_at: new Date().toISOString() })
        .eq("key", "ti_datasul");

      if (!result.configured)
        return response(origin, { ok: false, ...result }, 424);
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
      if (!result.configured)
        return response(origin, { ok: false, ...result }, 424);
      if (!result.ok)
        return response(
          origin,
          {
            ok: false,
            status: result.status,
            preview: result.data,
          },
          502,
        );

      const rows = extractRows(result.data);
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
        const required =
          method === "DELETE"
            ? "ti.datasul.delete"
            : "ti.datasul.write";
        if (!(await permission(ctx.supabase, required))) {
          return response(origin, { error: "FORBIDDEN" }, 403);
        }
        if (!(await recentVerification(ctx.supabase))) {
          return response(
            origin,
            { error: "RECENT_VERIFICATION_REQUIRED" },
            428,
          );
        }
      }

      let path = "";
      try {
        path = safePath(String(body.path || ""));
      } catch {
        return response(origin, { error: "INVALID_PATH" }, 400);
      }

      const actor = await actorContext(ctx.supabase);
      const started = Date.now();
      let result:
        | Awaited<ReturnType<typeof datasulRequest>>
        | null = null;
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

      const admin = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      await admin.from("ti_datasul_operations").insert({
        actor_user_id: actor.id,
        actor_name: actor.name,
        method,
        path,
        request_body:
          method === "GET"
            ? null
            : (sanitizeForLog(body.payload) as Record<string, unknown> | null),
        response_status:
          result && result.configured ? result.status : null,
        response_preview:
          result && result.configured
            ? (sanitizeForLog(result.data) as Record<string, unknown> | null)
            : null,
        success: Boolean(
          result && result.configured && result.ok && !errorMessage,
        ),
        duration_ms:
          result && result.configured
            ? result.duration_ms
            : Date.now() - started,
        error_message: errorMessage,
      });

      if (errorMessage)
        return response(
          origin,
          { ok: false, error: errorMessage },
          500,
        );
      if (!result?.configured)
        return response(origin, { ok: false, ...result }, 424);

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
