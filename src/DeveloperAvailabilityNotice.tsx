export default function DeveloperAvailabilityNotice() {
  return (
    <aside
      className="developer-availability-notice"
      role="alert"
      aria-live="assertive"
      aria-label="Aviso importante sobre a gestão do projeto"
    >
      <span className="developer-availability-notice__icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>AVISO IMPORTANTE — GESTÃO TEMPORARIAMENTE INDISPONÍVEL</strong>
        <p>
          O desenvolvedor do projeto foi assaltado. Por esse motivo, não há
          gestão técnica do projeto no momento. Solicitações, ajustes,
          correções e suporte podem ficar sem acompanhamento temporariamente.
        </p>
      </div>
    </aside>
  );
}
