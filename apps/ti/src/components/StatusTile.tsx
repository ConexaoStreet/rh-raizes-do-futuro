import type { ReactNode } from "react";

export type StatusTone = "ok" | "warn" | "error" | "neutral";

type StatusTileProps = {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: StatusTone;
  icon?: ReactNode;
};

export function StatusTile({
  label,
  value,
  detail = "",
  tone = "neutral",
  icon,
}: StatusTileProps) {
  return (
    <article className="ti-status-tile" data-tone={tone}>
      <div className="ti-status-tile-head">
        <span>{label}</span>
        {icon && <span className="ti-status-tile-icon">{icon}</span>}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
