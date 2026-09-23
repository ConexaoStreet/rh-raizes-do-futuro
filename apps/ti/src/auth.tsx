import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, LogOut, Mail, ShieldCheck } from "lucide-react";
import { client, configured, rpc, supabase } from "./api";
import { ThemeToggle } from "./theme";

type Bootstrap = {
  profile: {
    id: string;
    full_name: string;
    email: string;
    status: string;
    onboarded_at: string | null;
  };
  roles: string[];
  permissions: string[];
  privileged: boolean;
  mfa_verified: boolean;
  ready: boolean;
  maintenance: { enabled?: boolean; allow_managers?: boolean };
};

type AuthValue = {
  session: Session;
  user: Bootstrap;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
};

const Context = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AUTH_REQUIRED");
  return value;
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      setSession(current);
      if (!current) {
        setUser(null);
        return;
      }
      const next = (await rpc("bootstrap")) as Bootstrap;
      setUser(next);
      setFailed("");
    } catch {
      setFailed("Não foi possível validar esta sessão.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_OUT") setUser(null);
      setTimeout(() => void refresh(), 0);
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  if (loading) return <Splash label="Validando acesso técnico..." />;
  if (!configured)
    return (
      <AccessFrame>
        <ShieldCheck size={34} />
        <h1>Configuração necessária</h1>
        <p>Conecte este frontend ao projeto Supabase do Raízes do Futuro.</p>
      </AccessFrame>
    );
  if (!session) return <Login />;
  if (failed)
    return (
      <AccessFrame>
        <ShieldCheck size={34} />
        <h1>Sessão interrompida</h1>
        <p>{failed}</p>
        <button onClick={() => void client().auth.signOut()}>Voltar ao login</button>
      </AccessFrame>
    );
  if (!user) return <Splash label="Carregando permissões..." />;
  if (!user.profile.onboarded_at || user.profile.status !== "active")
    return (
      <AccessFrame>
        <Mail size={34} />
        <h1>Acesso técnico indisponível</h1>
        <p>Conclua e valide seu cadastro pelo sistema de RH antes de usar a Central de T.I.</p>
        <button onClick={() => void client().auth.signOut()}>
          <LogOut size={17} />
          Sair
        </button>
      </AccessFrame>
    );
  if (user.privileged && !user.mfa_verified)
    return <Verification onDone={refresh} />;
  if (!user.permissions.includes("ti.view"))
    return (
      <AccessFrame>
        <ShieldCheck size={34} />
        <h1>Sem permissão de T.I</h1>
        <p>Esta conta não possui acesso à administração técnica do Raízes do Futuro.</p>
        <button onClick={() => void client().auth.signOut()}>
          <LogOut size={17} />
          Sair
        </button>
      </AccessFrame>
    );
  if (!user.ready)
    return (
      <AccessFrame>
        <ShieldCheck size={34} />
        <h1>Acesso indisponível</h1>
        <p>A sessão não atende aos requisitos de segurança atuais.</p>
        <button onClick={() => void client().auth.signOut()}>Sair</button>
      </AccessFrame>
    );

  return (
    <Context.Provider
      value={{
        session,
        user,
        refresh,
        can: (permission) => user.permissions.includes(permission),
      }}
    >
      {children}
    </Context.Provider>
  );
}

function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const { error: signInError } = await client().auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) setError("E-mail ou senha inválidos.");
    setBusy(false);
  }

  return (
    <div className="login-page">
      <div className="login-theme-control"><ThemeToggle compact /></div>
      <section className="login-brand">
        <Brand />
        <div className="login-brand-copy">
          <span>CONTROLE TÉCNICO</span>
          <h1>T.I Raízes do Futuro</h1>
          <p>Administração, integrações, segurança, deploys e operação técnica em um ambiente separado do RH.</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="security-badge"><ShieldCheck size={22} /></div>
          <span className="eyebrow">ACESSO RESTRITO</span>
          <h2>Entrar na Central de T.I</h2>
          <p>Use a mesma conta administrativa do Raízes do Futuro.</p>
          <form onSubmit={submit}>
            <label>
              <span>E-mail</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>Senha</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={busy}>
              <KeyRound size={18} />
              {busy ? "Validando..." : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Verification({ onDone }: { onDone: () => Promise<void> }) {
  const [sent, setSent] = useState(false);
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function invoke(body: Record<string, string>) {
    const { data, error: functionError } = await client().functions.invoke("email-2fa", { body });
    if (functionError) throw functionError;
    return data as { masked_email?: string };
  }

  return (
    <AccessFrame>
      <ShieldCheck size={34} />
      <span className="eyebrow">SEGURANÇA</span>
      <h1>Verificação em duas etapas</h1>
      <p>{sent ? `Enviamos um código para ${masked}.` : "Confirme sua identidade para abrir a Central de T.I."}</p>
      {error && <div className="form-error">{error}</div>}
      {sent && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const code = String(new FormData(event.currentTarget).get("code") || "");
              await invoke({ action: "verify", code });
              await onDone();
            } catch {
              setError("Código inválido ou expirado.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            className="otp"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            placeholder="000000"
            required
          />
          <button className="primary-button" disabled={busy}>Verificar código</button>
        </form>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await invoke({ action: "send" });
            setMasked(result.masked_email || "seu e-mail");
            setSent(true);
          } catch {
            setError("Não foi possível enviar o código.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {sent ? "Reenviar código" : "Enviar código"}
      </button>
      <button className="text-button" onClick={() => void client().auth.signOut()}>Voltar ao login</button>
    </AccessFrame>
  );
}

function AccessFrame({ children }: { children: ReactNode }) {
  return (
    <div className="access-page">
      <div className="access-theme-control"><ThemeToggle compact /></div>
      <div className="access-card">
        <Brand />
        {children}
      </div>
    </div>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <div className="splash">
      <Brand compact />
      <div className="loader" />
      <span>{label}</span>
    </div>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  const rhSite = import.meta.env.VITE_RH_SITE_URL || "https://rh-raizes-do-futuro.vercel.app";
  return (
    <div className={compact ? "brand compact" : "brand"}>
      <img src={`${rhSite}/brand/raizes-logo-mark.png`} alt="" />
      <div>
        <strong>T.I</strong>
        <span>Raízes do Futuro</span>
      </div>
    </div>
  );
}
