export type ActivityEntry = {
  action: string;
  module: string;
  success: boolean;
  actor_name?: string | null;
  entity_id?: string | null;
  old_values?: unknown;
  new_values?: unknown;
  context?: unknown;
};

export type ActivityNames = ReadonlyMap<string, string>;
export type ActivityChange = { field: string; before: string; after: string };

const areas: Record<string, [string, string]> = {
  employees: ["Pessoas", "o cadastro de uma pessoa"],
  profiles: ["Contas", "uma conta"],
  classes: ["Turmas", "uma turma"],
  departments: ["Setores", "um setor"],
  job_positions: ["Funções", "uma função"],
  managers: ["Gestores", "o cadastro de um gestor"],
  attendance_sessions: ["Chamadas", "uma chamada"],
  attendance_members: ["Presenças", "uma presença"],
  attendance_maintenance: ["Ajustes nas chamadas", "um ajuste na chamada"],
  absence_justifications: ["Justificativas", "uma justificativa"],
  justification_categories: ["Motivos de falta", "um motivo de falta"],
  feedbacks: ["Feedbacks", "um feedback"],
  feedback_followups: ["Acompanhamento", "um acompanhamento"],
  performance_cycles: ["Períodos de avaliação", "um período de avaliação"],
  performance_criteria: ["Critérios de avaliação", "um critério de avaliação"],
  performance_reviews: ["Avaliações e notas", "uma avaliação"],
  performance_scores: ["Notas", "uma nota"],
  manager_review_cycles: [
    "Avaliação dos gestores",
    "uma avaliação de gestores",
  ],
  manager_review_criteria: [
    "Avaliação dos gestores",
    "um critério de avaliação",
  ],
  manager_cycle_targets: ["Avaliação dos gestores", "um gestor avaliado"],
  manager_cycle_criteria: [
    "Avaliação dos gestores",
    "um critério de avaliação",
  ],
  roles: ["Cargos", "um cargo"],
  user_roles: ["Acessos das contas", "um cargo de uma conta"],
  role_permissions: ["Permissões dos cargos", "uma permissão de um cargo"],
  settings: ["Configurações", "uma configuração do site"],
  security: ["Segurança", "uma proteção de acesso"],
  auth: ["Acesso ao site", "um acesso"],
  sessions: ["Acessos ao site", "um acesso"],
  reports: ["Relatórios", "um relatório"],
  report_exports: ["Relatórios baixados", "um arquivo de relatório"],
  attachments: ["Documentos", "um documento"],
  storage: ["Arquivos", "um arquivo"],
  notifications: ["Notificações", "uma notificação"],
  course_calendar: ["Calendário", "uma data do calendário"],
  events: ["Eventos", "um evento"],
  sector_tasks: ["Tarefas dos setores", "uma tarefa"],
  chat_messages: ["Conversas", "uma mensagem"],
  chat_reports: ["Denúncias do chat", "uma denúncia"],
  chat_attachments: ["Anexos do chat", "um anexo"],
  support_tickets: ["Pedidos de ajuda", "um pedido de ajuda"],
  ti_support_tickets: ["Pedidos de ajuda", "um pedido de ajuda"],
  ti_datasul_operations: ["Conexão com Datasul", "uma operação no Datasul"],
};

const actions: Record<string, [string, string]> = {
  approve: ["Aprovou uma conta", "aprovar uma conta"],
  save_role: ["Atualizou um cargo", "atualizar um cargo"],
  change_access: [
    "Alterou o acesso de uma conta",
    "alterar o acesso de uma conta",
  ],
  bootstrap_first_super_admin: [
    "Liberou o primeiro administrador",
    "liberar o primeiro administrador",
  ],
  repair_activation: [
    "Corrigiu a ativação de uma conta",
    "corrigir a ativação de uma conta",
  ],
  manager_activation: [
    "Ativou o cadastro de um gestor",
    "ativar o cadastro de um gestor",
  ],
  self_activate: ["Ativou o próprio cadastro", "ativar o próprio cadastro"],
  snapshot: [
    "Registrou as pessoas da chamada",
    "registrar as pessoas da chamada",
  ],
  start: [
    "Abriu um período de ajustes na chamada",
    "abrir um período de ajustes na chamada",
  ],
  end: ["Encerrou os ajustes na chamada", "encerrar os ajustes na chamada"],
  archive: ["Arquivou um documento", "arquivar um documento"],
  export: [
    "Preparou um relatório para baixar",
    "preparar um relatório para baixar",
  ],
  login: ["Entrou no site", "entrar no site"],
  logout: ["Saiu do site", "sair do site"],
  otp_requested: [
    "Pediu um código para confirmar o acesso",
    "pedir um código para confirmar o acesso",
  ],
  otp_verified: [
    "Confirmou o acesso com um código",
    "confirmar o acesso com um código",
  ],
  otp_failed: [
    "Teve o código de acesso recusado",
    "confirmar o acesso com um código",
  ],
  revoke_session: ["Encerrou um acesso aberto", "encerrar um acesso aberto"],
  scores_saved: [
    "Salvou as notas de uma avaliação",
    "salvar as notas de uma avaliação",
  ],
  scores_before: [
    "Registrou uma alteração nas notas",
    "registrar uma alteração nas notas",
  ],
  moderate: ["Ocultou uma mensagem do chat", "ocultar uma mensagem do chat"],
  review_report: [
    "Conferiu uma denúncia do chat",
    "conferir uma denúncia do chat",
  ],
  ti_notification_send: ["Enviou uma notificação", "enviar uma notificação"],
  ti_access_code_login: [
    "Entrou no painel de TI com um código",
    "entrar no painel de TI com um código",
  ],
  ti_storage_delete: ["Removeu um arquivo", "remover um arquivo"],
  submit_espro_photo: [
    "Enviou uma foto para conferência",
    "enviar uma foto para conferência",
  ],
};

