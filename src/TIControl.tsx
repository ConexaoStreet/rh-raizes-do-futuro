import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Database,
  GitBranch,
  Globe2,
  Mail,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { client, json, runAction, useAsync } from "./api";
import { Heading, Loading } from "./components";

type IntegrationState = Record<string, unknown>;
type SettingRow = { key: string; value: unknown };

const integrationKeys = ["ti_control", "ti_datasul", "ti_github", "ti_vercel", "ti_email", "ti_site", "maintenance"];

function asObject(value: unknown): IntegrationState {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as IntegrationState)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown) {
  return value === true;
}

function statusLabel(value: unknown) {
  const status = text(value, "unknown");
  if (status === "connected" || status === "healthy") return "Conectado";
  if (status === "partial") return "Parcial";
  if (status === "needs_secret") return "Credencial necessária";
  if (status === "needs_connection") return "Conexão necessária";
  if (status === "error") return "Erro";
  return status === "unknown" ? "Não verificado" : status;
}

function tone(value: unknown) {
  const status = text(value);
  if (status === "connected" || status === "healthy") return "ok";
  if (status === "error") return "error";
  return "warn";
}

export default function TIControl() {
  const settings = useAsync(async () => {
    const { data, error } = await client()
      .from("settings")
      .select("key,value")
      .in("key", integrationKeys)
      .order("key");
    if (error) throw error;
    return (data || []) as SettingRow[];
  }, []);

  const map = useMemo(() => {
    const result: Record<string, IntegrationState> = {};
    for (const row of settings.data || []) result[row.key] = asObject(row.value);
    return result;
  }, [settings.data]);

  const datasul = map.ti_datasul || {};
  const github = map.ti_github || {};
  const vercel = map.ti_vercel || {};
  const email = map.ti_email || {};
  const maintenance = map.maintenance || {};
  const site = map.ti_site || {};

  const [companyId, setCompanyId] = useState("");
  const [healthPath, setHealthPath] = useState("");
  const [employeesPath, setEmployeesPath] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [datasulResult, setDatasulResult] = useState<unknown>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setCompanyId(text(datasul.company_id));
    setHealthPath(text(datasul.health_path, "/api/btb/v1/companies"));
    setEmployeesPath(text(datasul.employees_path));
    setMaintenanceTitle(text(site.maintenance_title, "Sistema em manutenção"));
    setMaintenanceMessage(text(site.maintenance_message, "Alguns recursos podem ficar temporariamente indisponíveis."));
  }, [settings.data]);

  async function updateSetting(key: string, value: IntegrationState) {
    const { error } = await client()
      .from("settings")
      .update({ value: json(value), updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) throw error;
  }

  async function invokeDatasul(action: "health" | "preview") {
    setBusy(action);
    const ok = await runAction(async () => {
      const { data, error } = await client().functions.invoke("datasul-bridge", {
        body: { action },
      });
      if (error) throw error;
      setDatasulResult(data);
      if (data && typeof data === "object" && "ok" in data && data.ok === false) {
        throw new Error("Não foi possível concluir a operação no Datasul.");
      }
    }, action === "health" ? "Conexão do Datasul verificada." : "Prévia do Datasul carregada.");
    setBusy("");
    if (ok) settings.reload();
  }

  if (settings.loading) return <Loading />;

  return (
    <>
      <Heading title="Central de T.I" eyebrow="RAÍZES DO FUTURO · CONTROLE TÉCNICO">
        <button className="secondary" onClick={settings.reload}>
          <RefreshCw size={17} />
          Atualizar status
        </button>
      </Heading>

      <section className="ti-overview">
        <ServiceCard
          icon={<Globe2 />}
          name="Site RH"
          detail="Produção"
          status="Online"
          tone="ok"
        />
        <ServiceCard
          icon={<Database />}
          name="Supabase"
          detail="Banco, Auth e Edge Functions"
          status="Conectado"
          tone="ok"
        />
        <ServiceCard
          icon={<CircleDot />}
          name="Datasul"
          detail="RH / ERP"
          status={statusLabel(datasul.status)}
          tone={tone(datasul.status)}
        />
        <ServiceCard
          icon={<GitBranch />}
          name="GitHub"
          detail={text(github.repository, "Repositório do RH")}
          status={statusLabel(github.status)}
          tone={tone(github.status)}
        />
        <ServiceCard
          icon={<Server />}
          name="Vercel"
          detail={text(vercel.project, "Deploy")}
          status={statusLabel(vercel.status)}
          tone={tone(vercel.status)}
        />
        <ServiceCard
          icon={<Mail />}
          name="E-mail T.I"
          detail={text(email.sender_label, "Comunicado T.I")}
          status={statusLabel(email.status)}
          tone={tone(email.status)}
        />
      </section>

      <div className="ti-grid">
        <section className="panel ti-panel">
          <div className="ti-panel-heading">
            <div>
              <span className="ti-kicker">DATASUL RH</span>
              <h2>Integração de colaboradores</h2>
              <p>A credencial fica somente nos Secrets do Supabase. O navegador nunca recebe usuário ou senha do Datasul.</p>
            </div>
            <ShieldCheck size={25} />
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Empresa / companyId</span>
              <input
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                placeholder="Ex.: 10"
              />
            </label>
            <label className="field">
              <span>Endpoint de saúde</span>
              <input
                value={healthPath}
                onChange={(event) => setHealthPath(event.target.value)}
                placeholder="/api/btb/v1/companies"
              />
            </label>
            <label className="field field-wide">
              <span>Endpoint de colaboradores</span>
              <input
                value={employeesPath}
                onChange={(event) => setEmployeesPath(event.target.value)}
                placeholder="/api/rh/v1/..."
              />
            </label>
          </div>

          <div className="ti-actions">
            <button
              className="secondary"
              disabled={busy !== ""}
              onClick={() =>
                void runAction(async () => {
                  await updateSetting("ti_datasul", {
                    ...datasul,
                    company_id: companyId || null,
                    health_path: healthPath || "/api/btb/v1/companies",
                    employees_path: employeesPath || null,
                  });
                  settings.reload();
                }, "Configuração do Datasul salva.")
              }
            >
              <Settings2 size={17} />
              Salvar configuração
            </button>
            <button
              className="primary"
              disabled={busy !== ""}
              onClick={() => void invokeDatasul("health")}
            >
              <RefreshCw size={17} className={busy === "health" ? "spin" : ""} />
              Testar conexão
            </button>
            <button
              className="secondary"
              disabled={busy !== "" || !employeesPath}
              onClick={() => void invokeDatasul("preview")}
            >
              <Database size={17} />
              Prévia dos colaboradores
            </button>
          </div>

          {datasulResult !== null && (
            <pre className="ti-result">{JSON.stringify(datasulResult, null, 2)}</pre>
          )}

          <div className="ti-secret-note">
            <AlertTriangle size={18} />
            <span>
              Para ativar a conexão real ainda faltam os Secrets <strong>DATASUL_BASE_URL</strong>, <strong>DATASUL_USERNAME</strong> e <strong>DATASUL_PASSWORD</strong>.
            </span>
          </div>
        </section>

        <section className="panel ti-panel">
          <div className="ti-panel-heading">
            <div>
              <span className="ti-kicker">SITE RH</span>
              <h2>Modo de manutenção</h2>
              <p>Controla o bloqueio global já usado pelo login e pelas permissões do sistema.</p>
            </div>
            <Wrench size={25} />
          </div>

          <div className="ti-maintenance-status">
            <span className={bool(maintenance.enabled) ? "ti-dot ti-dot-warn" : "ti-dot ti-dot-ok"} />
            <div>
              <strong>{bool(maintenance.enabled) ? "Manutenção ativa" : "Operação normal"}</strong>
              <small>{bool(maintenance.allow_managers) ? "Gestores podem acessar" : "Acesso técnico preservado"}</small>
            </div>
          </div>

          <div className="form-grid">
            <label className="field field-wide">
              <span>Título do aviso</span>
              <input value={maintenanceTitle} onChange={(event) => setMaintenanceTitle(event.target.value)} />
            </label>
            <label className="field field-wide">
              <span>Mensagem</span>
              <textarea rows={4} value={maintenanceMessage} onChange={(event) => setMaintenanceMessage(event.target.value)} />
            </label>
          </div>

          <div className="ti-actions">
            <button
              className={bool(maintenance.enabled) ? "secondary" : "danger"}
              onClick={() =>
                void runAction(async () => {
                  await updateSetting("maintenance", {
                    ...maintenance,
                    enabled: !bool(maintenance.enabled),
                  });
                  settings.reload();
                }, bool(maintenance.enabled) ? "Modo de manutenção desativado." : "Modo de manutenção ativado.")
              }
            >
              <Wrench size={17} />
              {bool(maintenance.enabled) ? "Desativar manutenção" : "Ativar manutenção"}
            </button>
            <button
              className="secondary"
              onClick={() =>
                void runAction(async () => {
                  await updateSetting("ti_site", {
                    ...site,
                    maintenance_title: maintenanceTitle,
                    maintenance_message: maintenanceMessage,
                  });
                  settings.reload();
                }, "Comunicação de manutenção atualizada.")
              }
            >
              Salvar texto
            </button>
          </div>
        </section>
      </div>

      <section className="panel ti-panel">
        <div className="ti-panel-heading">
          <div>
            <span className="ti-kicker">PLATAFORMA</span>
            <h2>Conexões administrativas</h2>
            <p>Essas integrações vão permitir gerenciar deploy, código, logs e comunicação sem sair da Central de T.I.</p>
          </div>
          <Settings2 size={25} />
        </div>
        <div className="ti-connection-list">
          <ConnectionRow
            icon={<GitBranch />}
            name="GitHub"
            detail={text(github.repository, "ConexaoStreet/rh-raizes-do-futuro")}
            status={statusLabel(github.status)}
          />
          <ConnectionRow
            icon={<Server />}
            name="Vercel"
            detail={text(vercel.production_url, "Produção")}
            status={statusLabel(vercel.status)}
          />
          <ConnectionRow
            icon={<Mail />}
            name="Comunicação T.I"
            detail="HTML institucional e alertas"
            status={statusLabel(email.status)}
          />
        </div>
      </section>
    </>
  );
}

function ServiceCard({
  icon,
  name,
  detail,
  status,
  tone,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  status: string;
  tone: "ok" | "warn" | "error";
}) {
  return (
    <div className="ti-service-card">
      <div className="ti-service-icon">{icon}</div>
      <div className="ti-service-copy">
        <strong>{name}</strong>
        <span>{detail}</span>
      </div>
      <span className={`ti-status ti-status-${tone}`}>
        {tone === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
        {status}
      </span>
    </div>
  );
}

function ConnectionRow({
  icon,
  name,
  detail,
  status,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  status: string;
}) {
  return (
    <div className="ti-connection-row">
      <div className="ti-service-icon">{icon}</div>
      <div>
        <strong>{name}</strong>
        <span>{detail}</span>
      </div>
      <span>{status}</span>
    </div>
  );
}
