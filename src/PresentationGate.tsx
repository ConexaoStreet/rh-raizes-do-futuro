import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

const LaunchCeremony = lazy(() => import("./LaunchCeremony"));
const PREVIEW_START_AT = Date.parse("2026-09-28T18:20:00-03:00");
const PREVIEW_END_AT = Date.parse("2026-09-28T18:30:00-03:00");
const START_AT = Date.parse("2026-09-29T08:00:00-03:00");
const END_AT = Date.parse("2026-09-29T14:00:00-03:00");
const SESSION_KEY = "raizes-inauguracao-2026-09-29";

function seenInSession() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function remainingLabel(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function PresentationGate({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(seenInSession);
  const previewRequested =
    new URLSearchParams(window.location.search).get("inauguracao") ===
    "preview";

  const preview =
    previewRequested && now >= PREVIEW_START_AT && now < PREVIEW_END_AT;
  const official = now >= START_AT && now < END_AT;
  const active = preview || official;

  useEffect(() => {
    if (now >= END_AT) return;

    const boundaries = [
      previewRequested ? PREVIEW_START_AT : Number.POSITIVE_INFINITY,
      previewRequested ? PREVIEW_END_AT : Number.POSITIVE_INFINITY,
      START_AT,
      END_AT,
    ].filter((time) => time > now);

    const nextBoundary = Math.min(...boundaries);
    const delay = active
      ? Math.min(1000, Math.max(nextBoundary - now, 50))
      : Math.min(Math.max(nextBoundary - now, 50), 60000);

    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [active, now, previewRequested]);

  if (!active || dismissed) return <>{children}</>;

  const enter = () => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      void 0;
    }
    setDismissed(true);
  };

  const endsAt = preview ? PREVIEW_END_AT : END_AT;

  return (
    <Suspense fallback={null}>
      <LaunchCeremony remaining={remainingLabel(endsAt - now)} onEnter={enter} />
    </Suspense>
  );
}
