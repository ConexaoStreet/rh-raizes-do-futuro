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
import { LoginMascot } from "./LoginMascot";

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
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [secureTransition, setSecureTransition] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const {
        data: { session: current },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      setSession(current);

      if (!current) {
        setUser(null);
        setFailed("");
        return;
      }

      const {
        data: { user: verifiedUser },
        error: userError,
      } = await supabase.auth.getUser(current.access_token);

      if (userError || !verifiedUser)
        throw userError || new Error("SESSION_INVALID");

      const next = (await rpc("bootstrap")) as Bootstrap;
      setUser(next);
      setFailed("");
    } catch {
      setFailed("Não foi possível validar esta sessão com segurança.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);

      if (event === "PASSWORD_RECOVERY") {
        setRecoveringPassword(true);
        setSecureTransition(false);
        setUser(null);
        setFailed("");
        setLoading(false);
        return;
      }

      if (event === "SIGNED_OUT") {
        setRecoveringPassword(false);
        setSecureTransition(false);
        setUser(null);
        setFailed("");
        setLoading(false);
        return;
      }

      window.setTimeout(() => void refresh(), 0);
    });

    void refresh();
    return () => subscription.unsubscribe();
  }, [refresh]);

  if (loading || secureTransition)
    return (
      <Splash
        label={
          secureTransition
            ? "Concluindo autenticação protegida..."
            : "Validando acesso técnico..."
        }
      />
    );

  if (!configured)
    return (
      <AccessFrame>
        <ShieldCheck size={34} />
        <span className="eyebrow">CONFIGURAÇÃO</span>
        <h1>Configuração necessária</h1>
        <p>Conecte este frontend ao projeto Supabase do Raízes do Futuro.</p>
      </AccessFrame>
    );

  if (recoveringPassword && session)
    return (
      <PasswordRecovery
        onComplete={() => {
          setRecoveringPassword(false);
          setUser(null);
          setSession(null);
        }}
      />
    );

  if (!session)
    return (
      <Login
        onAuthenticated={refresh}
        onSecureTransition={setSecureTransition}
      />
    );

  if (failed)
    return (
      <AccessFrame>
        <ShieldCheck size={34} />
        <span className="eyebrow">SESSÃO</span>
        <h1>Sessão interrompida</h1>
        <p>{failed}</p>
        <button
          className="primary-button"
          onClick={() => void client().auth.signOut()}
        >
          Voltar ao login
        </button>
      </AccessFrame>
    );

  if (!user) return <Splash label="Carregando permissões..." />;

  if (!user.profile.onboarded_at || user.profile.status !== "active")
    return (
      <AccessFrame>
        <Mail size={34} />
        <span className="eyebrow">CONTA</span>
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
        <span className="eyebrow">PERMISSÕES</span>
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
        <span className="eyebrow">SEGURANÇA</span>
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

function Login({
  onAuthenticated,
  onSecureTransition,
}: {
  onAuthenticated: () => Promise<void>;
  onSecureTransition: (active: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<"password" | "code">("password");
  const [mascotMood, setMascotMood] = useState<"idle" | "email" | "password" | "peek" | "code" | "error" | "success">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");

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

        onSecureTransition(true);

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

        if (confirmError || !(confirmed as { ok?: boolean } | null)?.ok) {
          await client().auth.signOut();
          throw confirmError || new Error("CONFIRM_FAILED");
        }

        await onAuthenticated();
        onSecureTransition(false);
        return;
      }

      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const { error: signInError } = await client().auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      await onAuthenticated();
    } catch (caught) {
      onSecureTransition(false);
      const message =
        caught instanceof Error ? caught.message : "ACCESS_FAILED";

      setError(
        loginMode === "code"
          ? message.includes("RATE_LIMITED")
            ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
            : "Código inválido, expirado ou já utilizado."
          : "E-mail ou senha inválidos.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    setBusy(true);
    setError("");
    setStatus("");

    try {
      const emailInput = document.querySelector<HTMLInputElement>(
        'input[name="email"]',
      );
      const email = emailInput?.value.trim() || "";

      if (!email) {
        setError("Digite seu e-mail primeiro.");
        return;
      }

      const redirectTo = new URL("/", window.location.origin).href;
      const { error: resetError } =
        await client().auth.resetPasswordForEmail(email, { redirectTo });

      if (resetError) throw resetError;
      setStatus(
        "Link de redefinição enviado. Abra o e-mail para concluir a alteração.",
      );
    } catch {
      setError("Não foi possível enviar a recuperação de senha.");
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
          <span>RAÍZES DO FUTURO · OPERAÇÃO DIGITAL</span>
          <h1>Central de T.I.</h1>
          <p>
            Administração, integrações, segurança, deploys e operação técnica
            em um ambiente separado do RH.
          </p>
          <div className="login-trust-row">
            <span><ShieldCheck size={15} /> MFA obrigatório</span>
            <span><ShieldCheck size={15} /> Acesso auditado</span>
            <span><ShieldCheck size={15} /> Sessão protegida</span>
          </div>
        </div>
        <div className="login-brand-foot">
          Ambiente administrativo reservado a pessoas autorizadas.
        </div>
      </section>

      <section className="login-panel">
        <div className="login-stage">
          <LoginMascot mood={mascotMood} />
        <div className="login-card">
          <div className="security-badge"><ShieldCheck size={22} /></div>
          <span className="eyebrow">ACESSO RESTRITO</span>
          <h2>Entrar na Central de T.I</h2>
          <p>Use sua conta administrativa ou um código semanal autorizado.</p>

          <div className="login-mode-switch" role="tablist" aria-label="Forma de acesso">
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === "password"}
              className={loginMode === "password" ? "active" : ""}
              onClick={() => {
                setLoginMode("password");
                setError("");
                setStatus("");
              }}
            >
              E-mail e senha
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === "code"}
              className={loginMode === "code" ? "active" : ""}
              onClick={() => {
                setLoginMode("code");
                setError("");
                setStatus("");
              }}
            >
              Código semanal
            </button>
          </div>

          <form onSubmit={submit}>
            {loginMode === "password" ? (
              <>
                <label>
                  <span>E-mail</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nome@empresa.com.br"
                    onFocus={() => setMascotMood("email")}
                    onBlur={() => setMascotMood("idle")}
                    required
                  />
                </label>
                <label>
                  <span>Senha</span>
                  <div className="password-field">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Sua senha"
                      onFocus={() => setMascotMood(showPassword ? "peek" : "password")}
                      onBlur={() => setMascotMood("idle")}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => { const next = !current; setMascotMood(next ? "peek" : "password"); return next; })}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <button
                  type="button"
                  className="text-button forgot-password"
                  disabled={busy}
                  onClick={() => void requestPasswordReset()}
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
                  onFocus={() => setMascotMood("code")}
                  onBlur={() => setMascotMood("idle")}
                  inputMode="text"
                  autoComplete="one-time-code"
                  placeholder="RFXX-XXXX-XXXX-XXXX-XXXX-XX"
                  minLength={22}
                  maxLength={27}
                  required
                />
                <small>
                  Uso único. A confirmação cria uma sessão técnica verificada e auditada.
                </small>
              </label>
            )}

            {error && <div className="form-error" role="alert">{error}</div>}
            {status && <div className="form-success" role="status">{status}</div>}

            <button className="primary-button login-submit" disabled={busy}>
              <KeyRound size={18} />
              {busy
                ? "Validando..."
                : loginMode === "code"
                  ? "Entrar com código"
                  : "Entrar com segurança"}
            </button>
          </form>

          <div className="login-card-foot">
            <ShieldCheck size={14} />
            <span>
              Permissões e sessão são verificadas novamente antes de abrir o console.
            </span>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}

