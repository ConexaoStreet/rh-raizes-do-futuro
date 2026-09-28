import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

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
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(seenInSession);

  useEffect(() => {
    if (now >= END_AT) return;
    const delay =
      now < START_AT
        ? Math.min(Math.max(START_AT - now, 250), 60000)
        : 1000;
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [now]);

  const preview =
    now < START_AT &&
    new URLSearchParams(window.location.search).get("inauguracao") ===
      "preview";
  const active = preview || (now >= START_AT && now < END_AT);

  if (!active || dismissed) return <>{children}</>;

  const enter = () => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      void 0;
    }
    setDismissed(true);
  };

  return (
    <Suspense fallback={null}>
      <LaunchCeremony remaining={remainingLabel(END_AT - now)} onEnter={enter} />
    </Suspense>
  );
}
