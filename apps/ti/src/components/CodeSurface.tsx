type CodeSurfaceProps = {
  value: unknown;
  label?: string;
  emptyText?: string;
  compact?: boolean;
};

function serialize(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

export function CodeSurface({
  value,
  label = "Saída técnica",
  emptyText = "Sem dados.",
  compact = false,
}: CodeSurfaceProps) {
  const content = serialize(value) || emptyText;

  return (
    <section
      className={compact ? "ti-code-surface is-compact" : "ti-code-surface"}
      aria-label={label}
    >
      <div className="ti-code-surface-head">
        <span>{label}</span>
        <small>LEITURA TÉCNICA</small>
      </div>
      <pre>
        <code>{content}</code>
      </pre>
    </section>
  );
}
