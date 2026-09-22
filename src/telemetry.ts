const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = ((import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com").replace(/\/$/, "");
let distinctId = "anonymous";

export const telemetryConfigured = Boolean(key);

export function setTelemetryUser(id: string | null) {
  distinctId = id || "anonymous";
}

function cleanProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([name, value]) => {
      if (/email|name|phone|document|registration|reason|notes|message|body/i.test(name)) return false;
      return ["string", "number", "boolean"].includes(typeof value) || value == null;
    }),
  );
}

export function capture(event: string, properties: Record<string, unknown> = {}) {
  if (!key || !event) return;
  const payload = {
    api_key: key,
    event,
    properties: {
      distinct_id: distinctId,
      $current_url: location.origin + location.pathname + location.hash.split("?")[0],
      app: "rh-raizes-do-futuro",
      environment: import.meta.env.MODE,
      ...cleanProperties(properties),
    },
  };
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${host}/capture/`, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {}
}

export function captureError(scope: string, error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code || "unknown")
      : error instanceof Error
        ? error.name
        : "unknown";
  capture("app_error", { scope, code });
}

export function captureNavigation(path: string) {
  capture("page_view", { path: path.split("?")[0] });
}
