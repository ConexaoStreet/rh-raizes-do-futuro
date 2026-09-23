import { withSupabase } from "npm:@supabase/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function getSecret(name: string) {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function joinUrl(base: string, path: string) {
  return new URL(path.replace(/^\/+/, ""), base.endsWith("/") ? base : base + "/").toString();
}

async function datasulFetch(path: string, companyId: string | null) {
  const baseUrl = getSecret("DATASUL_BASE_URL");
  const username = getSecret("DATASUL_USERNAME");
  const password = getSecret("DATASUL_PASSWORD");
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
  const headers = new Headers({
    Accept: "application/json",
    Authorization: "Basic " + btoa(username + ":" + password),
  });
  if (companyId) headers.set("companyId", companyId);
  const res = await fetch(joinUrl(baseUrl, path), { method: "GET", headers });
  const raw = await res.text();
  let data: unknown = raw;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw.slice(0, 4000);
  }
  return {
    configured: true as const,
    ok: res.ok,
    status: res.status,
    data,
  };
}

function extractRows(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ["rows", "items", "data", "employees", "funcionarios", "value"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);

    const { data: allowed, error: permissionError } = await ctx.supabase.rpc("has_permission", {
      permission_code: "ti.datasul.sync",
    });
    if (permissionError || !allowed) return response({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({})) as { action?: string };
    const action = body.action || "status";

    const { data: row, error: settingError } = await ctx.supabase
      .from("settings")
      .select("value")
      .eq("key", "ti_datasul")
      .single();
    if (settingError) return response({ error: "settings_unavailable" }, 500);

    const config = (row?.value || {}) as Record<string, unknown>;
    const healthPath = String(config.health_path || "/api/btb/v1/companies");
    const employeesPath = config.employees_path ? String(config.employees_path) : "";
    const companyId = config.company_id ? String(config.company_id) : null;

    if (action === "status") {
      return response({
        configured: Boolean(getSecret("DATASUL_BASE_URL") && getSecret("DATASUL_USERNAME") && getSecret("DATASUL_PASSWORD")),
        state: config,
        required_secrets: ["DATASUL_BASE_URL", "DATASUL_USERNAME", "DATASUL_PASSWORD"],
      });
    }

    if (action === "health") {
      const result = await datasulFetch(healthPath, companyId);
      const next = {
        ...config,
        enabled: result.configured,
        status: !result.configured ? "needs_connection" : result.ok ? "connected" : "error",
        last_check_at: new Date().toISOString(),
        last_error: !result.configured
          ? "Credenciais do Datasul ainda não configuradas."
          : result.ok
            ? null
            : "HTTP " + result.status,
      };
      await ctx.supabase.from("settings").update({ value: next }).eq("key", "ti_datasul");
      if (!result.configured) return response({ ok: false, ...result }, 424);
      return response({ ok: result.ok, status: result.status, preview: result.data }, result.ok ? 200 : 502);
    }

    if (action === "preview") {
      if (!employeesPath) {
        return response({
          error: "employees_path_required",
          message: "Defina o endpoint de colaboradores do Datasul antes de executar a prévia.",
        }, 409);
      }
      const result = await datasulFetch(employeesPath, companyId);
      if (!result.configured) return response({ ok: false, ...result }, 424);
      if (!result.ok) return response({ ok: false, status: result.status, preview: result.data }, 502);
      const rows = extractRows(result.data);
      const sample = rows.slice(0, 10);
      const keys = [...new Set(sample.flatMap((item) =>
        item && typeof item === "object" ? Object.keys(item as Record<string, unknown>) : []
      ))].sort();
      return response({
        ok: true,
        status: result.status,
        total_returned: rows.length,
        keys,
        sample,
      });
    }

    return response({ error: "unknown_action" }, 400);
  }),
);
