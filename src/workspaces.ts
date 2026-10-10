export type SectorTask = {
  id: string;
  department_id: string;
  title: string;
  description: string;
  status: "todo" | "doing" | "done" | "blocked";
  priority: "low" | "normal" | "high";
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  version: number;
  updated_at: string;
};
export type Workspace = {
  viewer: string;
  overview: boolean;
  department: { id: string; name: string } | null;
  departments: {
    id: string;
    name: string;
    members: number;
    open_tasks: number;
  }[];
  members: {
    id: string;
    full_name: string;
    profile_id: string | null;
    account_active: boolean;
    status: string;
  }[];
  tasks: SectorTask[];
  metrics: {
    active_members: number;
    open_tasks: number;
    completed_tasks: number;
    attendance_records: number | null;
    pending_justifications: number | null;
  };
  generated_at: string;
};
export const taskLabels = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluída",
  blocked: "Precisa de apoio",
};
export const priorityLabels = { low: "Baixa", normal: "Normal", high: "Alta" };
export function sectorIdentity(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("ecolog"))
    return {
      accent: "#327b51",
      icon: "EC",
      title: "Ideias que fazem o futuro florescer.",
      description:
        "Organize ações ambientais, acompanhe entregas e combine os próximos passos com a equipe.",
      focus: [
        "Ações ambientais",
        "Campanhas e coleta",
        "Projetos sustentáveis",
      ],
    };
  if (normalized.includes("educa"))
    return {
      accent: "#496dc4",
      icon: "ED",
      title: "Conhecimento que abre caminhos.",
      description:
        "Reúna atividades, materiais de estudo e os compromissos de aprendizagem do setor.",
      focus: [
        "Atividades de aprendizagem",
        "Materiais e apoio",
        "Cursos e encontros",
      ],
    };
  if (normalized.includes("evento"))
    return {
      accent: "#a85c2c",
      icon: "EV",
      title: "Bons encontros começam na organização.",
      description:
        "Planeje os eventos, organize a preparação e acompanhe cada entrega até o dia da ação.",
      focus: [
        "Planejamento de eventos",
        "Preparação e logística",
        "Agenda de entregas",
      ],
    };
  if (normalized.includes("marketing"))
    return {
      accent: "#9560a8",
      icon: "MK",
      title: "Histórias que aproximam pessoas.",
      description:
        "Organize campanhas, conteúdos e materiais para dar voz às iniciativas do Raízes.",
      focus: ["Campanhas", "Conteúdos e materiais", "Comunicação da equipe"],
    };
  return {
    accent: "#153e31",
    icon: "RH",
    title: "Pessoas no centro de cada entrega.",
    description:
      "Acompanhe os combinados da equipe, organize as rotinas e cuide dos próximos passos do setor.",
    focus: [
      "Rotinas da equipe",
      "Acompanhamento de pessoas",
      "Organização das entregas",
    ],
  };
}
