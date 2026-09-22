import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Mail,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { client, configured, rpc, json, runAction, supabase } from "./api";
import { Brand, Field, Loading } from "./components";
import { errorMessage } from "./domain";
import { capture, captureError, setTelemetryUser } from "./telemetry";
import type { Row } from "./database.types";
export type Bootstrap = {
  profile: Row<"profiles">;
  roles: string[];
  permissions: string[];
  privileged: boolean;
  mfa_verified: boolean;
  recently_verified: boolean;
  ready: boolean;
  server_time: string;
  employee_id: string | null;
  maintenance: { enabled?: boolean; allow_managers?: boolean };
};
const AuthContext = createContext<{
  user: Bootstrap;
  session: Session;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
} | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AUTH_REQUIRED");
  return value;
}
export function AuthBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(configured);
  const [failed, setFailed] = useState(false);
  const [recovery, setRecovery] = useState(
    new URLSearchParams(location.search).get("flow") === "recovery",
  );
  const refresh = useCallback(async () => {
    if (!supabase) return;
    try {
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      setSession(current);
      if (current) {
        const data = await rpc("bootstrap", {});
        const nextUser = data as unknown as Bootstrap;
        setUser(nextUser);
        setTelemetryUser(current.user.id);
      } else {
        setUser(null);
        setTelemetryUser(null);
      }
      setFailed(false);
    } catch (error) {
      captureError("auth_bootstrap", error);
      setUser(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!supabase) return;
    void refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_OUT") setUser(null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setTimeout(() => void refresh(), 0);
    });
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      subscription.unsubscribe();
      clearInterval(timer);
    };
  }, [refresh]);
  if (loading)
    return (
      <div className="auth-loading">
        <Loading />
      </div>
    );
  if (!session) return <Login configured={configured} />;
  if (failed)
    return (
      <AuthFrame>
        <ShieldCheck size={36} />
        <h1>Acesso interrompido</h1>
        <p>Entre novamente para continuar.</p>
        <button
          className="primary"
          onClick={() => void client().auth.signOut()}
        >
          Voltar ao login
        </button>
      </AuthFrame>
    );
  if (!user) return <Loading />;
  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />;
  if (!user.profile.onboarded_at)
    return <Onboarding user={user} onDone={refresh} />;
  if (user.profile.status !== "active")
    return (
      <AuthFrame>
        <Mail size={36} />
        <h1>
          {user.profile.status === "pending"
            ? "Aguardando aprovação"
            : "Acesso indisponível"}
        </h1>
        <p>
          {user.profile.status === "pending"
            ? "Cadastro recebido. Seu acesso está aguardando liberação."
            : "Procure o responsável pelo RH."}
        </p>
        <button onClick={() => void client().auth.signOut()}>
          <LogOut size={18} /> Sair
        </button>
      </AuthFrame>
    );
  if (user.privileged && !user.mfa_verified)
    return <Verification onDone={refresh} />;
  if (!user.ready)
    return (
      <AuthFrame>
        <ShieldCheck size={36} />
        <h1>Sistema em manutenção</h1>
        <p>Voltaremos em breve.</p>
        <button onClick={() => void client().auth.signOut()}>Sair</button>
      </AuthFrame>
    );
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        refresh,
        can: (permission) => user.permissions.includes(permission),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <Brand />
        <div className="auth-wordmark" aria-label="Raízes do Futuro">
          <span className="auth-wordmark-line auth-wordmark-line-1">Raízes</span>
          <span className="auth-wordmark-line auth-wordmark-line-2">do</span>
          <span className="auth-wordmark-line auth-wordmark-line-3">Futuro</span>
        </div>
        <div className="auth-signature">RH · ANHANGUERA / ESPRO</div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
        <span className="auth-footer">Raízes do Futuro</span>
      </main>
    </div>
  );
}
function PasswordInput({
  name = "password",
  minLength = 12,
}: {
  name?: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input
        name={name}
        type={show ? "text" : "password"}
        autoComplete={name === "password" ? "current-password" : "new-password"}
        required
        minLength={minLength}
      />
      <button
        type="button"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="icon-button"
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    </div>
  );
}
function Login({ configured: ready }: { configured: boolean }) {
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const email = String(data.get("email")).trim();
      const password = String(data.get("password"));
      const redirect = new URL(import.meta.env.BASE_URL, location.origin).href;
      if (mode === "login") {
        const { error } = await client().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await rpc("authenticate_event", { action_name: "login" });
        capture("login_success");
      }
      if (mode === "signup") {
        if (password !== data.get("confirmation")) {
          toast.error("As senhas precisam ser iguais.");
          return;
        }
        const { error } = await client().auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(data.get("full_name")).trim() },
            emailRedirectTo: redirect,
          },
        });
        if (error) throw error;
        capture("signup_submitted");
        setSent(true);
      }
      if (mode === "recover") {
        const { error } = await client().auth.resetPasswordForEmail(email, {
          redirectTo: redirect + "?flow=recovery",
        });
        if (error) throw error;
        capture("password_recovery_requested");
        setSent(true);
      }
    } catch (error) {
      captureError(`auth_${mode}`, error);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <div className="eyebrow">SEU ESPAÇO NO RH</div>
      <h1>
        {mode === "signup"
          ? "Criar cadastro"
          : mode === "recover"
            ? "Recuperar acesso"
            : "Entrar"}
      </h1>
      {!ready && (
        <div className="notice">
          Acesso indisponível. Aguarde a liberação do sistema.
        </div>
      )}
      {sent ? (
        <div className="notice">Confira seu e-mail para continuar.</div>
      ) : (
        <form onSubmit={submit} className="form-stack">
          {mode === "signup" && (
            <Field label="Nome completo">
              <input
                name="full_name"
                autoComplete="name"
                required
                minLength={2}
              />
            </Field>
          )}
          <Field label="E-mail">
            <input name="email" type="email" autoComplete="email" required />
          </Field>
          {mode !== "recover" && (
            <Field label="Senha">
              <PasswordInput minLength={mode === "login" ? 1 : 12} />
            </Field>
          )}
          {mode === "signup" && (
            <>
              <Field label="Confirmar senha">
                <PasswordInput name="confirmation" />
              </Field>
              <span className="muted">Use pelo menos 12 caracteres.</span>
            </>
          )}
          {mode === "login" && (
            <button
              type="button"
              className="text-button forgot"
              onClick={() => setMode("recover")}
            >
              Esqueci minha senha
            </button>
          )}
          <button className="primary large" disabled={busy || !ready}>
            {busy
              ? "Aguarde..."
              : mode === "signup"
                ? "Criar cadastro"
                : mode === "recover"
                  ? "Enviar link"
                  : "Entrar"}
            <ArrowRight size={19} />
          </button>
        </form>
      )}
      <div className="auth-switch">
        {mode === "login" ? "Primeiro acesso? " : ""}
        <button
          className="text-button"
          onClick={() => {
            setSent(false);
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login" ? "Criar cadastro" : "Voltar ao login"}
        </button>
      </div>
    </AuthFrame>
  );
}
function Onboarding({
  user,
  onDone,
}: {
  user: Bootstrap;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame>
      <div className="eyebrow">PRIMEIRO ACESSO</div>
      <h1>Seu cadastro</h1>
      <div className="steps">
        <span className="done">1. Acesso</span>
        <span className="active">2. Perfil</span>
        <span>3. Aprovação</span>
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = new FormData(e.currentTarget);
          await runAction(async () => {
            await rpc("complete_profile", {
              payload: json({
                ...Object.fromEntries(form),
                terms: form.get("terms") === "on",
              }),
            });
            await onDone();
          });
          setBusy(false);
        }}
      >
        <Field label="Nome completo">
          <input
            name="full_name"
            defaultValue={user.profile.full_name}
            required
            minLength={2}
          />
        </Field>
        <Field label="Telefone">
          <input name="phone" type="tel" />
        </Field>
        <Field label="Matrícula">
          <input name="registration" required />
        </Field>
        <Field label="Turma">
          <input name="requested_class" required />
        </Field>
        <details className="privacy">
          <summary>Uso dos seus dados</summary>
          <p>
            Seu cadastro, presença, documentos e avaliações são usados pelo RH
            para acompanhamento e gestão. Seu acesso fica restrito aos seus
            registros. Gestores autorizados consultam os dados necessários ao
            trabalho. Avaliações da gestão são apresentadas em grupos, sem
            autoria. Para corrigir seus dados, procure o RH.
          </p>
        </details>
        <label className="check">
          <input type="checkbox" name="terms" required />
          Li e aceito o uso dos dados para a gestão do RH.
        </label>
        <button className="primary" disabled={busy}>
          Concluir cadastro
        </button>
      </form>
    </AuthFrame>
  );
}
export function Verification({ onDone, onCancel }: { onDone: () => Promise<void>; onCancel?: () => void }) {
  const [sent, setSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  async function invoke(body: { action: string; code?: string }) {
    const { data, error } = await client().functions.invoke("email-2fa", {
      body,
    });
    if (error) {
      let message = "Não foi possível enviar. Tente novamente.";
      if ("context" in error && error.context instanceof Response) {
        const detail = (await error.context.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (detail?.error === "INVALID_CODE")
          message = "Código inválido ou expirado.";
        if (detail?.error === "RATE_LIMITED")
          message = "Aguarde antes de tentar novamente.";
        if (detail?.error === "PASSWORD_LOGIN_REQUIRED")
          message = "Entre novamente com e-mail e senha.";
      }
      throw new Error(message);
    }
    return data as { masked_email: string };
  }
  return (
    <AuthFrame>
      <div className="security-icon">
        <ShieldCheck size={28} />
      </div>
      <h1>Verificação de segurança</h1>
      {sent ? (
        <p>Enviamos um código de 6 dígitos para {email}.</p>
      ) : (
        <p>Confirme o acesso pelo seu e-mail.</p>
      )}
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const code = String(new FormData(e.currentTarget).get("code"));
            await invoke({ action: "verify", code });
            capture("security_verification_success");
            await onDone();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {sent && (
          <>
            <Field label="Código">
              <input
                className="otp-input"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                autoFocus
              />
            </Field>
            <button className="primary" disabled={busy}>
              Verificar
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy || seconds > 0}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await invoke({ action: "send" });
              capture("security_code_requested");
              setEmail(result.masked_email);
              setSent(true);
              setSeconds(60);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {seconds > 0
            ? `Reenviar em ${seconds}s`
            : sent
              ? "Reenviar código"
              : "Enviar código"}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            if (onCancel) onCancel();
            else void client().auth.signOut();
          }}
        >
          {onCancel ? "Cancelar" : "Voltar ao login"}
        </button>
      </form>
    </AuthFrame>
  );
}
function ResetPassword({ onDone }: { onDone: () => void }) {
  return (
    <AuthFrame>
      <h1>Nova senha</h1>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          if (data.get("password") !== data.get("confirmation")) {
            toast.error("As senhas precisam ser iguais.");
            return;
          }
          await runAction(async () => {
            const { error } = await client().auth.updateUser({
              password: String(data.get("password")),
            });
            if (error) throw error;
            await client().auth.signOut({ scope: "global" });
            history.replaceState(null, "", location.pathname);
            onDone();
          }, "Senha atualizada. Entre novamente.");
        }}
      >
        <Field label="Nova senha">
          <PasswordInput />
        </Field>
        <Field label="Confirmar senha">
          <PasswordInput name="confirmation" />
        </Field>
        <button className="primary">Salvar senha</button>
      </form>
    </AuthFrame>
  );
}
