import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { withSupabase } from "npm:@supabase/server";
import { isBrazilRequest } from "../_shared/request-security.ts";

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
  const safeOrigin = allowedOrigins().has(origin)
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

function sanitizeForLog(value: unknown) {
  if (value === null || value === undefined) return null;
  const raw = JSON.stringify(value);
  if (raw.length <= 6000) return value;
  return { truncated: true, preview: raw.slice(0, 6000) };
}

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    const origin =
      req.headers.get("origin") ||
      "https://ti-raizes-do-futuro.vercel.app";

    if (!allowedOrigins().has(origin))
      return new Response(null, { status: 403 });
    if (!isBrazilRequest(req))
      return response(origin, { error: "REGION_NOT_ALLOWED" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== "POST")
      return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

    const rawBody = await req.text();
    if (rawBody.length > 32000)
      return response(origin, { error: "REQUEST_TOO_LARGE" }, 413);

    let body: { action?: string };
    try {
      const parsed = JSON.parse(rawBody || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return response(origin, { error: "INVALID_JSON_OBJECT" }, 400);
      }
      body = parsed as { action?: string };
    } catch {
      return response(origin, { error: "INVALID_JSON" }, 400);
    }

    const permission = async (code: string) => {
      const { data, error } = await ctx.supabase.rpc("has_permission", {
        permission_code: code,
      });
      return !error && data === true;
    };

    const canRead =
      (await permission("ti.datasul.read")) ||
      (await permission("ti.datasul.sync"));
    if (!canRead) return response(origin, { error: "FORBIDDEN" }, 403);

    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    if (!user) return response(origin, { error: "UNAUTHENTICATED" }, 401);

    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const actorName =
      profile && typeof profile === "object" && "full_name" in profile
        ? String(profile.full_name || user.email || "Usuário T.I.")
        : user.email || "Usuário T.I.";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const audit = async (args: {
      method: string;
      path: string;
      success: boolean;
      durationMs: number;
      errorMessage?: string | null;
      responsePreview?: unknown;
    }) => {
      await admin.from("ti_datasul_operations").insert({
        actor_user_id: user.id,
        actor_name: actorName,
        method: args.method,
        path: args.path,
        request_body: null,
        response_status: args.success ? 200 : 500,
        response_preview: sanitizeForLog(args.responsePreview),
        success: args.success,
        duration_ms: args.durationMs,
        error_message: args.errorMessage || null,
      });
    };

    const action = body.action || "status";

    if (action === "status") {
      const { data: row } = await admin
        .from("settings")
        .select("value")
        .eq("key", "ti_datasul")
        .maybeSingle();

      const saved =
        row?.value && typeof row.value === "object"
          ? (row.value as Record<string, unknown>)
          : {};

      return response(origin, {
        ok: true,
        configured: true,
        state: {
          enabled: true,
          status: "connected",
          mode: "internal",
          source: "supabase",
          organization: "Raízes do Futuro",
          last_check_at: saved.last_check_at || null,
          last_sync_at: saved.last_sync_at || null,
          last_error: saved.last_error || null,
        },
        capabilities: {
          read: true,
          sync: await permission("ti.datasul.sync"),
          external_api: false,
          mutations: false,
        },
        required_secrets: [],
      });
    }

    if (action === "health") {
      const started = Date.now();

      const [
        employeesResult,
        departmentsResult,
        positionsResult,
        classesResult,
        attendanceResult,
        feedbacksResult,
        reviewsResult,
      ] = await Promise.all([
        admin.from("employees").select("id", { count: "exact", head: true }),
        admin.from("departments").select("id", { count: "exact", head: true }),
        admin.from("job_positions").select("id", { count: "exact", head: true }),
        admin.from("classes").select("id", { count: "exact", head: true }),
        admin
          .from("attendance_sessions")
          .select("id", { count: "exact", head: true }),
        admin.from("feedbacks").select("id", { count: "exact", head: true }),
        admin
          .from("performance_reviews")
          .select("id", { count: "exact", head: true }),
      ]);

      const checks = [
        ["employees", employeesResult],
        ["departments", departmentsResult],
        ["job_positions", positionsResult],
        ["classes", classesResult],
        ["attendance_sessions", attendanceResult],
        ["feedbacks", feedbacksResult],
        ["performance_reviews", reviewsResult],
      ] as const;

      const failed = checks
        .filter(([, result]) => Boolean(result.error))
        .map(([name]) => name);

      const snapshot = {
        employees: employeesResult.count || 0,
        departments: departmentsResult.count || 0,
        job_positions: positionsResult.count || 0,
        classes: classesResult.count || 0,
        attendance_sessions: attendanceResult.count || 0,
        feedbacks: feedbacksResult.count || 0,
        performance_reviews: reviewsResult.count || 0,
      };

      const durationMs = Date.now() - started;
      const healthy = failed.length === 0;
      const nextState = {
        enabled: true,
        status: healthy ? "connected" : "error",
        mode: "internal",
        source: "supabase",
        organization: "Raízes do Futuro",
        last_check_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        last_error: healthy
          ? null
          : "Falha ao consultar: " + failed.join(", "),
      };

      await admin
        .from("settings")
        .update({ value: nextState, updated_at: new Date().toISOString() })
        .eq("key", "ti_datasul");

      await audit({
        method: "CHECK",
        path: "internal/health",
        success: healthy,
        durationMs,
        errorMessage: healthy ? null : nextState.last_error,
        responsePreview: snapshot,
      });

      return response(
        origin,
        {
          ok: healthy,
          status: healthy ? 200 : 500,
          duration_ms: durationMs,
          mode: "internal",
          source: "supabase",
          snapshot,
          failed_checks: failed,
        },
        healthy ? 200 : 500,
      );
    }

    if (action === "preview") {
      const started = Date.now();

      const [
        employeesResult,
        departmentsResult,
        positionsResult,
        classesResult,
      ] = await Promise.all([
        admin
          .from("employees")
          .select(
            "id,full_name,email,registration,status,member_group,access_role_code,class_id,department_id,job_position_id",
            { count: "exact" },
          )
          .order("full_name")
          .limit(25),
        admin
          .from("departments")
          .select("id,name,active")
          .order("name"),
        admin
          .from("job_positions")
          .select("id,name,active")
          .order("name"),
        admin.from("classes").select("id,name,code,active").order("name"),
      ]);

      const error =
        employeesResult.error ||
        departmentsResult.error ||
        positionsResult.error ||
        classesResult.error;

      const durationMs = Date.now() - started;
      if (error) {
        await audit({
          method: "READ",
          path: "internal/preview",
          success: false,
          durationMs,
          errorMessage: "INTERNAL_DATA_READ_FAILED",
        });
        return response(
          origin,
          { ok: false, error: "INTERNAL_DATA_READ_FAILED" },
          500,
        );
      }

      const preview = {
        employees: employeesResult.data || [],
        total_employees: employeesResult.count || 0,
        departments: departmentsResult.data || [],
        job_positions: positionsResult.data || [],
        classes: classesResult.data || [],
      };

      await audit({
        method: "READ",
        path: "internal/preview",
        success: true,
        durationMs,
        responsePreview: {
          total_employees: preview.total_employees,
          departments: preview.departments.length,
          job_positions: preview.job_positions.length,
          classes: preview.classes.length,
        },
      });

      return response(origin, {
        ok: true,
        status: 200,
        duration_ms: durationMs,
        mode: "internal",
        source: "supabase",
        preview,
      });
    }

    return response(origin, { error: "UNKNOWN_ACTION" }, 400);
  }),
);
