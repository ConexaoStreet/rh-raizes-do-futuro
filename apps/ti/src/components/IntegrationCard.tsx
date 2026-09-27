import type { ReactNode } from "react";
import type { StatusTone } from "./StatusTile";

type IntegrationCardProps = {
  name: string;
  status: string;
  detail?: string;
  tone?: StatusTone;
  children?: ReactNode;
  action?: ReactNode;
};

export function IntegrationCard({
  name,
  status,
  detail = "",
  tone = "neutral",
  children,
  action,
}: IntegrationCardProps) {
  return (
    <article className="ti-integration-card" data-tone={tone}>
      <header>
        <div>
          <span className="ti-integration-card-kicker">INTEGRAÇÃO</span>
          <strong>{name}</strong>
          {detail && <small>{detail}</small>}
        </div>
        <div className="ti-integration-card-status">
          <span className="ti-integration-card-dot" aria-hidden="true" />
          <b>{status}</b>
        </div>
      </header>
      {children && <div className="ti-integration-card-body">{children}</div>}
      {action && <div className="ti-integration-card-action">{action}</div>}
    </article>
  );
}
