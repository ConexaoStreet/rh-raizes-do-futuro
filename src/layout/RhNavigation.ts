import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Presentation,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
  Building2,
  GraduationCap,
  MessagesSquare,
} from "lucide-react";

export type RhNavItem = {
  path: string;
  name: string;
  icon: LucideIcon;
  permission: string;
};

export type RhNavGroup = {
  label: string;
  items: RhNavItem[];
};

export const rhNavGroups: RhNavGroup[] = [
  {
    label: "ESPAÇOS E EQUIPES",
    items: [
      {
        path: "/meu-setor",
        name: "Meu setor",
        icon: Building2,
        permission: "workspace.view",
      },
      {
        path: "/gestores",
        name: "Área de gestores",
        icon: Users,
        permission: "workspace.overview",
      },
      {
        path: "/instrutor",
        name: "Área do instrutor",
        icon: GraduationCap,
        permission: "workspace.instructor",
      },
      {
        path: "/conversas",
        name: "Conversas",
        icon: MessagesSquare,
        permission: "chat.use",
      },
    ],
  },
  {
    label: "ACOMPANHAMENTO",
    items: [
      {
        path: "/",
        name: "Visão geral",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
      {
        path: "/hoje",
        name: "Hoje",
        icon: Activity,
        permission: "dashboard.view",
      },
      {
        path: "/colaboradores",
        name: "Colaboradores",
        icon: Users,
        permission: "employee.view",
      },
      {
        path: "/chamada",
        name: "Chamada do dia",
        icon: ClipboardCheck,
        permission: "attendance.manage",
      },
      {
        path: "/presenca",
        name: "Histórico de chamadas",
        icon: CalendarDays,
        permission: "",
      },
      { path: "/faltas", name: "Faltas", icon: FileText, permission: "" },
      { path: "/atrasos", name: "Atrasos", icon: Clock3, permission: "" },
      {
        path: "/justificativas",
        name: "Justificativas",
        icon: ShieldCheck,
        permission: "",
      },
    ],
  },
  {
    label: "DESENVOLVIMENTO",
    items: [
      {
        path: "/feedbacks",
        name: "Feedbacks",
        icon: MessageSquare,
        permission: "",
      },
      { path: "/notas", name: "Boletim", icon: Star, permission: "" },
      {
        path: "/gestao",
        name: "Avaliação da gestão",
        icon: BarChart3,
        permission: "",
      },
      {
        path: "/calendario",
        name: "Calendário de cursos",
        icon: CalendarDays,
        permission: "",
      },
    ],
  },
  {
    label: "SUPORTE",
    items: [
      {
        path: "/suporte-ti",
        name: "Chamado T.I.",
        icon: LifeBuoy,
        permission: "",
      },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      {
        path: "/relatorios",
        name: "Relatórios",
        icon: FileBarChart2,
        permission: "report.view",
      },
      {
        path: "/apresentacoes",
        name: "Apresentações",
        icon: Presentation,
        permission: "report.export",
      },
      {
        path: "/usuarios",
        name: "Usuários",
        icon: Users,
        permission: "user.view",
      },
      {
        path: "/cargos",
        name: "Cargos e permissões",
        icon: Shield,
        permission: "role.manage",
      },
      {
        path: "/auditoria",
        name: "Logs e auditoria",
        icon: Activity,
        permission: "audit.view",
      },
      {
        path: "/configuracoes",
        name: "Configurações",
        icon: Settings,
        permission: "settings.manage",
      },
      {
        path: "/admin",
        name: "Administração total",
        icon: SlidersHorizontal,
        permission: "system.manage",
      },
    ],
  },
];
