import { useEffect, useState, type ReactNode } from "react";

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

export function LaunchCeremony({ children }: { children: ReactNode }) {
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
    <div
      className="launch-ceremony"
      role="dialog"
      aria-modal="true"
      aria-label="Inauguração do Raízes do Futuro"
    >
      <span className="launch-glow launch-glow-one" aria-hidden="true" />
      <span className="launch-glow launch-glow-two" aria-hidden="true" />
      <div className="launch-card">
        <div className="launch-badge">
          <span>29.09.2026</span>
          <i aria-hidden="true" />
          <span>INAUGURAÇÃO</span>
        </div>
        <div className="launch-mark" aria-hidden="true">
          <span />
          <img src="/brand/raizes-logo-mark.png" alt="" width={82} height={82} />
        </div>
        <p className="launch-kicker">RAÍZES DO FUTURO · GESTÃO DE RH</p>
        <h1>Hoje, o projeto ganha vida.</h1>
        <p className="launch-copy">
          Depois de planejamento, desenvolvimento e muitas decisões, o Raízes
          do Futuro abre suas portas. Bem-vindo à experiência que criamos para
          cuidar de pessoas, presença e desenvolvimento.
        </p>
        <div className="launch-pill-row" aria-label="Pilares do projeto">
          <span>PESSOAS</span>
          <span>PRESENÇA</span>
          <span>DESENVOLVIMENTO</span>
        </div>
        <div className="launch-metrics">
          <div>
            <small>ABERTURA</small>
            <strong>08:00</strong>
          </div>
          <div>
            <small>ENCERRAMENTO</small>
            <strong>14:00</strong>
          </div>
          <div className="launch-countdown">
            <small>EXPERIÊNCIA ATIVA POR</small>
            <strong aria-live="polite">{remainingLabel(END_AT - now)}</strong>
          </div>
        </div>
        <button className="launch-enter" type="button" onClick={enter}>
          <span>Entrar no Raízes</span>
          <b aria-hidden="true">→</b>
        </button>
        <p className="launch-note">
          Esta abertura especial se encerra automaticamente às 14:00.
        </p>
      </div>
      <p className="launch-signature">ESPRO · ANHANGUERA · TURMA 16807</p>
    </div>
  );
}
