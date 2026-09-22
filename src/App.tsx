import { lazy, Suspense, useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
  X,
  UserCircle,
  ChevronsUpDown,
  Presentation,
} from "lucide-react";
import { AuthBoundary, useAuth } from "./auth";
import { client, rpc, runAction, useAsync, useDebounce } from "./api";
import { Brand, Loading, Modal } from "./components";
import { EntityPage, specs } from "./entities";
import { captureNavigation } from "./telemetry";
import Dashboard from "./Dashboard";
const Attendance = lazy(() => import("./Attendance"));
const People = lazy(() => import("./People"));
const Performance = lazy(() => import("./Performance"));
const ManagerReviews = lazy(() => import("./ManagerReviews"));
const Reports = lazy(() => import("./Reports"));
const Administration = lazy(() => import("./Administration"));
const Calendar = lazy(() => import("./Calendar"));
const navGroups = [
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
      { path: "/notas", name: "Notas", icon: Star, permission: "" },
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
export default function App() {
  return (
    <AuthBoundary>
      <Shell />
    </AuthBoundary>
  );
}
function Guard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { can } = useAuth();
  return can(permission) ? (
    children
  ) : (
    <div className="empty">
      <Shield />
      <h1>Você não tem permissão.</h1>
      <Link to="/">Voltar</Link>
    </div>
  );
}
function Shell() {
  const { user, can } = useAuth();
  const location = useLocation();
  useEffect(() => { captureNavigation(location.pathname); }, [location.pathname]);
  const [mobile, setMobile] = useState(false);
  const [account, setAccount] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifications = useAsync(async () => {
    const { count, error } = await client()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) throw error;
    return count || 0;
  }, []);
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only icon-button"
            aria-label="Fechar menu"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-icon">RH</span>
          <div>
            Raízes do Futuro<small>Turma 16807 · Anhanguera / ESPRO</small>
          </div>
        </div>
        <nav>
          {!can("dashboard.view") && (
            <NavLink to="/" end onClick={() => setMobile(false)}>
              <UserCircle size={18} />
              Meu perfil
            </NavLink>
          )}
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              {group.items.some(
                (item) => !item.permission || can(item.permission),
              ) && <div className="nav-label">{group.label}</div>}
              {group.items
                .filter((item) => !item.permission || can(item.permission))
                .map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={() => setMobile(false)}
                  >
                    <item.icon size={18} />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="subtle-mark">R/F</span>
          <span>Raízes do Futuro</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-only icon-button"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span className="desktop-only">
              Raízes do Futuro <span className="slash">/</span> RH
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              aria-label="Busca global"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
              <span>Buscar no RH</span>
            </button>
            <Link
              to="/notificacoes"
              className="icon-button notification-bell"
              aria-label="Notificações"
            >
              <Bell size={19} />
              {Boolean(notifications.data) && <span>{notifications.data}</span>}
            </Link>
            <div className="account-wrapper">
              <button
                className="account-trigger"
                onClick={() => setAccount(!account)}
                aria-expanded={account}
              >
                <span className="avatar avatar-dark">
                  {user.profile.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")}
                </span>
                <span className="desktop-only">
                  {user.profile.full_name.split(" ")[0]}
                  <small>
                    {user.roles.includes("SUPER_ADMIN")
                      ? "Administrador Total"
                      : user.privileged
                        ? "Gestor"
                        : "Colaborador"}
                  </small>
                </span>
                <ChevronsUpDown size={15} />
              </button>
              {account && (
                <div className="account-menu">
                  <Link to="/sessoes" onClick={() => setAccount(false)}>
                    Minhas sessões
                  </Link>
                  {user.employee_id && (
                    <Link
                      to={`/colaboradores/${user.employee_id}`}
                      onClick={() => setAccount(false)}
                    >
                      Meu perfil
                    </Link>
                  )}
                  <button
                    onClick={() =>
                      void runAction(async () => {
                        await rpc("authenticate_event", {
                          action_name: "logout",
                        });
                        await client().auth.signOut();
                      }, "")
                    }
                  >
                    <LogOut size={17} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="page-content">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route
                path="/"
                element={
                  can("dashboard.view") ? (
                    <Dashboard />
                  ) : (
                    <People mode="profile" />
                  )
                }
              />
              <Route
                path="/hoje"
                element={
                  <Guard permission="dashboard.view">
                    <Dashboard today />
                  </Guard>
                }
              />
              <Route
                path="/colaboradores"
                element={
                  <Guard permission="employee.view">
                    <People mode="employees" />
                  </Guard>
                }
              />
              <Route
                path="/colaboradores/:id"
                element={<People mode="profile" />}
              />
              <Route
                path="/chamada"
                element={
                  <Guard permission="attendance.manage">
                    <Attendance />
                  </Guard>
                }
              />
              <Route path="/presenca" element={<Attendance history />} />
              <Route path="/faltas" element={<People mode="absences" />} />
              <Route path="/atrasos" element={<People mode="lateness" />} />
              <Route path="/feedbacks" element={<People mode="feedbacks" />} />
              <Route
                path="/justificativas"
                element={<People mode="justifications" />}
              />
              <Route path="/notas" element={<Performance />} />
              <Route path="/gestao" element={<ManagerReviews />} />
              <Route path="/calendario" element={<Calendar />} />
              <Route
                path="/relatorios"
                element={
                  <Guard permission="report.view">
                    <Reports />
                  </Guard>
                }
              />
              <Route
                path="/apresentacoes"
                element={
                  <Guard permission="report.export">
                    <Reports presentation />
                  </Guard>
                }
              />
              <Route
                path="/notificacoes"
                element={<Administration mode="notifications" />}
              />
              <Route
                path="/sessoes"
                element={<Administration mode="sessions" />}
              />
              {[
                "usuarios",
                "cargos",
                "auditoria",
                "configuracoes",
                "admin",
              ].map((route, i) => (
                <Route
                  key={route}
                  path={`/${route}`}
                  element={
                    <Guard
                      permission={
                        [
                          "user.view",
                          "role.manage",
                          "audit.view",
                          "settings.manage",
                          "system.manage",
                        ][i]
                      }
                    >
                      <Administration mode={route} />
                    </Guard>
                  }
                />
              ))}
              {Object.entries(specs)
                .filter(
                  ([key]) => !["colaboradores", "feedbacks"].includes(key),
                )
                .map(([key, spec]) => (
                  <Route
                    key={key}
                    path={`/configuracoes/${key}`}
                    element={
                      <Guard permission={spec.permission}>
                        <EntityPage spec={spec} />
                      </Guard>
                    }
                  />
                ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
function GlobalSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const query = useDebounce(search);
  const navigate = useNavigate();
  const results = useAsync(async () => {
    if (!open || query.trim().length < 2) return [];
    const clean = query.replace(/[%_]/g, "");
    const requests = [
      ["employees", "full_name", "Colaborador", "/colaboradores/"],
      ["feedbacks", "title", "Feedback", "/feedbacks"],
      ["reports", "title", "Relatório", "/relatorios"],
      ["events", "title", "Evento", "/configuracoes/eventos"],
      ["manager_review_cycles", "title", "Avaliação", "/gestao"],
    ] as const;
    const response = await Promise.all(
      requests.map(async ([table, column, type, path]) => {
        const { data, error } = await client()
          .from(table)
          .select("*")
          .ilike(column, `%${clean}%`)
          .limit(6);
        if (error) throw error;
        return (data as unknown as Record<string, string>[]).map((row) => ({
          id: row.id,
          name: row[column],
          type,
          path: table === "employees" ? path + row.id : path,
        }));
      }),
    );
    return response.flat();
  }, [query, open]);
  return (
    <Modal title="Busca global" open={open} onClose={onClose}>
      <div className="search-input">
        <Search size={19} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Pesquisar"
          autoFocus
          placeholder="Nome, matrícula ou título"
        />
      </div>
      <div className="search-results">
        {results.loading && query.length >= 2 ? (
          <Loading />
        ) : (
          results.data?.map((item) => (
            <button
              key={item.type + item.id}
              onClick={() => {
                navigate(item.path);
                onClose();
              }}
            >
              <span>{item.name}</span>
              <small>{item.type}</small>
            </button>
          ))
        )}
        {query.length >= 2 && !results.loading && !results.data?.length && (
          <p>Nenhum registro encontrado.</p>
        )}
      </div>
    </Modal>
  );
}
