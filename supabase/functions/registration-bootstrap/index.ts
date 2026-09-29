import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { observe, observeError } from "../_shared/observability.ts";
import { isBrazilRequest, requestFingerprint } from "../_shared/request-security.ts";

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
  if (!isBrazilRequest(request)) {
    observe("registration_bootstrap.request", {
      outcome: "denied_country",
      status: 403,
      latency_ms: Date.now() - startedAt,
    });
    return response(origin, { error: "REGION_NOT_ALLOWED" }, 403);
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

    const fingerprint = await requestFingerprint(
      request,
      serviceRole,
      `registration-bootstrap:${body.action || "unknown"}`,
    );
    const maxAttempts = body.action === "match" ? 30 : 30;
    const windowSeconds = body.action === "match" ? 900 : 300;
    const { data: rateAllowed, error: rateError } = await admin.rpc(
      "consume_edge_rate_limit",
      {
        rate_scope: `registration-bootstrap:${body.action || "unknown"}`,
        fingerprint_hash: fingerprint,
        max_attempts: maxAttempts,
        window_seconds: windowSeconds,
      },
    );
    if (rateError) throw rateError;
    if (rateAllowed !== true) {
      observe("registration_bootstrap.request", {
        outcome: "rate_limited",
        status: 429,
        latency_ms: Date.now() - startedAt,
      });
      return response(origin, { error: "RATE_LIMITED" }, 429);
    }

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
          .select("full_name,profile_id")
          .eq("status", "active")
          .limit(1000),
      );
      if (error) throw error;

      const records = (data || []).map((employee) => ({
        ...employee,
        normalized_name: normalizeName(employee.full_name),
      }));
      const alreadyRegistered = records.find(
        (employee) =>
          Boolean(employee.profile_id) && employee.normalized_name === submitted,
      );
      if (alreadyRegistered) {
        observe("registration_bootstrap.match", {
          outcome: "already_registered",
          status: 200,
          latency_ms: Date.now() - startedAt,
        });
        return response(origin, {
          matched: false,
          reason: "ALREADY_REGISTERED",
          canonical_name: alreadyRegistered.full_name,
        });
      }

      const eligible = records.filter((employee) => !employee.profile_id);
      const matches = eligible.filter(
        (employee) => employee.normalized_name === submitted,
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
      const suggestions = Array.from(
        new Set(
          eligible
            .filter(
              (employee) =>
                employee.normalized_name.startsWith(submitted) ||
                employee.normalized_name.includes(` ${submitted}`),
            )
            .sort((left, right) => {
              const leftStarts = left.normalized_name.startsWith(submitted) ? 0 : 1;
              const rightStarts = right.normalized_name.startsWith(submitted) ? 0 : 1;
              return (
                leftStarts - rightStarts ||
                left.full_name.localeCompare(right.full_name, "pt-BR")
              );
            })
            .map((employee) => employee.full_name),
        ),
      ).slice(0, 5);

      observe("registration_bootstrap.match", {
        outcome: suggestions.length ? "suggestions" : "not_found",
        status: 200,
        suggestion_count: suggestions.length,
        latency_ms: Date.now() - startedAt,
      });
      return response(origin, {
        matched: false,
        reason: suggestions.length ? "SUGGESTIONS" : "NOT_FOUND",
        suggestions,
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
