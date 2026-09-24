import { useEffect, useState, type ReactNode } from "react";

const KEY = "raizes-ti-intro-seen";

export function CinematicGate({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!show) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(KEY, "1"); } catch {}
      setShow(false);
    }, reduce ? 500 : 2800);
    return () => window.clearTimeout(timer);
  }, [show]);

  if (!show) return children;

  return (
    <div className="cinematic-intro" aria-label="Raízes do Futuro">
      <div className="cinematic-noise" />
      <div className="cinematic-root root-a" />
      <div className="cinematic-root root-b" />
      <div className="cinematic-root root-c" />
      <div className="cinematic-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="cinematic-wordmark">
        <span>RAÍZES</span>
        <b>DO FUTURO</b>
        <small>CENTRAL T.I. · DATASUL</small>
      </div>
      <div className="cinematic-scan" />
    </div>
  );
}
