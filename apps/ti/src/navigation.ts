import {
  Activity,
  BellRing,
  Boxes,
  Database,
  GitBranch,
  Globe2,
  HardDrive,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type TiView =
  | "overview"
  | "datasul"
  | "users"
  | "rh"
  | "storage"
  | "notifications"
  | "database"
  | "integrations"
  | "site"
  | "security"
  | "support"
  | "logs";

export type TiNavItem = {
  view: TiView;
  label: string;
  icon: LucideIcon;
  permission?: string;
};

export type TiNavGroup = {
  label: string;
  items: TiNavItem[];
};

export const tiNavigation: TiNavGroup[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { view: "overview", label: "Visão geral", icon: LayoutDashboard },
      { view: "datasul", label: "Datasul", icon: Database, permission: "ti.datasul.read" },
      { view: "users", label: "Usuários e acessos", icon: UserCog, permission: "ti.users.manage" },
      { view: "rh", label: "Dados do RH", icon: Users, permission: "employee.manage" },
    ],
  },
  {
    label: "INFRAESTRUTURA",
    items: [
      { view: "storage", label: "Arquivos e Storage", icon: HardDrive, permission: "ti.storage.manage" },
      { view: "notifications", label: "Notificações", icon: BellRing, permission: "ti.notifications.manage" },
      { view: "database", label: "Banco de dados", icon: Boxes, permission: "ti.database.view" },
      { view: "integrations", label: "GitHub e Vercel", icon: GitBranch },
      { view: "site", label: "Site RH", icon: Globe2, permission: "ti.manage" },
    ],
  },
  {
    label: "GOVERNANÇA",
    items: [
      { view: "security", label: "Segurança", icon: ShieldCheck, permission: "ti.security.view" },
      { view: "support", label: "Chamados T.I.", icon: Wrench, permission: "ti.manage" },
      { view: "logs", label: "Histórico de atividades", icon: Activity },
    ],
  },
];

export const tiViewTitles: Record<TiView, string> = {
  overview: "Visão geral",
  datasul: "Datasul RH",
  users: "Usuários e acessos",
  rh: "Dados do RH",
  storage: "Arquivos e Storage",
  notifications: "Notificações",
  database: "Banco de dados",
  integrations: "GitHub e Vercel",
  site: "Controle do site",
  security: "Segurança",
  support: "Chamados de T.I.",
  logs: "Histórico de atividades",
};
