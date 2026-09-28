const encoder = new TextEncoder();

function localRuntime(request: Request) {
  try {
    const host = new URL(request.url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function isBrazilRequest(request: Request) {
  if (localRuntime(request)) return true;
  return (request.headers.get("cf-ipcountry") || "").trim().toUpperCase() === "BR";
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")
    || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

export async function requestFingerprint(
  request: Request,
  secret: string,
  scope: string,
) {
  const material = [
    scope,
    clientIp(request),
    request.headers.get("user-agent") || "unknown",
  ].join("|");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(material));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index];
  }
  return diff === 0;
}
