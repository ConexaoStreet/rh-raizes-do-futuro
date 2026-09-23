import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Database,
  GitBranch,
  Globe2,
  LayoutDashboard,
  LogOut,
  Mail,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  Users,
  Wrench,
} from "lucide-react";
import { client, updateSetting } from "./api";
import { Brand, useAuth } from "./auth";
import { ThemeToggle } from "./theme";

type SettingRow = { key: string; value: unknown };
type JsonObject = Record<string, unknown>;
type View = "overview" | "integrations" | "site" | "security" | "logs";

const keys = ["ti_control", "ti_datasul", "ti_github", "ti_vercel", "ti_email", "ti_site", "maintenance"];

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function boolean(value: unknown) {
  return value === true;
}

function labelStatus(value: unknown) {
  const valueString = string(value, "unknown");
  if (valueString === "connected" || valueString === "healthy") return "Conectado";
  if (valueString === "partial") return "Parcial";
  if (valueString === "needs_secret") return "Credencial necessária";
  if (valueString === "needs_connection") return "Conexão necessária";
  if (valueString === "error") return "Erro";
  return "Não verificado";
}

function statusTone(value: unknown) {
  const valueString = string(value);
  if (valueString === "connected" || valueString === "healthy") return "ok";
  if (valueString === "error") return "error";
  return "warn";
}

