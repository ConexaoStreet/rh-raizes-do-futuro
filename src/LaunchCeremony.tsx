import "./launch-ceremony.css";

export default function LaunchCeremony({
  remaining,
  onEnter,
}: {
  remaining: string;
  onEnter: () => void;
}) {
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
            <strong aria-live="polite">{remaining}</strong>
          </div>
        </div>
        <button className="launch-enter" type="button" onClick={onEnter}>
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