function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AccessFrame>
      <KeyRound size={34} />
      <span className="eyebrow">RECUPERAÇÃO SEGURA</span>
      <h1>Crie uma nova senha</h1>
      <p>
        Depois da alteração, a sessão de recuperação será encerrada e você
        entrará novamente pela Central de T.I.
      </p>

      <form
        className="recovery-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");

          try {
            const form = new FormData(event.currentTarget);
            const password = String(form.get("password") || "");
            const confirmPassword = String(form.get("confirm_password") || "");

            if (password.length < 8) {
              setError("Use uma senha com pelo menos 8 caracteres.");
              return;
            }

            if (password !== confirmPassword) {
              setError("As senhas não são iguais.");
              return;
            }

            const { error: updateError } =
              await client().auth.updateUser({ password });

            if (updateError) throw updateError;

            await client().auth.signOut({ scope: "local" });
            onComplete();
          } catch {
            setError("Não foi possível alterar a senha. Solicite um novo link.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="recovery-field">
          <span>Nova senha</span>
          <div className="password-field">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <label className="recovery-field">
          <span>Confirmar nova senha</span>
          <input
            name="confirm_password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        {error && <div className="form-error" role="alert">{error}</div>}

        <button className="primary-button" disabled={busy}>
          <KeyRound size={17} />
          {busy ? "Atualizando..." : "Salvar nova senha"}
        </button>
      </form>
    </AccessFrame>
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
