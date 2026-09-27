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
      className="ti-code-surface"
      aria-label={label}
      data-compact={compact || undefined}
    >
      <div className="state-row">
        <span>{label}</span>
        <strong>LEITURA TÉCNICA</strong>
      </div>
      <pre>
        <code>{content}</code>
      </pre>
    </section>
  );
}
