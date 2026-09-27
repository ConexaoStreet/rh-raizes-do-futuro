type FieldValue = string | number | boolean | null | undefined;

type Fields = Record<string, FieldValue>;

const sensitiveKey =
  /email|full_?name|phone|document|registration|reason|notes|message|body|token|secret|password|claim|fingerprint|authorization|endpoint|stack|ip_address|user_id|session_id/i;

function clean(fields: Fields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key, value]) => !sensitiveKey.test(key) && value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 120) : value,
      ]),
  );
}

function safeCode(value: unknown) {
  return String(value || "unknown")
    .replace(/[^A-Za-z0-9_.:-]/g, "_")
    .slice(0, 80);
}

export function observe(event: string, fields: Fields = {}) {
  if (!event) return;
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "raizes-rh",
      source: "supabase-edge",
      environment: Deno.env.get("APP_ENV") || "production",
      version: Deno.env.get("APP_VERSION") || "unknown",
      event: safeCode(event),
      ...clean(fields),
    }),
  );
}

export function observeError(
  event: string,
  error: unknown,
  fields: Fields = {},
) {
  const type = error instanceof Error ? error.name : typeof error;
  const code =
    typeof error === "object" && error && "code" in error
      ? (error as { code?: unknown }).code
      : "unknown";
  observe(event, {
    ...fields,
    error_type: safeCode(type),
    error_code: safeCode(code),
  });
}
