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
  Bell,
  BellRing,
  LogOut,
  Download,
  Menu,
  Search,
  Shield,
  X,
  UserCircle,
  ChevronsUpDown,
} from "lucide-react";
import { useAuth } from "./auth";
import { client, rpc, runAction, useAsync, useDebounce } from "./api";
import { Brand, Loading, Modal } from "./components";
import { captureNavigation } from "./telemetry";
import { ThemeToggle } from "./theme";
import { enablePushNotifications, pushSupported } from "./push";
import { rhNavGroups } from "./layout/RhNavigation";
import DeveloperAvailabilityNotice from "./DeveloperAvailabilityNotice";
const Dashboard = lazy(() => import("./Dashboard"));
const Attendance = lazy(() => import("./Attendance"));
const People = lazy(() => import("./People"));
const Performance = lazy(() => import("./Performance"));
const ManagerReviews = lazy(() => import("./ManagerReviews"));
const Reports = lazy(() => import("./Reports"));
const Administration = lazy(() => import("./Administration"));
const Calendar = lazy(() => import("./Calendar"));
const EntitySettings = lazy(() => import("./EntitySettings"));
const SupportTickets = lazy(() => import("./SupportTickets"));
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

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
export default function Shell() {
  const { user, can } = useAuth();
  const location = useLocation();
  useEffect(() => { captureNavigation(location.pathname); }, [location.pathname]);
  const [mobile, setMobile] = useState(false);
  const [account, setAccount] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
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
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
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
        <div
          className="workspace-label"
          style={{
            overflow: "hidden",
            background:
              "radial-gradient(circle at 14% 50%, rgba(105,230,148,.14), transparent 30%), linear-gradient(115deg, rgba(20,58,43,.96), rgba(10,35,26,.97))",
          }}
        >
          <span
            className="workspace-icon"
            aria-hidden="true"
            style={{
              overflow: "hidden",
              borderColor: "rgba(173,235,190,.15)",
              background:
                "radial-gradient(circle, rgba(77,154,102,.32), rgba(17,61,43,.74) 70%)",
              boxShadow: "inset 0 0 12px rgba(88,214,132,.09)",
            }}
          >
            <img
              src="/brand/raizes-logo-mark.png"
              alt=""
              width={28}
              height={28}
              style={{
                filter: "brightness(2.05) contrast(1.12)",
                opacity: 0.96,
              }}
            />
          </span>
          <div className="workspace-copy">
            <strong>Gestão de RH</strong>
            <small>Raízes do Futuro · Turma 16807</small>
          </div>
        </div>
        <nav aria-label="Navegação principal do RH">
          {!can("dashboard.view") && (
            <NavLink to="/" end onClick={() => setMobile(false)}>
              <UserCircle size={18} />
              Meu perfil
            </NavLink>
          )}
          {rhNavGroups.map((group) => (
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
                    state={
                      item.path === "/suporte-ti"
                        ? {
                            reportPath:
                              location.pathname === "/suporte-ti"
                                ? "/"
                                : location.pathname,
                          }
                        : undefined
                    }
                    onClick={() => setMobile(false)}
                  >
                    <item.icon size={18} />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <DeveloperAvailabilityNotice placement="shell" />
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-only icon-button"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <div className="topbar-context desktop-only">
              <span>Raízes do Futuro</span>
              <strong>Gestão de RH</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle compact />
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
                <span
                  className="avatar avatar-dark"
                  style={{
                    overflow: "hidden",
                    border: "1px solid rgba(154,232,177,.17)",
                    borderRadius: 11,
                    color: "#e9f8d5",
                    background:
                      "radial-gradient(circle, rgba(51,111,74,.92) 0 45%, transparent 46%), conic-gradient(from 205deg, #143c2b, #2a6848, #143c2b 68%)",
                    boxShadow: "inset 0 0 10px rgba(88,214,132,.09)",
                  }}
                >
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
                      ? "Desenvolvedor"
                      : user.roles.includes("TI_ADMIN")
                        ? "Administrador T.I."
                        : user.roles.includes("DIRECTOR")
                          ? "Diretor"
                          : user.roles.includes("MANAGER")
                            ? "Gestor"
                            : user.roles.includes("INSTRUCTOR")
                              ? "Instrutor"
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
                  {pushSupported() && (
                    <button
                      onClick={() =>
                        void runAction(
                          () => enablePushNotifications(),
                          "Notificações do celular ativadas.",
                        )
                      }
                    >
                      <BellRing size={17} />
                      Ativar notificações no celular
                    </button>
                  )}
                  {installPrompt && (
                    <button
                      onClick={() =>
                        void (async () => {
                          await installPrompt.prompt();
                          await installPrompt.userChoice;
                          setInstallPrompt(null);
                          setAccount(false);
                        })()
                      }
                    >
                      <Download size={17} />
                      Instalar aplicativo
                    </button>
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
              <Route path="/suporte-ti" element={<SupportTickets />} />
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
              <Route path="/configuracoes/:entity" element={<EntitySettings />} />
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
  const { can } = useAuth();
  const results = useAsync(async () => {
    if (!open || query.trim().length < 2) return [];
    const clean = query.replace(/[%_]/g, "");
    const requests = [
      ["employees", "full_name", "Colaborador", "/colaboradores/", can("employee.view")],
      ["feedbacks", "title", "Feedback", "/feedbacks", can("feedback.view")],
      ["reports", "title", "Relatório", "/relatorios", can("report.view")],
      ["events", "title", "Evento", "/configuracoes/eventos", can("calendar.manage")],
      ["manager_review_cycles", "title", "Avaliação", "/gestao", can("review.manage") || can("review.results")],
    ] as const;
    const response = await Promise.all(
      requests
        .filter(([, , , , allowed]) => allowed)
        .map(async ([table, column, type, path]) => {
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
  }, [query, open, can("employee.view"), can("feedback.view"), can("report.view"), can("calendar.manage"), can("review.manage"), can("review.results")]);
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