const fieldNames: Record<string, string> = {
  full_name: "Nome",
  full_name_snapshot: "Nome",
  name: "Nome",
  title: "Título",
  email: "E-mail",
  phone: "Telefone",
  registration: "Matrícula",
  registration_snapshot: "Matrícula",
  status: "Situação",
  active: "Ativo",
  archived: "Arquivado",
  enabled: "Ativado",
  released: "Disponível para a pessoa",
  member_group: "Grupo",
  access_role_code: "Cargo de acesso",
  class_id: "Turma",
  department_id: "Setor",
  job_position_id: "Função",
  manager_id: "Gestor",
  employee_id: "Pessoa",
  profile_id: "Conta",
  user_id: "Conta",
  role_id: "Cargo",
  permission_id: "Permissão",
  assigned_to: "Responsável pela tarefa",
  roles: "Cargos",
  scheduled_date: "Data da chamada",
  start_date: "Data inicial",
  end_date: "Data final",
  expected_arrival: "Horário combinado",
  actual_arrival: "Horário de chegada",
  actual_departure: "Horário de saída",
  delay_minutes: "Minutos de atraso",
  early_minutes: "Minutos de saída antecipada",
  notes: "Observações",
  description: "Descrição",
  message: "Mensagem",
  response: "Resposta",
  reply: "Resposta",
  score: "Nota",
  weight: "Peso",
  priority: "Prioridade",
  due_date: "Prazo",
  filename: "Nome do arquivo",
  format: "Formato do arquivo",
  count: "Quantidade de pessoas",
  allow_managers: "Acesso dos gestores durante a manutenção",
  min_responses: "Mínimo de respostas",
};

const values: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  pending: "Aguardando",
  blocked: "Bloqueado",
  suspended: "Suspenso",
  deleted: "Removido",
  archived: "Arquivado",
  approved: "Aprovado",
  rejected: "Recusado",
  open: "Aberto",
  closed: "Encerrado",
  draft: "Em preparação",
  published: "Publicado",
  present: "Presente",
  absent: "Ausente",
  justified: "Falta justificada",
  unjustified: "Falta sem justificativa",
  late: "Chegou atrasado",
  excused: "Dispensado",
  finalized: "Finalizado",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  pending_review: "Aguardando conferência",
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluído",
  paused: "Pausado",
  low: "Baixa",
  normal: "Normal",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
  SUPER_ADMIN: "Administrador Total",
  TI_ADMIN: "Administrador de TI",
  DIRECTOR: "Diretor",
  MANAGER: "Gestor",
  INSTRUCTOR: "Instrutor",
  COLLABORATOR: "Colaborador",
  collaborator: "Colaborador",
  manager: "Gestor",
  instructor: "Instrutor",
  pdf: "PDF",
  xlsx: "Planilha do Excel",
  csv: "Planilha",
  excel: "Planilha do Excel",
};

const settings: Record<string, string> = {
  maintenance: "Manutenção do site",
  lateness: "Regras de atraso",
  registration_access_window: "Ativação dos cadastros",
  manager_review: "Avaliação dos gestores",
  notifications: "Notificações",
  ti_datasul: "Conexão com Datasul",
  ti_email: "Envio de e-mails",
  ti_github: "Código do site",
  ti_vercel: "Publicação do site",
  ti_site: "Site do RH",
  security: "Proteção de acesso",
  mfa: "Confirmação de acesso",
};

