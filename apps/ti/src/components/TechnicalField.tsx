import type { ReactNode } from "react";

type TechnicalFieldProps = {
  label: string;
  children: ReactNode;
  wide?: boolean;
  mono?: boolean;
  hint?: string;
};

export function TechnicalField({
  label,
  children,
  wide = false,
  mono = false,
  hint = "",
}: TechnicalFieldProps) {
  return (
    <label
      className={wide ? "field wide" : "field"}
      data-technical-mono={mono || undefined}
    >
      <span>{label}</span>
      {children}
      {hint && <small className="panel-copy">{hint}</small>}
    </label>
  );
}
