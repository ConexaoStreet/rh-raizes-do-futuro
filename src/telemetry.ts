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
  const frame =
    error instanceof Error
      ? error.stack
          ?.split("\n")
          .slice(1)
          .map((line) => line.trim())
          .find((line) => line.startsWith("at "))
          ?.replace(location.origin, "") || null
      : null;
  capture("app_error", { scope, code, frame });
}

export function captureNavigation(path: string) {
  capture("page_view", { path: path.split("?")[0] });
}

export function observeWebVitals() {
  if (!key || typeof PerformanceObserver === "undefined") return () => {};
  let cls = 0;
  let lcp = 0;
  let inp = 0;
  let reported = false;
  const observers: PerformanceObserver[] = [];
  const watch = (
    type: string,
    handler: (entry: PerformanceEntry) => void,
    init: PerformanceObserverInit = { type, buffered: true },
  ) => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) handler(entry);
      });
      observer.observe(init);
      observers.push(observer);
    } catch {}
  };
  watch("largest-contentful-paint", (entry) => {
    lcp = Math.max(lcp, entry.startTime);
  });
  watch("layout-shift", (entry) => {
    const shift = entry as PerformanceEntry & {
      value?: number;
      hadRecentInput?: boolean;
    };
    if (!shift.hadRecentInput) cls += shift.value || 0;
  });
  watch(
    "event",
    (entry) => {
      inp = Math.max(inp, entry.duration);
    },
    { type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit,
  );
  const report = () => {
    if (reported) return;
    reported = true;
    const fcp =
      performance
        .getEntriesByName("first-contentful-paint")
        .at(-1)?.startTime || 0;
    capture("web_vitals", {
      lcp_ms: Math.round(lcp),
      cls: Number(cls.toFixed(3)),
      inp_ms: Math.round(inp),
      fcp_ms: Math.round(fcp),
      path: location.hash.split("?")[0] || "/",
    });
    observers.forEach((observer) => observer.disconnect());
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") report();
  };
  const timer = window.setTimeout(report, 15000);
  window.addEventListener("pagehide", report, { once: true });
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("pagehide", report);
    document.removeEventListener("visibilitychange", onVisibility);
    observers.forEach((observer) => observer.disconnect());
  };
}
