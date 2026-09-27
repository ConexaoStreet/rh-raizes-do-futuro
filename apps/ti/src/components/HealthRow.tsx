import type { ReactNode } from "react";
import type { StatusTone } from "./StatusTile";

type HealthRowProps = {
  name: string;
  status: string;
  secondary?: string;
  tone?: StatusTone;
  action?: ReactNode;
};

export function HealthRow({
  name,
  status,
  secondary = "",
  tone = "neutral",
  action,
}: HealthRowProps) {
  return (
    <div className="ti-health-row" data-tone={tone}>
      <span className="ti-health-row-dot" aria-hidden="true" />
      <div>
        <strong>{name}</strong>
        {secondary && <small>{secondary}</small>}
      </div>
      <span className="ti-health-row-status">{status}</span>
      {action && <div className="ti-health-row-action">{action}</div>}
    </div>
  );
}
