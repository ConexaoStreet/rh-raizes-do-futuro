import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { withSupabase } from "npm:@supabase/server";

const BUCKET = "espro-profile-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_BYTES = 20 * 1024;

const ORIGINS = new Set([
  "https://rh-raizes-do-futuro.vercel.app",
  "https://ti-raizes-do-futuro.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

function cors(origin: string) {
  const safe = ORIGINS.has(origin)
    ? origin
    : "https://rh-raizes-do-futuro.vercel.app";
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

function pngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  return {
    mime: "image/png",
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

function jpegDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;

    const length = (bytes[offset] << 8) + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        mime: "image/jpeg",
        height: (bytes[offset + 3] << 8) + bytes[offset + 4],
        width: (bytes[offset + 5] << 8) + bytes[offset + 6],
      };
    }

    offset += length;
  }

  return null;
}

async function sha256(bytes: Uint8Array) {
  const copy = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(
  withSupabase({ auth: "user" }, async (request, context) => {
    const origin =
      request.headers.get("origin") ||
      "https://rh-raizes-do-futuro.vercel.app";
    if (!ORIGINS.has(origin)) return new Response(null, { status: 403 });
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== "POST") {
      return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
    }

    const {
      data: { user },
    } = await context.supabase.auth.getUser();
    if (!user) return response(origin, { error: "UNAUTHORIZED" }, 401);

    const body = (await request.json().catch(() => ({}))) as {
      path?: string;
    };
    const path = String(body.path || "").trim();
    if (
      !path ||
      path.length > 500 ||
      path.includes("..") ||
      path.split("/")[0] !== user.id
    ) {
      return response(origin, { error: "INVALID_PATH" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) {
      return response(origin, { error: "CONFIGURATION_REQUIRED" }, 503);
    }
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: file, error: downloadError } = await admin.storage
      .from(BUCKET)
      .download(path);
    if (downloadError || !file) {
      return response(origin, { error: "FILE_NOT_FOUND" }, 404);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const dimensions = pngDimensions(bytes) || jpegDimensions(bytes);
    const problems: string[] = [];

    if (bytes.length < MIN_BYTES) problems.push("FILE_TOO_SMALL");
    if (bytes.length > MAX_BYTES) problems.push("FILE_TOO_LARGE");
    if (!dimensions) problems.push("INVALID_IMAGE");

    if (dimensions) {
      if (dimensions.width < 400 || dimensions.height < 400) {
        problems.push("LOW_RESOLUTION");
      }
      if (dimensions.width > 7000 || dimensions.height > 7000) {
        problems.push("UNUSUAL_RESOLUTION");
      }
      const ratio = dimensions.width / dimensions.height;
      if (ratio < 0.55 || ratio > 1.65) {
        problems.push("UNUSUAL_ASPECT_RATIO");
      }
    }

    const hash = await sha256(bytes);
    const { data: others, error: duplicateQueryError } = await admin
      .from("profiles")
      .select("id,espro_photo_verification")
      .neq("id", user.id)
      .limit(1000);
    if (duplicateQueryError) {
      return response(origin, { error: "VERIFICATION_UNAVAILABLE" }, 503);
    }

    const reused = (others || []).some((row) => {
      const verification =
        row.espro_photo_verification &&
        typeof row.espro_photo_verification === "object"
          ? (row.espro_photo_verification as Record<string, unknown>)
          : {};
      return verification.sha256 === hash;
    });
    if (reused) problems.push("DUPLICATE_PHOTO");

    const status = problems.length ? "rejected" : "basic_passed";
    const verification = {
      checked_at: new Date().toISOString(),
      sha256: hash,
      byte_size: bytes.length,
      mime: dimensions?.mime || null,
      width: dimensions?.width || null,
      height: dimensions?.height || null,
      checks: {
        valid_image: Boolean(dimensions),
        minimum_size: bytes.length >= MIN_BYTES,
        maximum_size: bytes.length <= MAX_BYTES,
        minimum_resolution: Boolean(
          dimensions &&
            dimensions.width >= 400 &&
            dimensions.height >= 400,
        ),
        plausible_aspect_ratio: Boolean(
          dimensions &&
            dimensions.width / dimensions.height >= 0.55 &&
            dimensions.width / dimensions.height <= 1.65,
        ),
        unique_file: !reused,
      },
      problems,
      assurance: "basic_file_and_plausibility_check",
    };

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        espro_photo_path: path,
        espro_photo_status: status,
        espro_photo_verification: verification,
        espro_photo_submitted_at: new Date().toISOString(),
        espro_photo_reviewed_at: null,
        espro_photo_reviewed_by: null,
        espro_photo_rejection_reason: problems.length
          ? "A foto não passou pela verificação básica."
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return response(origin, { error: "PROFILE_UPDATE_FAILED" }, 500);
    }

    await admin.from("audit_logs").insert({
      event_type: "data_change",
      severity: problems.length ? "warning" : "info",
      actor_user_id: user.id,
      actor_name: user.email || "Usuário",
      actor_roles: [],
      action: "submit_espro_photo",
      module: "profiles",
      entity_id: user.id,
      old_values: null,
      new_values: {
        espro_photo_status: status,
        espro_photo_path: path,
      },
      context: {
        verification: {
          mime: verification.mime,
          width: verification.width,
          height: verification.height,
          problems,
        },
      },
      success: problems.length === 0,
    });

    return response(origin, {
      ok: problems.length === 0,
      status,
      verification: {
        mime: verification.mime,
        width: verification.width,
        height: verification.height,
        checks: verification.checks,
        problems,
      },
      message: problems.length
        ? "A foto foi recebida, mas precisa ser substituída."
        : "A foto passou pela verificação básica e pode seguir para aprovação.",
    });
  }),
);
