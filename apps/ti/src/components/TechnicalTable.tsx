import type { ReactNode } from "react";

type TechnicalTableProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function TechnicalTable({
  label,
  children,
  className = "",
}: TechnicalTableProps) {
  const classes = ["table-wrap", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
