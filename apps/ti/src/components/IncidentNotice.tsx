type IncidentNoticeProps = {
  modules: string[];
};

export function IncidentNotice({ modules }: IncidentNoticeProps) {
  if (!modules.length) return null;
  return (
    <section className="ti-incident-notice" role="status" aria-live="polite">
      <div>
        <span>OPERAÇÃO PARCIAL</span>
        <strong>
          {modules.length === 1
            ? "1 módulo não carregou completamente"
            : modules.length + " módulos não carregaram completamente"}
        </strong>
      </div>
      <p>
        Os módulos saudáveis continuam disponíveis. Verifique: {modules.join(" · ")}.
      </p>
    </section>
  );
}
