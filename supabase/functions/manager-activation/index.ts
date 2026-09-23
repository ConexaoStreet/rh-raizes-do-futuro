import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error("CONFIGURATION_REQUIRED");
  return value;
};

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "Content-Type": "application/json",
});

const respond = (origin: string, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function strongPassword(value: string) {
  return (
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!allowed.includes(origin)) return new Response(null, { status: 403 });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST")
    return respond(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 4096) return respond(origin, { error: "INVALID_REQUEST" }, 400);

    const raw = await request.text();
    if (raw.length > 4096) return respond(origin, { error: "INVALID_REQUEST" }, 400);

    const body = JSON.parse(raw) as {
      activation_code?: string;
      email?: string;
      password?: string;
      terms?: boolean;
    };

    const activationCode = String(body.activation_code || "").trim().toUpperCase();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (activationCode.length < 10)
      return respond(origin, { error: "INVALID_ACTIVATION" }, 400);
    if (!/^[^\s@]+@gmail\.com$/i.test(email))
      return respond(origin, { error: "GMAIL_REQUIRED" }, 400);
    if (!strongPassword(password))
      return respond(origin, { error: "WEAK_PASSWORD" }, 400);
    if (body.terms !== true)
      return respond(origin, { error: "TERMS_REQUIRED" }, 400);

    const admin = createClient(
      required("SUPABASE_URL"),
      required("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const activationHash = await sha256(activationCode);
    const { data: invite, error: inviteError } = await admin
      .from("manager_activation_invites")
      .select("id,employee_id,code_hash,expires_at,used_at,locked_at,attempts,max_attempts")
      .eq("code_hash", activationHash)
      .maybeSingle();

    if (
      inviteError ||
      !invite ||
      invite.used_at ||
      new Date(invite.expires_at).getTime() <= Date.now() ||
      invite.attempts >= invite.max_attempts
    ) {
      return respond(origin, { error: "INVALID_ACTIVATION" }, 400);
    }

    if (invite.locked_at) {
      const lockedAt = new Date(invite.locked_at).getTime();
      if (Date.now() - lockedAt < 10 * 60 * 1000)
        return respond(origin, { error: "ACTIVATION_IN_PROGRESS" }, 409);

      await admin
        .from("manager_activation_invites")
        .update({ locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", invite.id)
        .is("used_at", null);
    }

    const now = new Date().toISOString();
    const { data: locked, error: lockError } = await admin
      .from("manager_activation_invites")
      .update({ locked_at: now, updated_at: now })
      .eq("id", invite.id)
      .is("used_at", null)
      .is("locked_at", null)
      .select("id")
      .maybeSingle();

    if (lockError || !locked)
      return respond(origin, { error: "ACTIVATION_IN_PROGRESS" }, 409);

    const unlock = async () => {
      await admin
        .from("manager_activation_invites")
        .update({ locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", invite.id)
        .is("used_at", null);
    };

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id,full_name,status,profile_id")
      .eq("id", invite.employee_id)
      .single();

    if (
      employeeError ||
      !employee ||
      employee.status !== "active" ||
      employee.profile_id
    ) {
      await unlock();
      return respond(origin, { error: "INVALID_ACTIVATION" }, 400);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: employee.full_name },
    });

    if (createError || !created.user) {
      await unlock();
      return respond(origin, { error: "EMAIL_UNAVAILABLE" }, 409);
    }

    const userId = created.user.id;
    const { error: finalizeError } = await admin.rpc("finalize_manager_activation", {
      invite_identifier: invite.id,
      user_identifier: userId,
      email_value: email,
    });

    if (finalizeError) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      await unlock();
      return respond(origin, { error: "ACTIVATION_FAILED" }, 500);
    }

    return respond(origin, { ok: true, email });
  } catch {
    return respond(origin, { error: "UNAVAILABLE" }, 503);
  }
});