const references = {
  criterion_id: ["performance_criteria", "name"],
  employee_id: ["employees", "full_name"],
  profile_id: ["profiles", "full_name"],
  user_id: ["profiles", "full_name"],
  assigned_to: ["profiles", "full_name"],
  class_id: ["classes", "name"],
  department_id: ["departments", "name"],
  job_position_id: ["job_positions", "name"],
  manager_id: ["managers", "full_name"],
  role_id: ["roles", "name"],
  permission_id: ["permissions", "name"],
} as const;

export type NameRequest = {
  table: (typeof references)[keyof typeof references][0];
  field: "name" | "full_name";
  ids: string[];
};

const permissionNames: Record<string, string> = {
  "attendance.view": "Ver presenças",
  "attendance.manage": "Organizar chamadas",
  "attendance.maintenance": "Corrigir chamadas",
  "audit.view": "Ver o histórico de atividades",
  "audit.security": "Ver o histórico de proteção do site",
  "calendar.manage": "Organizar o calendário",
  "chat.use": "Usar as conversas",
  "chat.moderate": "Conferir mensagens e denúncias",
  "dashboard.view": "Ver o resumo do RH",
  "employee.view": "Ver as pessoas",
  "employee.manage": "Alterar os cadastros das pessoas",
  "feedback.view": "Ver feedbacks",
  "feedback.manage": "Organizar feedbacks",
  "files.manage": "Administrar documentos",
  "justification.view": "Ver justificativas",
  "justification.manage": "Conferir justificativas",
  "performance.grade": "Lançar e corrigir notas",
  "performance.manage": "Organizar avaliações",
  "performance.view": "Ver avaliações e notas",
  "report.export": "Baixar relatórios",
  "report.view": "Ver relatórios",
  "review.manage": "Organizar avaliações dos gestores",
  "review.results": "Ver os resultados dos gestores",
  "role.manage": "Administrar cargos e acessos",
  "settings.manage": "Alterar configurações",
  "system.manage": "Administrar o funcionamento do site",
  "ti.database.view": "Ver como os dados do site estão organizados",
  "ti.datasul.delete": "Remover informações do Datasul",
  "ti.datasul.read": "Consultar o Datasul",
  "ti.datasul.sync": "Atualizar o RH com informações do Datasul",
  "ti.datasul.write": "Enviar informações ao Datasul",
  "ti.deploy.manage": "Publicar atualizações do site",
  "ti.manage": "Administrar o painel de suporte",
  "ti.notifications.manage": "Enviar avisos do site",
  "ti.security.view": "Conferir a proteção dos acessos",
  "ti.storage.manage": "Administrar arquivos do site",
  "ti.users.manage": "Administrar contas pelo suporte",
  "ti.view": "Acessar o painel de suporte",
  "user.approve": "Aprovar cadastros",
  "user.manage": "Alterar acessos das contas",
  "user.view": "Ver contas",
  "workspace.instructor": "Ver a área do instrutor",
  "workspace.overview": "Acompanhar todos os setores",
  "workspace.view": "Ver o espaço do próprio setor",
};

export function activityReferenceName(
  request: NameRequest,
  row: Record<string, unknown>,
) {
  return request.table === "permissions"
    ? lookup(permissionNames, String(row.code)) || "Outro acesso do cargo"
    : text(row[request.field]);
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const lookup = <T>(items: Record<string, T>, key: string): T | undefined =>
  Object.hasOwn(items, key) ? items[key] : undefined;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) =>
  typeof value === "string"
    ? value
        .trim()
        .replaceAll(String.fromCharCode(160), " ")
        .replaceAll(String.fromCharCode(8212), "-")
        .slice(0, 500)
    : "";

export function activityActor(entry: ActivityEntry) {
  const name = text(entry.actor_name);
  return !name ||
    /^(sistema|system|postgres|supabase)$/i.test(name) ||
    uuid.test(name)
    ? "O site"
    : name;
}

export function activityArea(module: string) {
  return lookup(areas, module)?.[0] ?? "Outras atividades";
}

