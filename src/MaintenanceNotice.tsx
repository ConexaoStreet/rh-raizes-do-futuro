import { Link } from "react-router-dom";
import { ArrowUpRight, Radio, Wrench } from "lucide-react";
import type { MaintenanceState } from "./site-status";

export default function MaintenanceNotice({
  maintenance,
}: {
  maintenance: MaintenanceState;
}) {
  if (!maintenance.enabled) return null;
  return (
    <aside
      role="status"
      aria-label="Manutenção do site"
      style={{
        padding: "22px clamp(18px, 4vw, 54px)",
        background: "#f3dc94",
        color: "#24372e",
        borderBottom: "2px solid #d4b757",
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        alignItems: "center",
        position: "relative",
        zIndex: 2,
      }}
    >
      <Wrench size={30} aria-hidden="true" />
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <strong
          style={{
            display: "block",
            fontSize: "clamp(1.3rem, 3vw, 1.8rem)",
            lineHeight: 1.3,
          }}
        >
          {maintenance.title || "O site está em manutenção"}
        </strong>
        <p style={{ margin: "7px 0 0", maxWidth: 900, lineHeight: 1.55 }}>
          {maintenance.message ||
            "Estamos conferindo as melhorias por partes. Você pode acompanhar o andamento ao vivo."}
        </p>
      </div>
      <Link
        to="/ao-vivo"
        className="button"
        style={{
          background: "#153e31",
          color: "#fff",
          borderColor: "#153e31",
          minHeight: 48,
        }}
      >
        <Radio size={18} /> Acompanhar ao vivo <ArrowUpRight size={17} />
      </Link>
    </aside>
  );
}
