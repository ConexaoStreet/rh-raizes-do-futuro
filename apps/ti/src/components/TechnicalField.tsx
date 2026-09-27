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
  const classes = [
    "field",
    "ti-technical-field",
    wide ? "wide" : "",
    mono ? "is-mono" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes}>
      <span>{label}</span>
      {children}
      {hint && <small className="ti-technical-field-hint">{hint}</small>}
    </label>
  );
}