function displayValue(
  key: string,
  value: unknown,
  names?: ActivityNames,
): string {
  if (value === null || value === undefined || value === "")
    return "Não informado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number")
    return Number.isFinite(value)
      ? value.toLocaleString("pt-BR")
      : "Não informado";
  if (Array.isArray(value)) {
    if (!value.length) return "Nenhum";
    if (key === "roles" || key === "permissions")
      return value
        .map((item) =>
          typeof item === "string"
            ? names?.get(item) || lookup(values, item) || "Nome não disponível"
            : "Nome não disponível",
        )
        .join(", ");
    return `${value.length} ${value.length === 1 ? "item registrado" : "itens registrados"}`;
  }
  if (typeof value !== "string") return "Informação atualizada";
  if (uuid.test(value)) return names?.get(value) || "Nome não disponível";
  if (
    [
      "status",
      "priority",
      "access_role_code",
      "member_group",
      "format",
    ].includes(key)
  )
    return lookup(values, value) || "Outra opção";
  if (
    /^(scheduled_date|start_date|end_date|due_date)$/.test(key) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  )
    return value.split("-").reverse().join("/");
  return text(value);
}

export function activityChanges(
  entry: ActivityEntry,
  names?: ActivityNames,
): ActivityChange[] {
  const before = object(entry.old_values);
  const after = object(entry.new_values);
  const changes: ActivityChange[] = [];
  if (
    entry.module === "performance_reviews" &&
    (Array.isArray(entry.old_values) || Array.isArray(entry.new_values))
  ) {
    const oldScores = Array.isArray(entry.old_values)
      ? entry.old_values.map(object)
      : [];
    const newScores = Array.isArray(entry.new_values)
      ? entry.new_values.map(object)
      : [];
    const ids = new Set(
      [...oldScores, ...newScores].map((row) => String(row.criterion_id)),
    );
    for (const id of ids) {
      const previous = oldScores.find((row) => String(row.criterion_id) === id);
      const next = newScores.find((row) => String(row.criterion_id) === id);
      if (previous?.score === next?.score) continue;
      const name =
        text(next?.criterion_name ?? previous?.criterion_name) ||
        names?.get(id) ||
        "Critério de avaliação";
      changes.push({
        field: "Nota: " + name,
        before: displayValue("score", previous?.score, names),
        after: displayValue("score", next?.score, names),
      });
    }
    return changes;
  }
  const append = (
    old: Record<string, unknown>,
    next: Record<string, unknown>,
  ) => {
    for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
      if (
        !Object.hasOwn(fieldNames, key) ||
        JSON.stringify(old[key]) === JSON.stringify(next[key])
      )
        continue;
      changes.push({
        field: fieldNames[key],
        before: displayValue(key, old[key], names),
        after: displayValue(key, next[key], names),
      });
    }
  };
  append(before, after);
  if (entry.module === "settings")
    append(object(before.value), object(after.value));
  const context = object(entry.context);
  if (
    Array.isArray(context.old_permissions) &&
    Array.isArray(context.new_permissions) &&
    JSON.stringify(context.old_permissions) !==
      JSON.stringify(context.new_permissions)
  )
    changes.push({
      field: "O que o cargo pode fazer",
      before: displayValue("permissions", context.old_permissions, names),
      after: displayValue("permissions", context.new_permissions, names),
    });
  return changes;
}

export function describeActivity(entry: ActivityEntry, names?: ActivityNames) {
  const before = object(entry.old_values);
  const after = object(entry.new_values);
  const context = object(entry.context);
  const current = { ...before, ...after };
  let subject = "";
  if (entry.module === "settings")
    subject = lookup(settings, String(current.key)) || "Configurações do site";
  else {
    for (const key of [
      "full_name",
      "full_name_snapshot",
      "name",
      "title",
      "filename",
      "employee_name",
      "target_name",
    ]) {
      subject = text(current[key] ?? context[key]);
      if (subject && !uuid.test(subject)) break;
      subject = "";
    }
    if (!subject)
      subject =
        names?.get(entry.entity_id || "") ||
        ["employee_id", "user_id", "profile_id", "role_id", "assigned_to"]
          .map((key) =>
            typeof current[key] === "string"
              ? names?.get(current[key] as string)
              : "",
          )
          .filter(Boolean)
          .join(" · ");
  }
  const noun = lookup(areas, entry.module)?.[1] || "um registro do site";
  const verb = lookup(
    {
      insert: ["Criou", "criar"],
      update: ["Atualizou", "atualizar"],
      delete: ["Removeu", "remover"],
    },
    entry.action,
  );
  const action = verb
    ? [`${verb[0]} ${noun}`, `${verb[1]} ${noun}`]
    : lookup(actions, entry.action);
  const actor = activityActor(entry);
  const title = action
    ? entry.success
      ? action[0]
      : `Não foi possível ${action[1]}`
    : entry.success
      ? "Registrou uma atividade"
      : "Uma atividade não foi concluída";
  const description = action
    ? entry.success
      ? `${actor} ${action[0][0].toLowerCase()}${action[0].slice(1)}.`
      : `${actor} tentou ${action[1]}, mas a ação não foi concluída.`
    : entry.success
      ? `${actor} registrou uma atividade.`
      : `${actor} tentou realizar uma ação, mas ela não foi concluída.`;
  return {
    actor,
    title,
    description,
    subject,
    area: activityArea(entry.module),
    result: entry.success ? "Concluído" : "Não concluído",
    reason: text(context.reason ?? after.reason),
    changes: activityChanges(entry, names),
  };
}

