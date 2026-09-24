import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://ti-raizes-do-futuro.vercel.app",
  "http://127.0.0.1:4174",
  "http://localhost:4174",
]);

function allowedOrigins() {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function cors(origin: string) {
  const safe = ALLOWED_ORIGINS.has(origin)
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

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error("CONFIGURATION_REQUIRED");
  return value;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sessionIdFromToken(token: string) {
  try {
    const encoded = token.split(".")[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/");
    const padded = encoded.padEnd(
      encoded.length + ((4 - (encoded.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(padded)) as {
      sub?: string;
      session_id?: string;
    };
    return payload;
  } catch {
    return {};
  }
}

Deno.serve(async (request) => {
  const origin =
    request.headers.get("origin") ||
    "https://ti-raizes-do-futuro.vercel.app";
  const allowed = allowedOrigins();

  if (!allowed.has(origin)) return new Response(null, { status: 403 });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST")
    return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return response(origin, { error: "INVALID_REQUEST" }, 400);

    const body = JSON.parse(raw || "{}") as {
      action?: "login" | "confirm";
      code?: string;
      code_id?: string;
      claim_token?: string;
    };

    const admin = createClient(
      required("SUPABASE_URL"),
      required("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    if (body.action === "login") {
      const input = String(body.code || "").trim();
      const forwarded =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("cf-connecting-ip") ||
        "unknown";
      const userAgent = request.headers.get("user-agent") || "unknown";
      const fingerprint = await sha256(
        forwarded.split(",")[0].trim() + "|" + userAgent,
      );

      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const claimToken = Array.from(randomBytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const claimHash = await sha256(claimToken);

      const { data: claim, error: claimError } = await admin.rpc(
        "claim_ti_access_code",
        {
          input_code: input,
          fingerprint_hash: fingerprint,
          claim_hash: claimHash,
        },
      );

      if (claimError) {
        const message = claimError.message || "";
        if (message.includes("RATE_LIMITED"))
          return response(origin, { error: "RATE_LIMITED" }, 429);
        return response(origin, { error: "INVALID_CODE" }, 401);
      }

      const result = claim as {
        code_id?: string;
        user_id?: string;
      };
      if (!result?.code_id || !result?.user_id)
        return response(origin, { error: "INVALID_CODE" }, 401);

      const [{ data: authUser, error: userError }, { data: profile }] =
        await Promise.all([
          admin.auth.admin.getUserById(result.user_id),
          admin
            .from("profiles")
            .select("status")
            .eq("id", result.user_id)
            .maybeSingle(),
        ]);

      if (
        userError ||
        !authUser.user?.email ||
        profile?.status !== "active"
      ) {
        return response(origin, { error: "ACCESS_UNAVAILABLE" }, 403);
      }

      const { data: link, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email: authUser.user.email,
        });

      if (linkError || !link.properties?.hashed_token) {
        return response(origin, { error: "SESSION_UNAVAILABLE" }, 503);
      }

      return response(origin, {
        ok: true,
        token_hash: link.properties.hashed_token,
        code_id: result.code_id,
        claim_token: claimToken,
      });
    }

    if (body.action === "confirm") {
      const token = (request.headers.get("authorization") || "")
        .replace(/^Bearer\s+/i, "")
        .trim();
      if (!token || !body.code_id || !body.claim_token)
        return response(origin, { error: "FORBIDDEN" }, 401);

      const { data: verified, error: userError } =
        await admin.auth.getUser(token);
      if (userError || !verified.user)
        return response(origin, { error: "FORBIDDEN" }, 401);

      const claims = sessionIdFromToken(token);
      if (
        claims.sub !== verified.user.id ||
        !claims.session_id
      ) {
        return response(origin, { error: "INVALID_SESSION" }, 401);
      }

      const { data, error } = await admin.rpc(
        "confirm_ti_access_code_session",
        {
          code_identifier: body.code_id,
          user_identifier: verified.user.id,
          session_identifier: claims.session_id,
          claim_token: body.claim_token,
        },
      );

      if (error || data !== true)
        return response(origin, { error: "CONFIRM_FAILED" }, 403);

      return response(origin, { ok: true });
    }

    return response(origin, { error: "INVALID_ACTION" }, 400);
  } catch (error) {
    console.error("ti_code_login_error", error);
    return response(origin, { error: "UNAVAILABLE" }, 503);
  }
});
