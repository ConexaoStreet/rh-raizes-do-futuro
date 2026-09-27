import type { ReactNode } from "react";

const MONO_STYLE = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

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
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {mono ? <div style={MONO_STYLE}>{children}</div> : children}
      {hint && <small className="panel-copy">{hint}</small>}
    </label>
  );
}
