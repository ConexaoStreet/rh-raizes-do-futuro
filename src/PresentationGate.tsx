import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";

const LaunchCeremony = lazy(() => import("./LaunchCeremony"));
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
  const previewRequested = useMemo(
    () =>
      new URLSearchParams(window.location.search).get("inauguracao") ===
      "ensaio-final",
    [],
  );
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(() =>
    previewRequested ? false : seenInSession(),
  );

  const preview = previewRequested && now < START_AT;
  const official = now >= START_AT && now < END_AT;
  const active = preview || official;

  useEffect(() => {
    if (now >= END_AT) return;

    const nextBoundary = preview ? START_AT : official ? END_AT : START_AT;
    const delay = active
      ? Math.min(1000, Math.max(nextBoundary - now, 50))
      : Math.min(Math.max(nextBoundary - now, 50), 60000);

    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [active, now, official, preview]);

  if (!active || dismissed) return <>{children}</>;

  const enter = () => {
    if (!preview) {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        void 0;
      }
    }
    setDismissed(true);
  };

  return (
    <Suspense fallback={null}>
      <LaunchCeremony
        remaining={remainingLabel((preview ? START_AT : END_AT) - now)}
        mode={preview ? "preview" : "official"}
        onEnter={enter}
      />
    </Suspense>
  );
}