export function activitySource(source: string) {
  const sources: Record<string, string> = {
    manual: "Alterado pela administração",
    admin: "Alterado pela administração",
    self_service: "Ativação do próprio cadastro",
    self_activate: "Ativação do próprio cadastro",
    pre_registration: "Cadastro da turma",
    import: "Importado de uma planilha",
    migration: "Atualização do site",
    sql: "Atualização do site",
    ti: "Alterado pelo suporte",
  };
  return lookup(sources, source) || "Atualização de acesso";
}

export async function resolveActivityNames(
  entries: readonly ActivityEntry[],
  lookup: (
    request: NameRequest,
  ) => Promise<readonly { id: string; name: string }[]>,
): Promise<Map<string, string>> {
  const requests = new Map<string, NameRequest>();
  const add = (
    table: NameRequest["table"],
    field: NameRequest["field"],
    id: unknown,
  ) => {
    if (typeof id !== "string" || !uuid.test(id)) return;
    const request = requests.get(table) || { table, field, ids: [] };
    if (!request.ids.includes(id)) request.ids.push(id);
    requests.set(table, request);
  };
  for (const entry of entries) {
    for (const row of [
      object(entry.old_values),
      object(entry.new_values),
      object(entry.context),
      ...(Array.isArray(entry.old_values) ? entry.old_values.map(object) : []),
      ...(Array.isArray(entry.new_values) ? entry.new_values.map(object) : []),
    ]) {
      for (const [key, [table, field]] of Object.entries(references))
        add(table, field, row[key]);
      for (const key of ["roles", "old_permissions", "new_permissions"])
        if (Array.isArray(row[key]))
          for (const id of row[key])
            add(key === "roles" ? "roles" : "permissions", "name", id);
    }
    if (
      entry.module in areas &&
      [
        "employees",
        "profiles",
        "roles",
        "classes",
        "departments",
        "job_positions",
        "managers",
      ].includes(entry.module)
    )
      add(
        entry.module as NameRequest["table"],
        ["employees", "profiles", "managers"].includes(entry.module)
          ? "full_name"
          : "name",
        entry.entity_id,
      );
  }
  const results = await Promise.allSettled([...requests.values()].map(lookup));
  const names = new Map<string, string>();
  for (const result of results)
    if (result.status === "fulfilled")
      for (const row of result.value)
        if (row.id && row.name) names.set(row.id, text(row.name));
  return names;
}

export function describeDatasulActivity(entry: {
  method: string;
  success: boolean;
  actor_name: string | null;
  response_status: number | null;
  duration_ms: number;
}) {
  const action = (
    {
      GET: [
        "Consultou informações no Datasul",
        "consultar informações no Datasul",
      ],
      POST: ["Enviou informações ao Datasul", "enviar informações ao Datasul"],
      PUT: [
        "Atualizou informações no Datasul",
        "atualizar informações no Datasul",
      ],
      PATCH: [
        "Atualizou informações no Datasul",
        "atualizar informações no Datasul",
      ],
      DELETE: [
        "Removeu informações do Datasul",
        "remover informações do Datasul",
      ],
    } as Record<string, string[]>
  )[entry.method.toUpperCase()];
  const title = action
    ? entry.success
      ? action[0]
      : `Não foi possível ${action[1]}`
    : "Atividade na conexão com Datasul";
  const explanations: Record<number, string> = {
    400: "O Datasul não aceitou as informações enviadas.",
    401: "A conexão precisa confirmar o acesso novamente.",
    403: "O Datasul não autorizou esse acesso.",
    404: "As informações não foram encontradas no Datasul.",
    429: "Houve muitas consultas ao mesmo tempo. Tente novamente em alguns instantes.",
  };
  const note = entry.success
    ? "O Datasul confirmou a operação."
    : explanations[entry.response_status || 0] ||
      "A conexão não conseguiu concluir a operação. O suporte pode conferir o motivo.";
  return {
    title,
    actor: activityActor({
      ...entry,
      action: entry.method,
      module: "ti_datasul_operations",
    }),
    result: entry.success ? "Concluído" : "Não concluído",
    note,
    duration: `${Math.max(0, entry.duration_ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} segundos`,
  };
}
