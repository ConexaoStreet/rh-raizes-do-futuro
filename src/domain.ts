export type AttendanceStatus =
  | "pending"
  | "present"
  | "absent"
  | "justified"
  | "late"
  | "early_exit"
  | "occurrence";
export const attendanceLabels: Record<AttendanceStatus, string> = {
  pending: "Não preenchido",
  present: "Presente",
  absent: "Falta",
  justified: "Falta justificada",
  late: "Atraso",
  early_exit: "Saída antecipada",
  occurrence: "Ocorrência",
};
export const labels: Record<string, string> = {
  ...attendanceLabels,
  active: "Ativo",
  inactive: "Desativado",
  suspended: "Suspenso",
  blocked: "Bloqueado",
  open: "Aberto",
  closed: "Encerrado",
  draft: "Rascunho",
  scheduled: "Agendado",
  archived: "Arquivado",
  editing: "Em preenchimento",
  finalized: "Finalizada",
  maintenance: "Em manutenção",
  accepted: "Aceita",
  rejected: "Recusada",
  positive: "Positivo",
  development: "Desenvolvimento",
  alignment: "Alinhamento",
  recognition: "Reconhecimento",
  guidance: "Orientação",
  formal: "Formal",
  other: "Outro",
  following: "Em acompanhamento",
  completed: "Concluído",
  holiday: "Feriado",
  recess: "Recesso",
  cancelled: "Cancelamento",
  replacement: "Reposição",
  exception: "Aula excepcional",
  normal: "Curso",
  SUPER_ADMIN: "Administrador Total",
  MANAGER: "Gestor",
  COLLABORATOR: "Colaborador",
};
export const label = (value: unknown) =>
  labels[String(value)] || String(value ?? "—");
export const number = (value: number | null | undefined, digits = 0) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
        value,
      );
export function dateLabel(value: string | null | undefined, time = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(
    "pt-BR",
    time
      ? {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        }
      : { dateStyle: "short", timeZone: "America/Sao_Paulo" },
  ).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value));
}
export function localDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function delayMinutes(expected: string, actual?: string | null) {
  if (!actual) return 0;
  const minutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  return Math.max(0, minutes(actual) - minutes(expected));
}
export function weightedAverage(scores: { score: number; weight: number }[]) {
  const total = scores.reduce((sum, item) => sum + item.weight, 0);
  return total
    ? scores.reduce((sum, item) => sum + item.score * item.weight, 0) / total
    : null;
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function csvText(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    "\uFEFF" +
    [
      keys.map(csvCell).join(";"),
      ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(";")),
    ].join("\r\n")
  );
}
export function errorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "";
  const known: Record<string, string> = {
    FORBIDDEN: "Você não tem permissão.",
    OUTSIDE_WINDOW: "Fora do horário da chamada.",
    INVALID_COURSE_DAY: "Não há curso nesta data.",
    CONFLICT: "Este registro mudou. Atualize a página antes de salvar.",
    REASON_REQUIRED: "Motivo obrigatório.",
    PENDING_MEMBERS: "Há pessoas sem presença preenchida.",
    SNAPSHOT_IMMUTABLE: "A composição da chamada não pode ser alterada.",
    DUPLICATE_VOTE: "Sua avaliação já foi enviada.",
    MINIMUM_RESPONSES: "Ainda não há respostas suficientes.",
    MFA_REQUIRED: "Conclua a verificação de segurança.",
    RECENT_VERIFICATION_REQUIRED: "Confirme sua identidade novamente para fazer esta alteração.",
    ATTENDANCE_NOT_FINALIZED: "A justificativa só pode ser enviada após o encerramento da chamada.",
    NOT_ELIGIBLE: "Este registro não está elegível para justificativa.",
    DUPLICATE_JUSTIFICATION: "Já existe uma justificativa pendente ou aceita para esta falta.",
    INVALID_CODE: "Código inválido ou expirado.",
    RATE_LIMITED: "Aguarde antes de tentar novamente.",
    INVALID_TRANSITION: "Esta alteração não está disponível.",
    23505: "Já existe um registro com esses dados.",
  };
  for (const [key, text] of Object.entries(known))
    if (message.includes(key)) return text;
  if (/Invalid login credentials/i.test(message))
    return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(message))
    return "Confirme seu e-mail para entrar.";
  if (/network|fetch/i.test(message)) return "Sem conexão. Tente novamente.";
  return "Não foi possível concluir. Tente novamente.";
}
