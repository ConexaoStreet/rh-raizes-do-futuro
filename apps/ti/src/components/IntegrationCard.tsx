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
    <article className="panel ti-integration-card">
      <div className="state-row">
        <span>{name}</span>
        <span className={"status-badge " + tone}>{status}</span>
      </div>
      {detail && (
        <p className="panel-copy">
          <code>{detail}</code>
        </p>
      )}
      {children}
      {action && <div className="actions">{action}</div>}
    </article>
  );
}
