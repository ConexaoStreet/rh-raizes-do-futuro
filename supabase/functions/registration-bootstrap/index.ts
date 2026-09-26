import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { observe, observeError } from "../_shared/observability.ts";

const PROD_ORIGIN = "https://rh-raizes-do-futuro.vercel.app";

function allowedOrigins() {
  return new Set(
    [PROD_ORIGIN, ...(Deno.env.get("ALLOWED_ORIGINS") || "").split(",")]
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function cors(origin: string) {
  const safe = allowedOrigins().has(origin) ? origin : PROD_ORIGIN;
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

function transientJwtError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown };
  return (
    value.code === "PGRST303" &&
    typeof value.message === "string" &&
    value.message.toLowerCase().includes("future")
  );
}

async function withJwtSkewRetry<T extends { error?: unknown }>(
  operation: () => PromiseLike<T>,
) {
  let result = await operation();
  if (!transientJwtError(result.error)) return result;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  result = await operation();
  return result;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const origin = request.headers.get("origin") || PROD_ORIGIN;
  if (!allowedOrigins().has(origin)) {
    observe("registration_bootstrap.request", {
      outcome: "denied_origin",
      status: 403,
      latency_ms: Date.now() - startedAt,
    });
    return new Response(null, { status: 403 });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST") {
    observe("registration_bootstrap.request", {
      outcome: "method_not_allowed",
      status: 405,
      latency_ms: Date.now() - startedAt,
    });
    return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const raw = await request.text();
    if (raw.length > 4096) {
      observe("registration_bootstrap.request", {
        outcome: "payload_too_large",
        status: 400,
        latency_ms: Date.now() - startedAt,
      });
      return response(origin, { error: "INVALID_REQUEST" }, 400);
    }
    const body = JSON.parse(raw || "{}") as {
      action?: "options" | "match";
      full_name?: string;
    };

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) {
      return response(origin, { error: "CONFIGURATION_REQUIRED" }, 503);
    }

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.action === "options") {
      const [classResult, departmentResult] = await Promise.all([
        withJwtSkewRetry(() =>
          admin
            .from("classes")
            .select("id,name,code")
            .eq("active", true)
            .order("created_at")
            .limit(1)
            .maybeSingle(),
        ),
        withJwtSkewRetry(() =>
          admin
            .from("departments")
            .select("id,name")
            .eq("active", true)
            .order("name"),
        ),
      ]);

      if (classResult.error || departmentResult.error) {
        throw classResult.error || departmentResult.error;
      }

      observe("registration_bootstrap.options", {
        outcome: "ok",
        status: 200,
        department_count: departmentResult.data?.length || 0,
        class_available: Boolean(classResult.data),
        latency_ms: Date.now() - startedAt,
      });
      return response(origin, {
        class: classResult.data,
        departments: departmentResult.data || [],
        roles: [
          { code: "COLLABORATOR", name: "Colaborador" },
          { code: "MANAGER", name: "Gestor" },
          { code: "DIRECTOR", name: "Diretor" },
          { code: "INSTRUCTOR", name: "Instrutor" },
        ],
      });
    }

    if (body.action === "match") {
      const submitted = normalizeName(String(body.full_name || ""));
      if (submitted.length < 4) {
        observe("registration_bootstrap.match", {
          outcome: "incomplete_name",
          status: 200,
          latency_ms: Date.now() - startedAt,
        });
        return response(origin, {
          matched: false,
          reason: "INCOMPLETE_NAME",
        });
      }

      const { data, error } = await withJwtSkewRetry(() =>
        admin
          .from("employees")
          .select("full_name")
          .eq("status", "active")
          .is("profile_id", null)
          .limit(1000),
      );
      if (error) throw error;

      const matches = (data || []).filter(
        (employee) =>
          normalizeName(employee.full_name) === submitted,
      );

      if (matches.length === 1) {
        observe("registration_bootstrap.match", {
          outcome: "matched",
          status: 200,
          latency_ms: Date.now() - startedAt,
        });
        return response(origin, {
          matched: true,
          canonical_name: matches[0].full_name,
        });
      }
      if (matches.length > 1) {
        observe("registration_bootstrap.match", {
          outcome: "ambiguous_name",
          status: 200,
          latency_ms: Date.now() - startedAt,
        });
        return response(origin, {
          matched: false,
          reason: "AMBIGUOUS_NAME",
        });
      }
      observe("registration_bootstrap.match", {
        outcome: "not_found",
        status: 200,
        latency_ms: Date.now() - startedAt,
      });
      return response(origin, {
        matched: false,
        reason: "NOT_FOUND",
      });
    }

    observe("registration_bootstrap.request", {
      outcome: "invalid_action",
      status: 400,
      latency_ms: Date.now() - startedAt,
    });
    return response(origin, { error: "INVALID_ACTION" }, 400);
  } catch (error) {
    observeError("registration_bootstrap.error", error, {
      status: 503,
      latency_ms: Date.now() - startedAt,
    });
    return response(origin, { error: "UNAVAILABLE" }, 503);
  }
});
