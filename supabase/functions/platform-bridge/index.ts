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

function secret(name: string) {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

async function githubStatus(repo: string, branch: string) {
  const token = secret("GITHUB_TOKEN");
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Raizes-do-Futuro-TI",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=5`,
    { headers },
  );
  const raw = await res.text();
  let data: unknown = raw;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw.slice(0, 3000);
  }
  if (!res.ok)
    return {
      configured: Boolean(token),
      status: res.status === 403 && !token ? "partial" : "error",
      http_status: res.status,
      data,
      mode: token ? "authenticated" : "public",
    };
  const runs = Array.isArray((data as { workflow_runs?: unknown[] })?.workflow_runs)
    ? (data as { workflow_runs: Record<string, unknown>[] }).workflow_runs
    : [];
  return {
    configured: true,
    status: token ? "connected" : "partial",
    mode: token ? "authenticated" : "public",
    runs: runs.map((run) => ({
      id: run.id,
      name: run.name,
      display_title: run.display_title,
      status: run.status,
      conclusion: run.conclusion,
      head_sha: run.head_sha,
      created_at: run.created_at,
      updated_at: run.updated_at,
      html_url: run.html_url,
    })),
  };
}

async function vercelStatus(project: string, productionUrl: string | null) {
  const token = secret("VERCEL_TOKEN");
  const teamId = secret("VERCEL_TEAM_ID");
  if (!token) {
    if (!productionUrl) return { configured: false, status: "needs_secret" };
    try {
      const started = performance.now();
      const health = await fetch(productionUrl, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "Raizes-do-Futuro-TI-Health" },
      });
      return {
        configured: false,
        status: health.ok ? "partial" : "error",
        mode: "health_only",
        production_url: productionUrl,
        http_status: health.status,
        duration_ms: Math.round(performance.now() - started),
      };
    } catch (error) {
      return {
        configured: false,
        status: "error",
        mode: "health_only",
        production_url: productionUrl,
        error: error instanceof Error ? error.message : "health_failed",
      };
    }
  }
  const query = new URLSearchParams({ projectId: project, limit: "5" });
  if (teamId) query.set("teamId", teamId);
  const res = await fetch(`https://api.vercel.com/v13/deployments?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await res.text();
  let data: unknown = raw;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw.slice(0, 3000);
  }
  if (!res.ok) return { configured: true, status: "error", http_status: res.status, data };
  const deployments = Array.isArray((data as { deployments?: unknown[] })?.deployments)
    ? (data as { deployments: Record<string, unknown>[] }).deployments
    : [];
  return {
    configured: true,
    status: "connected",
    deployments: deployments.map((item) => ({
      uid: item.uid,
      name: item.name,
      url: item.url,
      state: item.state,
      target: item.target,
      created: item.created,
      ready: item.ready,
      meta: item.meta,
    })),
  };
}

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);

    const { data: allowed, error: permissionError } = await ctx.supabase.rpc("has_permission", {
      permission_code: "ti.view",
    });
    if (permissionError || !allowed) return response({ error: "forbidden" }, 403);

    const { data: rows, error: settingsError } = await ctx.supabase
      .from("settings")
      .select("key,value")
      .in("key", ["ti_github", "ti_vercel"]);
    if (settingsError) return response({ error: "settings_unavailable" }, 500);

    const settings = Object.fromEntries((rows || []).map((row) => [row.key, row.value || {}]));
    const github = settings.ti_github as Record<string, unknown>;
    const vercel = settings.ti_vercel as Record<string, unknown>;
    const repo = String(github.repository || "ConexaoStreet/rh-raizes-do-futuro");
    const branch = String(github.branch || "main");
    const project = String(vercel.project || "rh-raizes-do-futuro");
    const productionUrl =
      typeof vercel.production_url === "string" && vercel.production_url
        ? vercel.production_url
        : null;

    const [githubResult, vercelResult] = await Promise.all([
      githubStatus(repo, branch),
      vercelStatus(project, productionUrl),
    ]);

    const now = new Date().toISOString();
    const canManage = await ctx.supabase.rpc("has_permission", { permission_code: "ti.manage" });

    if (canManage.data === true) {
      await Promise.all([
        ctx.supabase.from("settings").update({
          value: {
            ...github,
            enabled: githubResult.status === "connected" || githubResult.status === "partial",
            status: githubResult.status,
            last_check_at: now,
            last_error: githubResult.status === "error" ? "Falha ao consultar GitHub." : null,
          },
        }).eq("key", "ti_github"),
        ctx.supabase.from("settings").update({
          value: {
            ...vercel,
            enabled: vercelResult.status === "connected" || vercelResult.status === "partial",
            status: vercelResult.status,
            last_check_at: now,
            last_error: vercelResult.status === "error" ? "Falha ao consultar Vercel." : null,
          },
        }).eq("key", "ti_vercel"),
      ]);
    }

    return response({
      github: githubResult,
      vercel: vercelResult,
      required_secrets: {
        github: ["GITHUB_TOKEN"],
        vercel: ["VERCEL_TOKEN", "VERCEL_TEAM_ID"],
      },
    });
  }),
);