export default function App() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("overview");
  const [settings, setSettings] = useState<Record<string, JsonObject>>({});
  const [loading, setLoading] = useState(true);
  const [databaseState, setDatabaseState] = useState<"checking" | "connected" | "error">("checking");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState("");
  const [busy, setBusy] = useState("");
  const [datasulResult, setDatasulResult] = useState<unknown>(null);
  const [platformResult, setPlatformResult] = useState<unknown>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [healthPath, setHealthPath] = useState("");
  const [employeesPath, setEmployeesPath] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  const datasul = settings.ti_datasul || {};
  const github = settings.ti_github || {};
  const vercel = settings.ti_vercel || {};
  const email = settings.ti_email || {};
  const site = settings.ti_site || {};
  const maintenance = settings.maintenance || {};

  async function reload() {
    setLoading(true);
    setDatabaseState("checking");
    setLoadError("");
    try {
      const [{ data, error }, auditResponse] = await Promise.all([
        client().from("settings").select("key,value").in("key", keys).order("key"),
        client().from("audit_logs").select("id,created_at,actor_name,action,module,event_type,success").order("created_at", { ascending: false }).limit(12),
      ]);
      if (error) throw error;
      if (auditResponse.error) throw auditResponse.error;
      const next: Record<string, JsonObject> = {};
      for (const row of (data || []) as SettingRow[]) next[row.key] = object(row.value);
      setSettings(next);
      setAudit((auditResponse.data || []) as Record<string, unknown>[]);
      setDatabaseState("connected");
      setLastRefreshAt(new Date().toISOString());
    } catch {
      setDatabaseState("error");
      setLoadError("Não foi possível atualizar o estado técnico. Verifique a sessão e a conexão com o Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    setCompanyId(string(datasul.company_id));
    setHealthPath(string(datasul.health_path, "/api/btb/v1/companies"));
    setEmployeesPath(string(datasul.employees_path));
    setMaintenanceTitle(string(site.maintenance_title, "Sistema em manutenção"));
    setMaintenanceMessage(string(site.maintenance_message, "Alguns recursos podem ficar temporariamente indisponíveis."));
  }, [
    datasul.company_id,
    datasul.employees_path,
    datasul.health_path,
    site.maintenance_message,
    site.maintenance_title,
  ]);

  const healthScore = useMemo(() => {
    const states = [
      databaseState === "connected" ? "connected" : "error",
      string(datasul.status),
      string(github.status),
      string(vercel.status),
      string(email.status),
    ];
    const score = states.reduce((total, item) => {
      if (item === "connected" || item === "healthy") return total + 1;
      if (item === "partial") return total + 0.5;
      return total;
    }, 0);
    return Math.round(score / states.length * 100);
  }, [databaseState, datasul.status, github.status, vercel.status, email.status]);

  async function invokeDatasul(action: "health" | "preview") {
    setBusy(`datasul-${action}`);
    setActionError("");
    try {
      const { data, error } = await client().functions.invoke("datasul-bridge", { body: { action } });
      if (error) throw error;
      setDatasulResult(data);
      await reload();
    } catch {
      setActionError(action === "health" ? "O teste do Datasul falhou." : "Não foi possível carregar a prévia do Datasul.");
    } finally {
      setBusy("");
    }
  }

  async function invokePlatform() {
    setBusy("platform");
    setActionError("");
    try {
      const { data, error } = await client().functions.invoke("platform-bridge", { body: { action: "status" } });
      if (error) throw error;
      setPlatformResult(data);
      await reload();
    } catch {
      setActionError("Não foi possível verificar GitHub e Vercel pela ponte interna.");
    } finally {
      setBusy("");
    }
  }

  async function saveDatasul() {
    setBusy("save-datasul");
    setActionError("");
    try {
      await updateSetting("ti_datasul", {
        ...datasul,
        company_id: companyId || null,
        health_path: healthPath || "/api/btb/v1/companies",
        employees_path: employeesPath || null,
      });
      await reload();
    } catch {
      setActionError("Não foi possível salvar a configuração do Datasul.");
    } finally {
      setBusy("");
    }
  }

  async function toggleMaintenance() {
    const nextEnabled = !boolean(maintenance.enabled);
    const confirmed = window.confirm(
      nextEnabled
        ? "Ativar a manutenção global do RH? O acesso dos usuários poderá ser interrompido."
        : "Desativar a manutenção global e liberar novamente o acesso normal ao RH?",
    );
    if (!confirmed) return;
    setBusy("maintenance");
    setActionError("");
    try {
      await updateSetting("maintenance", {
        ...maintenance,
        enabled: nextEnabled,
      });
      await reload();
    } catch {
      setActionError("Não foi possível alterar o modo de manutenção.");
    } finally {
      setBusy("");
    }
  }

  async function saveMaintenanceText() {
    setBusy("maintenance-text");
    setActionError("");
    try {
      await updateSetting("ti_site", {
        ...site,
        maintenance_title: maintenanceTitle,
        maintenance_message: maintenanceMessage,
      });
      await reload();
    } catch {
      setActionError("Não foi possível salvar a comunicação de manutenção.");
    } finally {
      setBusy("");
    }
  }

  const rhSite = import.meta.env.VITE_RH_SITE_URL || "https://rh-raizes-do-futuro.vercel.app";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#ti-main-content">Pular para o conteúdo</a>
      <aside className="sidebar">
        <Brand />
        <div className="environment">
          <span className="pulse" />
          Produção
        </div>
        <nav>
          <NavButton active={view === "overview"} icon={<LayoutDashboard />} onClick={() => setView("overview")}>Visão geral</NavButton>
          <NavButton active={view === "integrations"} icon={<CircleDot />} onClick={() => setView("integrations")}>Integrações</NavButton>
          <NavButton active={view === "site"} icon={<Globe2 />} onClick={() => setView("site")}>Site RH</NavButton>
          <NavButton active={view === "security"} icon={<ShieldCheck />} onClick={() => setView("security")}>Segurança</NavButton>
          <NavButton active={view === "logs"} icon={<Activity />} onClick={() => setView("logs")}>Logs</NavButton>
        </nav>
        <div className="sidebar-bottom">
          <a className="external-link" href={rhSite} target="_blank" rel="noreferrer">
            <ArrowUpRight size={16} />
            Abrir site do RH
          </a>
          <button className="logout" onClick={() => void client().auth.signOut()}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main id="ti-main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">CENTRAL TÉCNICA</span>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="operator">
            <ThemeToggle compact />
            <div>
              <strong>{user.profile.full_name}</strong>
              <span>{user.roles.join(" · ")}</span>
            </div>
            <div className="operator-avatar">{user.profile.full_name.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="content">
          {loadError && <Notice>{loadError}</Notice>}
          {actionError && <Notice>{actionError}</Notice>}
          {loading ? (
            <div className="loading-panel"><div className="loader" />Carregando infraestrutura...</div>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <section className="hero">
                    <div>
                      <span className="eyebrow">OPERAÇÃO DO RAÍZES DO FUTURO</span>
                      <h2>Controle técnico em um ambiente separado do RH.</h2>
                      <p>Monitore serviços, integrações, manutenção, deploys e segurança sem misturar a operação técnica com a rotina da turma.</p>
                    </div>
                    <div className="health-ring">
                      <strong>{healthScore}%</strong>
                      <span>saúde verificada</span>
                    </div>
                  </section>
                  <ServiceGrid datasul={datasul} github={github} vercel={vercel} email={email} databaseState={databaseState} maintenance={maintenance} />
                  <div className="two-columns">
                    <Panel title="Estado do site" kicker="RH EM PRODUÇÃO" icon={<Globe2 />}>
                      <StateRow name="Acesso principal" value="Produção configurada" tone="ok" />
                      <StateRow name="Modo de manutenção" value={boolean(maintenance.enabled) ? "Ativo" : "Desativado"} tone={boolean(maintenance.enabled) ? "warn" : "ok"} />
                      <StateRow name="Supabase" value={databaseState === "connected" ? "Conectado" : databaseState === "error" ? "Erro" : "Verificando"} tone={databaseState === "connected" ? "ok" : "warn"} />
                      <StateRow name="Última leitura" value={lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Pendente"} tone={lastRefreshAt ? "ok" : "warn"} />
                    </Panel>
                    <Panel title="Atividade recente" kicker="AUDITORIA" icon={<Activity />}>
                      <AuditList rows={audit.slice(0, 5)} />
                    </Panel>
                  </div>
                </>
              )}

              {view === "integrations" && (
                <>
                  <ServiceGrid datasul={datasul} github={github} vercel={vercel} email={email} databaseState={databaseState} maintenance={maintenance} />
                  <div className="two-columns">
                    <Panel title="Datasul RH" kicker="ERP / COLABORADORES" icon={<Database />}>
                      <div className="form-grid">
                        <Field label="Company ID"><input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Ex.: 10" /></Field>
                        <Field label="Health endpoint"><input value={healthPath} onChange={(event) => setHealthPath(event.target.value)} /></Field>
                        <Field label="Endpoint de colaboradores" wide><input value={employeesPath} onChange={(event) => setEmployeesPath(event.target.value)} placeholder="/api/rh/v1/..." /></Field>
                      </div>
                      <div className="actions">
                        <button onClick={() => void saveDatasul()} disabled={busy !== ""}><Settings2 size={16} />Salvar</button>
                        <button className="primary-button" onClick={() => void invokeDatasul("health")} disabled={busy !== ""}><RefreshCw size={16} />Testar conexão</button>
                        <button onClick={() => void invokeDatasul("preview")} disabled={busy !== "" || !employeesPath}><Users size={16} />Prévia</button>
                      </div>
                      <Notice>As credenciais ficam nos Secrets do Supabase e nunca aparecem neste navegador.</Notice>
                      {string(datasul.last_error) && <Notice>{string(datasul.last_error)}</Notice>}
                      {datasulResult !== null && <pre>{JSON.stringify(datasulResult, null, 2)}</pre>}
                    </Panel>
                    <Panel title="GitHub + Vercel" kicker="CÓDIGO E DEPLOY" icon={<GitBranch />}>
                      <p className="panel-copy">A ponte já está criada. Quando os tokens forem configurados no Supabase, esta área passa a mostrar Actions e deploys em tempo real.</p>
                      <button className="primary-button" onClick={() => void invokePlatform()} disabled={busy !== ""}><RefreshCw size={16} />Verificar plataforma</button>
                      <Notice>Secrets necessários: GITHUB_TOKEN, VERCEL_TOKEN e VERCEL_TEAM_ID.</Notice>
                      {string(github.last_error) && <Notice>{string(github.last_error)}</Notice>}
                      {string(vercel.last_error) && <Notice>{string(vercel.last_error)}</Notice>}
                      {platformResult !== null && <pre>{JSON.stringify(platformResult, null, 2)}</pre>}
                    </Panel>
                  </div>
                </>
              )}

              {view === "site" && (
                <div className="two-columns">
                  <Panel title="Manutenção global" kicker="SITE RH" icon={<Wrench />}>
                    <div className="maintenance-state">
                      <span className={boolean(maintenance.enabled) ? "status-dot warn" : "status-dot ok"} />
                      <div><strong>{boolean(maintenance.enabled) ? "Manutenção ativa" : "Operação normal"}</strong><span>A equipe de T.I preserva acesso técnico durante manutenção.</span></div>
                    </div>
                    <button className={boolean(maintenance.enabled) ? "primary-button" : "danger-button"} onClick={() => void toggleMaintenance()} disabled={busy !== ""}>
                      <Wrench size={16} />
                      {boolean(maintenance.enabled) ? "Desativar manutenção" : "Ativar manutenção"}
                    </button>
                  </Panel>
                  <Panel title="Mensagem de manutenção" kicker="COMUNICAÇÃO" icon={<Mail />}>
                    <Field label="Título"><input value={maintenanceTitle} onChange={(event) => setMaintenanceTitle(event.target.value)} /></Field>
                    <Field label="Mensagem"><textarea rows={5} value={maintenanceMessage} onChange={(event) => setMaintenanceMessage(event.target.value)} /></Field>
                    <button className="primary-button" onClick={() => void saveMaintenanceText()} disabled={busy !== ""}>Salvar comunicação</button>
                  </Panel>
                </div>
              )}

              {view === "security" && (
                <div className="two-columns">
                  <Panel title="Camada de acesso" kicker="SEGURANÇA" icon={<ShieldCheck />}>
                    <StateRow name="Login técnico" value="Supabase Auth" tone="ok" />
                    <StateRow name="2FA privilegiado" value="Obrigatório" tone="ok" />
                    <StateRow name="RLS" value="Ativo" tone="ok" />
                    <StateRow name="Secrets" value="Servidor" tone="ok" />
                  </Panel>
                  <Panel title="Pendências" kicker="HARDENING" icon={<AlertTriangle />}>
                    <Notice>Leaked Password Protection ainda precisa ser ativada no Supabase Auth.</Notice>
                    <p className="panel-copy">Os tokens do Datasul, GitHub e Vercel devem ser inseridos diretamente nos Secrets do Supabase, nunca no frontend ou no repositório.</p>
                  </Panel>
                </div>
              )}

              {view === "logs" && (
                <Panel title="Logs e auditoria" kicker="ÚLTIMAS AÇÕES" icon={<TerminalSquare />}>
                  <AuditList rows={audit} full />
                </Panel>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function titleFor(view: View) {
  return {
    overview: "Visão geral",
    integrations: "Integrações",
    site: "Controle do site",
    security: "Segurança",
    logs: "Logs e auditoria",
  }[view];
}

function NavButton({ active, icon, children, onClick }: { active: boolean; icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>{icon}<span>{children}</span></button>;
}

function ServiceGrid({
  datasul,
  github,
  vercel,
  email,
  databaseState,
  maintenance,
}: {
  datasul: JsonObject;
  github: JsonObject;
  vercel: JsonObject;
  email: JsonObject;
  databaseState: "checking" | "connected" | "error";
  maintenance: JsonObject;
}) {
  return (
    <section className="service-grid">
      <Service icon={<Globe2 />} title="Site RH" subtitle="Produção" status={boolean(maintenance.enabled) ? "Manutenção" : "Configurado"} tone="warn" />
      <Service icon={<Database />} title="Supabase" subtitle="Banco + Auth" status={databaseState === "connected" ? "Conectado" : databaseState === "error" ? "Erro" : "Verificando"} tone={databaseState === "connected" ? "ok" : databaseState === "error" ? "error" : "warn"} />
      <Service icon={<CircleDot />} title="Datasul" subtitle="RH / ERP" status={labelStatus(datasul.status)} tone={statusTone(datasul.status)} />
      <Service icon={<GitBranch />} title="GitHub" subtitle={string(github.repository, "Repositório")} status={labelStatus(github.status)} tone={statusTone(github.status)} />
      <Service icon={<Server />} title="Vercel" subtitle={string(vercel.project, "Deploy")} status={labelStatus(vercel.status)} tone={statusTone(vercel.status)} />
      <Service icon={<Mail />} title="E-mail T.I" subtitle="Comunicados" status={labelStatus(email.status)} tone={statusTone(email.status)} />
    </section>
  );
}

function Service({ icon, title, subtitle, status, tone }: { icon: ReactNode; title: string; subtitle: string; status: string; tone: string }) {
  return (
    <article className="service-card">
      <div className="service-icon">{icon}</div>
      <div className="service-text"><strong>{title}</strong><span>{subtitle}</span></div>
      <div className={`badge ${tone}`}>{tone === "ok" ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{status}</div>
    </article>
  );
}

function Panel({ title, kicker, icon, children }: { title: string; kicker: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div><span className="eyebrow">{kicker}</span><h3>{title}</h3></div>
        <div className="panel-icon">{icon}</div>
      </header>
      {children}
    </section>
  );
}

function StateRow({ name, value, tone }: { name: string; value: string; tone: "ok" | "warn" }) {
  return <div className="state-row"><span>{name}</span><strong className={tone}>{value}</strong></div>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={wide ? "field wide" : "field"}><span>{label}</span>{children}</label>;
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="notice"><AlertTriangle size={17} /><span>{children}</span></div>;
}

function AuditList({ rows, full = false }: { rows: Record<string, unknown>[]; full?: boolean }) {
  if (!rows.length) return <div className="empty">Nenhum registro disponível.</div>;
  return (
    <div className={full ? "audit-list full" : "audit-list"}>
      {rows.map((row) => (
        <div className="audit-row" key={string(row.id)}>
          <div className="audit-icon"><Activity size={15} /></div>
          <div><strong>{string(row.action, "Ação")}</strong><span>{string(row.actor_name, "Sistema")} · {string(row.module, "geral")}</span></div>
          <time>{new Date(string(row.created_at)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
        </div>
      ))}
    </div>
  );
}
