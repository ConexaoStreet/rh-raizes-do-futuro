type Props = {
  placement?: "login" | "shell";
};

export default function DeveloperAvailabilityNotice({
  placement = "login",
}: Props) {
  return (
    <aside
      className="developer-availability-notice"
      role="alert"
      aria-live="assertive"
      aria-label="Aviso importante sobre a gestão do projeto"
      style={{
        display: "flex",
        gap: 12,
        margin: placement === "shell" ? "16px clamp(16px, 3vw, 32px) 0" : "0 0 20px",
        padding: 16,
        border: "2px solid #a93131",
        borderRadius: 14,
        background: "#8b2323",
        color: "#fff",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 38px",
          height: 38,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          background: "#ffffff24",
          fontWeight: 800,
        }}
      >
        !
      </span>
      <div>
        <strong style={{ display: "block", marginBottom: 6 }}>
          AVISO IMPORTANTE - GESTÃO TEMPORARIAMENTE INDISPONÍVEL
        </strong>
        <p style={{ margin: 0, fontSize: ".88rem" }}>
          O desenvolvedor do projeto foi assaltado. Por esse motivo, não há
          gestão técnica do projeto no momento. Solicitações, ajustes,
          correções e suporte podem ficar sem acompanhamento temporariamente.
        </p>
      </div>
    </aside>
  );
}
