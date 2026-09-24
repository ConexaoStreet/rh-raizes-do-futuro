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
import { Eye, EyeOff, KeyRound, LogOut, Mail, ShieldCheck } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<"password" | "code">("password");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);

      if (loginMode === "code") {
        const code = String(form.get("access_code") || "").trim();
        const { data: claim, error: claimError } =
          await client().functions.invoke("ti-code-login", {
            body: { action: "login", code },
          });

        if (claimError) throw claimError;

        const result = claim as {
          token_hash?: string;
          code_id?: string;
          claim_token?: string;
          error?: string;
        };

        if (!result.token_hash || !result.code_id || !result.claim_token)
          throw new Error(result.error || "INVALID_CODE");

        const { data: verified, error: verifyError } =
          await client().auth.verifyOtp({
            token_hash: result.token_hash,
            type: "email",
          });

        if (verifyError || !verified.session)
          throw verifyError || new Error("SESSION_UNAVAILABLE");

        const { data: confirmed, error: confirmError } =
          await client().functions.invoke("ti-code-login", {
            body: {
              action: "confirm",
              code_id: result.code_id,
              claim_token: result.claim_token,
            },
            headers: {
              Authorization: `Bearer ${verified.session.access_token}`,
            },
          });

        if (
          confirmError ||
          !(confirmed as { ok?: boolean } | null)?.ok
        ) {
          await client().auth.signOut();
          throw confirmError || new Error("CONFIRM_FAILED");
        }

        return;
      }

      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const { error: signInError } = await client().auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "ACCESS_FAILED";
      setError(
        loginMode === "code"
          ? message.includes("RATE_LIMITED")
            ? "Muitas tentativas. Aguarde alguns minutos."
            : "Código inválido, expirado ou já utilizado."
          : "E-mail ou senha inválidos.",
      );
    } finally {
      setBusy(false);
    }
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
          <div className="login-mode-switch" role="tablist" aria-label="Forma de acesso">
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === "password"}
              className={loginMode === "password" ? "active" : ""}
              onClick={() => {
                setLoginMode("password");
                setError("");
              }}
            >
              Senha
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === "code"}
              className={loginMode === "code" ? "active" : ""}
              onClick={() => {
                setLoginMode("code");
                setError("");
              }}
            >
              Código de acesso
            </button>
          </div>
          <form onSubmit={submit}>
            {loginMode === "password" ? (
              <>
                <label>
                  <span>E-mail</span>
                  <input name="email" type="email" autoComplete="email" required />
                </label>
                <label>
                  <span>Senha</span>
                  <div className="password-field">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <button
                  type="button"
                  className="text-button forgot-password"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const emailInput = document.querySelector<HTMLInputElement>(
                        'input[name="email"]',
                      );
                      const email = emailInput?.value.trim() || "";
                      if (!email) {
                        setError("Digite seu e-mail primeiro.");
                        return;
                      }
                      const redirectTo =
                        new URL("/", window.location.origin).href;
                      const { error: resetError } =
                        await client().auth.resetPasswordForEmail(email, {
                          redirectTo,
                        });
                      if (resetError) throw resetError;
                      setError("Enviamos o link de redefinição para o seu e-mail.");
                    } catch {
                      setError("Não foi possível enviar a recuperação de senha.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Esqueci minha senha
                </button>
              </>
            ) : (
              <label>
                <span>Código semanal</span>
                <input
                  className="weekly-access-code"
                  name="access_code"
                  inputMode="text"
                  autoComplete="one-time-code"
                  placeholder="RFXX-XXXX-XXXX-XXXX-XXXX-XX"
                  minLength={22}
                  maxLength={27}
                  required
                />
                <small>
                  Cada código funciona uma única vez e é substituído toda terça-feira.
                </small>
              </label>
            )}
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>
              <KeyRound size={18} />
              {busy
                ? "Validando..."
                : loginMode === "code"
                  ? "Entrar com código"
                  : "Entrar"}
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
      {error && <div className="form-error" role="alert">{error}</div>}
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
    <div className="splash" role="status" aria-live="polite">
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
