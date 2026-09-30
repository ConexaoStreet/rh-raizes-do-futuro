import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ChangeEventHandler,
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
  Sparkles,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { client, configured, rpc, json, runAction, supabase } from "./api";
import { Brand, Field, Loading } from "./components";
import { errorMessage } from "./domain";
import { capture, captureError, setTelemetryUser } from "./telemetry";
import { shouldRefreshExpiredJwt } from "./auth-errors";
import { ThemeToggle } from "./theme";
import { LoginMascot, type MascotMood } from "./LoginMascot";
import { PASSWORD_POLICY_MESSAGE, strongPassword } from "./password-policy";
import type { Row } from "./database.types";
export type Bootstrap = {
  profile: Row<"profiles">;
  roles: string[];
  permissions: string[];
  privileged: boolean;
  mfa_verified: boolean;
  mfa_required: boolean;
  recently_verified: boolean;
  ready: boolean;
  server_time: string;
  employee_id: string | null;
  maintenance: { enabled?: boolean; allow_managers?: boolean; title?: string; message?: string; started_at?: string | null };
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
        let activeSession = current;
        let data: Awaited<ReturnType<typeof rpc<"bootstrap">>>;
        try {
          data = await rpc("bootstrap", {});
        } catch (error) {
          if (!shouldRefreshExpiredJwt(error)) throw error;
          const { data: refreshed, error: refreshError } =
            await supabase.auth.refreshSession();
          if (refreshError || !refreshed.session) throw refreshError || error;
          activeSession = refreshed.session;
          setSession(activeSession);
          data = await rpc("bootstrap", {});
        }
        const nextUser = data as unknown as Bootstrap;
        setUser(nextUser);
        setTelemetryUser(activeSession.user.id);
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
  if (user.mfa_required && !user.mfa_verified)
    return <Verification onDone={refresh} />;
  if (!user.ready && user.maintenance.enabled)
    return (
      <AuthFrame>
        <ShieldCheck size={36} />
        <h1>{user.maintenance.title || "Sistema em manutenção"}</h1>
        <p>{user.maintenance.message || "Estamos realizando ajustes no sistema. O acesso será liberado novamente assim que a manutenção for concluída."}</p>
        <button onClick={() => void client().auth.signOut()}>Sair</button>
      </AuthFrame>
    );
  if (!user.ready)
    return (
      <AuthFrame>
        <ShieldCheck size={36} />
        <h1>Acesso ainda não concluído</h1>
        <p>Seu cadastro está ativo, mas ainda existe uma etapa de acesso pendente. Entre novamente ou conclua o primeiro acesso.</p>
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
      <div className="auth-theme-control"><ThemeToggle compact /></div>
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
  autoComplete = "current-password",
  value,
  onChange,
}: {
  name?: string;
  minLength?: number;
  autoComplete?: "current-password" | "new-password";
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        value={value}
        onChange={onChange}
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
type RegistrationOptions = {
  class: { id: string; name: string; code: string } | null;
  departments: { id: string; name: string }[];
  roles: { code: string; name: string }[];
};
type PreRegistrationMatch = {
  matched: boolean;
  canonical_name?: string;
  suggestions?: string[];
  reason?: string;
};

function useRegistrationOptions() {
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  useEffect(() => {
    if (!configured) return;
    let active = true;
    void client()
      .functions.invoke("registration-bootstrap", { body: { action: "options" } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setOptions(data as RegistrationOptions);
      })
      .catch((error) => captureError("registration_options", error));
    return () => {
      active = false;
    };
  }, []);
  return options;
}

function usePreRegistrationMatch(name: string) {
  const [result, setResult] = useState<PreRegistrationMatch | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const clean = name.trim();
    setResult(null);
    if (!configured) {
      setChecking(false);
      return;
    }
    if (clean.length < 4) {
      setResult(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const timer = window.setTimeout(() => {
      void client()
        .functions.invoke("registration-bootstrap", {
          body: { action: "match", full_name: clean },
        })
        .then(({ data, error }) => {
          if (error) throw error;
          setResult(data as PreRegistrationMatch);
        })
        .catch((error) => {
          captureError("pre_registration_match", error);
          setResult(null);
        })
        .finally(() => setChecking(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [name]);
  return { result, checking };
}

function Login({ configured: ready }: { configured: boolean }) {
  const [mode, setMode] = useState<"login" | "signup" | "recover" | "manager">("login");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [signupDraft, setSignupDraft] = useState({
    email: "",
    phone: "",
    password: "",
    confirmation: "",
    departmentId: "",
  });
  const [mascotMood, setMascotMood] = useState<MascotMood>("idle");
  const options = useRegistrationOptions();
  const nameMatch = usePreRegistrationMatch(mode === "signup" ? signupName : "");

  function changeMode(next: "login" | "signup" | "recover") {
    setSent(false);
    setVerificationEmail("");
    setMascotMood("idle");
    setSignupStep(1);
    setSignupDraft({
      email: "",
      phone: "",
      password: "",
      confirmation: "",
      departmentId: "",
      });
    setMode(next);
  }

  function continueSignupIdentity() {
    const email = signupDraft.email.trim().toLowerCase();
    if (!nameMatch.result?.matched) {
      toast.error("Localize e selecione seu nome na lista de pré-cadastros.");
      setMascotMood("error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
      toast.error("Use um endereço de e-mail válido.");
      setMascotMood("error");
      return;
    }
    if (signupDraft.phone.trim().length < 8) {
      toast.error("Informe um número de telefone válido.");
      setMascotMood("error");
      return;
    }
    setMascotMood("idle");
    setSignupStep(2);
  }

  function continueSignupCredentials() {
    if (!strongPassword(signupDraft.password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      setMascotMood("error");
      return;
    }
    if (signupDraft.password !== signupDraft.confirmation) {
      toast.error("As senhas precisam ser iguais.");
      setMascotMood("error");
      return;
    }
    setMascotMood("idle");
    setSignupStep(3);
  }

  async function resendVerification() {
    if (!verificationEmail) return;
    setBusy(true);
    setMascotMood("email");
    try {
      const redirect = new URL(import.meta.env.BASE_URL, location.origin).href;
      const { error } = await client().auth.resend({
        type: "signup",
        email: verificationEmail,
        options: { emailRedirectTo: redirect },
      });
      if (error) throw error;
      setMascotMood("success");
      toast.success("E-mail de verificação reenviado.");
    } catch (error) {
      setMascotMood("error");
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setMascotMood("work");
    const data = new FormData(event.currentTarget);
    try {
      const email =
        mode === "signup"
          ? signupDraft.email.trim().toLowerCase()
          : String(data.get("email")).trim().toLowerCase();
      const password =
        mode === "signup" ? signupDraft.password : String(data.get("password"));
      const redirect = new URL(import.meta.env.BASE_URL, location.origin).href;

      if (mode === "login") {
        const { error } = await client().auth.signInWithPassword({ email, password });
        if (error) {
          if (/email not confirmed/i.test(error.message)) {
            setVerificationEmail(email);
            setSent(true);
            setMascotMood("email");
            return;
          }
          throw error;
        }
        await rpc("authenticate_event", { action_name: "login" });
        capture("login_success");
        setMascotMood("success");
      }

      if (mode === "signup") {
        const phone = signupDraft.phone.trim();
        const departmentId = signupDraft.departmentId.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
          toast.error("Use um endereço de e-mail válido.");
          setMascotMood("error");
          return;
        }
        if (!nameMatch.result?.matched) {
          toast.error("Localize e selecione seu nome na lista de pré-cadastros.");
          setMascotMood("error");
          return;
        }
        if (phone.length < 8) {
          toast.error("Informe um número de telefone válido.");
          setMascotMood("error");
          return;
        }
        if (!departmentId) {
          toast.error("Selecione seu departamento.");
          setMascotMood("error");
          return;
        }
        if (!strongPassword(password)) {
          toast.error(PASSWORD_POLICY_MESSAGE);
          setMascotMood("error");
          return;
        }
        if (password !== signupDraft.confirmation) {
          toast.error("As senhas precisam ser iguais.");
          setMascotMood("error");
          return;
        }

        const { error } = await client().auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: nameMatch.result.canonical_name || signupName.trim(),
              phone,
              requested_department_id: departmentId,
            },
            emailRedirectTo: redirect,
          },
        });
        if (error) throw error;
        capture("signup_submitted");
        setVerificationEmail(email);
        setSent(true);
        setMascotMood("success");
      }

      if (mode === "recover") {
        const { error } = await client().auth.resetPasswordForEmail(email, {
          redirectTo: redirect + "?flow=recovery",
        });
        if (error) throw error;
        capture("password_recovery_requested");
        setSent(true);
        setMascotMood("success");
      }
    } catch (error) {
      captureError(`auth_${mode}`, error);
      setMascotMood("error");
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "manager") {
    return (
      <ManagerActivation
        configured={ready}
        onBack={() => {
          setSent(false);
          setMascotMood("idle");
          setMode("login");
        }}
      />
    );
  }

  const eyebrow =
    mode === "signup"
      ? "PRIMEIRO ACESSO"
      : mode === "recover"
        ? "RECUPERAÇÃO SEGURA"
        : "ACESSO AO RH";
  const heading =
    mode === "signup"
      ? "Ativar meu cadastro"
      : mode === "recover"
        ? "Recuperar acesso"
        : "Entrar no RH";
  const description =
    mode === "signup"
      ? "Confirme seu cadastro pré-existente para liberar seu acesso."
      : mode === "recover"
        ? "Informe seu e-mail para receber um link seguro de redefinição."
        : "Use seu e-mail e senha para acessar o ambiente de gestão de RH.";

  return (
    <div className="login-page">
      <div className="login-theme-control">
        <ThemeToggle compact />
      </div>

      <section className="login-brand">
        <Brand />
        <div className="login-brand-copy">
          <span>RAÍZES DO FUTURO · GESTÃO DE PESSOAS</span>
          <h1>Gestão de RH.</h1>
          <p>
            Presença, desenvolvimento, feedbacks, avaliações e acompanhamento
            da turma em um ambiente único.
          </p>
        </div>
        <div className="login-brand-foot">RH · ANHANGUERA / ESPRO</div>
      </section>

      <section className="login-panel">
        <div className="login-stage">
          <LoginMascot
            mood={mascotMood}
            placement="login"
            scopeSelector=".login-stage"
          />

          <div className={`login-card ${mode === "signup" ? "login-card-wide" : ""}`}>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{heading}</h2>
            <p>{description}</p>

            {mode !== "recover" && (
              <div className="login-mode-switch" role="group" aria-label="Forma de acesso">
                <button
                  type="button"
                  aria-pressed={mode === "login"}
                  className={mode === "login" ? "active" : ""}
                  onClick={() => changeMode("login")}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "signup"}
                  className={mode === "signup" ? "active" : ""}
                  onClick={() => changeMode("signup")}
                >
                  Ativar cadastro
                </button>
              </div>
            )}

            {!ready && (
              <div className="notice">
                Acesso indisponível. Aguarde a liberação do sistema.
              </div>
            )}

            {sent ? (
              <div className="form-stack login-result">
                <div className="notice">
                  {mode === "recover"
                    ? "Confira seu e-mail para redefinir a senha."
                    : "Confira seu e-mail e abra o link de verificação. Depois entre com seu e-mail e senha."}
                </div>
                {verificationEmail && mode !== "recover" && (
                  <button type="button" disabled={busy} onClick={() => void resendVerification()}>
                    Reenviar verificação
                  </button>
                )}
                <button type="button" className="text-button" onClick={() => changeMode("login")}>
                  Voltar ao login
                </button>
              </div>
            ) : mode === "signup" ? (
              <form
                onSubmit={submit}
                className="form-stack rh-login-form signup-flow"
                aria-label={`Etapa ${signupStep} de 3 do primeiro acesso`}
              >
                <div className="steps" aria-label="Etapas do primeiro acesso">
                  <span className={signupStep === 1 ? "active" : signupStep > 1 ? "done" : ""}>
                    1. Identidade
                  </span>
                  <span className={signupStep === 2 ? "active" : signupStep > 2 ? "done" : ""}>
                    2. Credenciais
                  </span>
                  <span className={signupStep === 3 ? "active" : ""}>
                    3. Vínculo
                  </span>
                </div>

                {signupStep === 1 && (
                  <>
                    <Field label="Nome completo">
                      <input
                        name="full_name"
                        autoComplete="name"
                        value={signupName}
                        onChange={(event) => setSignupName(event.target.value)}
                        required
                        minLength={4}
                        autoFocus
                      />
                    </Field>
                    {nameMatch.checking ? (
                      <span className="muted">Procurando seu cadastro...</span>
                    ) : nameMatch.result?.matched ? (
                      <div className="notice">
                        Cadastro localizado: <strong>{nameMatch.result.canonical_name}</strong>
                      </div>
                    ) : nameMatch.result?.reason === "ALREADY_REGISTERED" ? (
                      <div className="notice">
                        <strong>Este cadastro já foi ativado.</strong>
                        <div className="actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => changeMode("login")}
                          >
                            Ir para o login
                          </button>
                        </div>
                      </div>
                    ) : nameMatch.result?.suggestions?.length ? (
                      <div className="notice">
                        <strong>Selecione seu cadastro:</strong>
                        <select
                          value=""
                          aria-label="Cadastros encontrados"
                          onChange={(event) => {
                            if (!event.target.value) return;
                            setSignupName(event.target.value);
                            setMascotMood("idle");
                          }}
                        >
                          <option value="">Escolher nome</option>
                          {nameMatch.result.suggestions.map((candidate) => (
                            <option key={candidate} value={candidate}>
                              {candidate}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : signupName.trim().length >= 4 ? (
                      <span className="muted">
                        Nenhum pré-cadastro parecido foi encontrado.
                      </span>
                    ) : (
                      <span className="muted">
                        Digite pelo menos 4 letras do seu nome para localizar seu cadastro.
                      </span>
                    )}
                    <Field label="E-mail">
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="seu@email.com"
                        value={signupDraft.email}
                        onChange={(event) =>
                          setSignupDraft((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        required
                      />
                    </Field>
                    <Field label="Telefone">
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={signupDraft.phone}
                        onChange={(event) =>
                          setSignupDraft((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        required
                        minLength={8}
                      />
                    </Field>
                    <button
                      type="button"
                      className="primary large"
                      disabled={nameMatch.checking || !ready}
                      onClick={continueSignupIdentity}
                    >
                      Continuar para credenciais
                      <ArrowRight size={18} />
                    </button>
                  </>
                )}

                {signupStep === 2 && (
                  <>
                    <span className="muted">
                      Crie uma senha exclusiva para seu acesso ao RH.
                    </span>
                    <Field label="Senha">
                      <PasswordInput
                        autoComplete="new-password"
                        value={signupDraft.password}
                        onChange={(event) =>
                          setSignupDraft((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Confirmar senha">
                      <PasswordInput
                        name="confirmation"
                        autoComplete="new-password"
                        value={signupDraft.confirmation}
                        onChange={(event) =>
                          setSignupDraft((current) => ({
                            ...current,
                            confirmation: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <span className="muted">{PASSWORD_POLICY_MESSAGE}</span>
                    <div className="actions">
                      <button type="button" onClick={() => setSignupStep(1)}>
                        Voltar
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={continueSignupCredentials}
                      >
                        Continuar
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </>
                )}

                {signupStep === 3 && (
                  <>
                    <span className="muted">
                      Confirme como seu cadastro deve ser vinculado à organização.
                    </span>
                    <Field label="Turma">
                      <input
                        value={options?.class?.name || "Turma padrão"}
                        readOnly
                        aria-readonly="true"
                      />
                    </Field>
                    <Field label="Departamento">
                      <select
                        name="department_id"
                        required
                        value={signupDraft.departmentId}
                        onChange={(event) =>
                          setSignupDraft((current) => ({
                            ...current,
                            departmentId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Selecionar departamento</option>
                        {options?.departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <span className="muted">
                      Seu cargo será aplicado automaticamente conforme o cadastro-base do RH.
                    </span>
                    <div className="actions">
                      <button type="button" disabled={busy} onClick={() => setSignupStep(2)}>
                        Voltar
                      </button>
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          !ready ||
                          !options ||
                          !nameMatch.result?.matched ||
                          !signupDraft.departmentId
                        }
                      >
                        {busy ? "Aguarde..." : "Verificar e-mail e ativar"}
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </>
                )}
              </form>
            ) : (
              <form onSubmit={submit} className="form-stack rh-login-form">
                <Field label="E-mail">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    required
                    inputMode="email"
                  />
                </Field>

                {mode !== "recover" && (
                  <Field label="Senha">
                    <PasswordInput minLength={1} autoComplete="current-password" />
                  </Field>
                )}

                {mode === "login" && (
                  <button
                    type="button"
                    className="text-button forgot-password"
                    onClick={() => changeMode("recover")}
                  >
                    Esqueci minha senha
                  </button>
                )}

                <button className="primary large login-submit" disabled={busy || !ready}>
                  {mode === "login" ? <KeyRound size={18} /> : <ArrowRight size={18} />}
                  {busy
                    ? "Aguarde..."
                    : mode === "recover"
                      ? "Enviar link"
                      : "Entrar"}
                </button>

                {mode === "recover" && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => changeMode("login")}
                  >
                    Voltar ao login
                  </button>
                )}
              </form>
            )}

          </div>
        </div>
      </section>
    </div>
  );
}
function ManagerActivation({
  configured: ready,
  onBack,
}: {
  configured: boolean;
  onBack: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activationCode, setActivationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [activatedEmail, setActivatedEmail] = useState("");

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("manager_email")).trim().toLowerCase();
    const password = String(form.get("manager_password"));
    const confirmation = String(form.get("manager_confirmation"));
    if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
      toast.error("Informe um endereço @gmail.com válido.");
      return;
    }
    if (!strongPassword(password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (password !== confirmation) {
      toast.error("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await client().functions.invoke("manager-activation", {
        body: {
          activation_code: activationCode,
          email,
          password,
          terms: form.get("terms") === "on",
        },
      });
      if (error) {
        let message = "Não foi possível ativar o acesso de gestor.";
        if ("context" in error && error.context instanceof Response) {
          const detail = (await error.context.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (detail?.error === "INVALID_ACTIVATION")
            message = "Código de ativação inválido, expirado ou já utilizado.";
          if (detail?.error === "ACTIVATION_IN_PROGRESS")
            message = "Esta ativação já está em andamento. Tente novamente em instantes.";
          if (detail?.error === "GMAIL_REQUIRED")
            message = "Informe um endereço @gmail.com válido.";
          if (detail?.error === "WEAK_PASSWORD")
            message = "A senha precisa ter 12 caracteres, maiúscula, minúscula, número e símbolo.";
          if (detail?.error === "EMAIL_UNAVAILABLE")
            message = "Este Gmail já está vinculado a outra conta.";
          if (detail?.error === "TERMS_REQUIRED")
            message = "É necessário aceitar o uso dos dados para concluir.";
        }
        throw new Error(message);
      }
      if (!(data as { ok?: boolean } | null)?.ok)
        throw new Error("Não foi possível ativar o acesso de gestor.");

      setActivatedEmail(email);
      setStep(3);
      capture("manager_activation_completed");
      await new Promise((resolve) => setTimeout(resolve, 950));

      const { error: signInError } = await client().auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setStep(2);
        throw signInError;
      }
      await rpc("authenticate_event", { action_name: "login" });
      capture("login_success");
    } catch (error) {
      captureError("manager_activation", error);
      toast.error(error instanceof Error ? error.message : errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (step === 3) {
    return (
      <AuthFrame>
        <div className="manager-success" aria-live="polite">
          <div className="manager-activation-emblem success">
            <ShieldCheck size={34} />
            <Sparkles className="manager-sparkle" size={21} />
          </div>
          <div className="eyebrow">ACESSO DE GESTOR ATIVADO</div>
          <h1>Proteção em duas etapas</h1>
          <p>
            Conta vinculada a <strong>{activatedEmail}</strong>. Preparando o envio do
            código de segurança para concluir o primeiro acesso.
          </p>
          <div className="manager-loading-line" />
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <div className="manager-activation-hero">
        <div className="manager-activation-emblem">
          <ShieldCheck size={32} />
          <Sparkles className="manager-sparkle" size={20} />
        </div>
        <div>
          <div className="eyebrow">ACESSO EXCLUSIVO DE GESTOR</div>
          <h1>Ative seu acesso de gestão</h1>
          <p>
            Este fluxo é de uso único. Depois da ativação, seu Gmail e sua nova
            senha serão usados no login normal, sempre com verificação em duas etapas.
          </p>
        </div>
      </div>

      <div className="manager-activation-steps" aria-label="Etapas da ativação">
        <span className={step >= 1 ? "active" : ""}>1. Código</span>
        <span className={step >= 2 ? "active" : ""}>2. Segurança</span>
        <span>3. 2FA</span>
      </div>

      {!ready && (
        <div className="notice">
          A ativação está temporariamente indisponível. Aguarde a liberação do sistema.
        </div>
      )}

      {step === 1 ? (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (activationCode.length < 10) {
              toast.error("Confira o código temporário.");
              return;
            }
            capture("manager_activation_started");
            setStep(2);
          }}
        >
          <Field label="Código temporário">
            <div className="password-field manager-code-field">
              <input
                name="activation_code"
                value={activationCode}
                onChange={(event) => setActivationCode(event.target.value.toUpperCase())}
                autoComplete="one-time-code"
                minLength={10}
                required
              />
              <span className="manager-code-icon" aria-hidden="true">
                <KeyRound size={18} />
              </span>
            </div>
          </Field>
          <div className="manager-security-note">
            Use o código temporário recebido. Ele funciona uma única vez e expira automaticamente.
          </div>
          <button className="primary large" disabled={!ready}>
            Continuar <ArrowRight size={19} />
          </button>
          <button type="button" className="text-button" onClick={onBack}>
            Voltar ao login
          </button>
        </form>
      ) : (
        <form className="form-stack" onSubmit={activate}>
          <Field label="Gmail de segurança">
            <input
              name="manager_email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="seunome@gmail.com"
              required
              autoFocus
            />
          </Field>
          <div className="manager-security-note emphasized">
            Este Gmail receberá o código de 6 dígitos da verificação em duas etapas.
          </div>
          <Field label="Crie sua nova senha">
            <PasswordInput name="manager_password" autoComplete="new-password" />
          </Field>
          <Field label="Confirmar nova senha">
            <PasswordInput name="manager_confirmation" autoComplete="new-password" />
          </Field>
          <span className="muted">
            Mínimo de 12 caracteres com maiúscula, minúscula, número e símbolo.
          </span>
          <details className="privacy">
            <summary>Uso dos seus dados</summary>
            <p>
              O Gmail será usado para autenticação, recuperação de acesso e códigos de
              segurança. Seu perfil de gestor acessa apenas os recursos autorizados pelo
              cargo e todas as ações administrativas permanecem auditadas.
            </p>
          </details>
          <label className="check">
            <input type="checkbox" name="terms" required />
            Li e aceito o uso dos dados para autenticação e gestão do RH.
          </label>
          <button className="primary large" disabled={busy || !ready}>
            {busy ? "Ativando..." : "Ativar acesso de gestor"}
            <ShieldCheck size={19} />
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setStep(1)}
          >
            Voltar
          </button>
        </form>
      )}
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
  const [name, setName] = useState(user.profile.full_name || "");
  const [phone, setPhone] = useState(user.profile.phone || "");
  const [departmentId, setDepartmentId] = useState(
    user.profile.requested_department_id || "",
  );
  const options = useRegistrationOptions();
  const nameMatch = usePreRegistrationMatch(name);

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameMatch.result?.matched) {
      toast.error("O nome precisa corresponder a um cadastro pré-existente.");
      return;
    }
    if (!departmentId) {
      toast.error("Selecione seu departamento.");
      return;
    }

    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await rpc("complete_profile", {
        payload: json({
          full_name: name,
          phone,
          department_id: departmentId,
          terms: form.get("terms") === "on",
        }),
      });
      toast.success("Cadastro reconhecido e acesso liberado.");
      await onDone();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("PRE_REGISTRATION_NOT_FOUND"))
        toast.error("Não encontramos esse nome entre os cadastros pré-existentes.");
      else if (message.includes("PRE_REGISTRATION_AMBIGUOUS"))
        toast.error("Há mais de um cadastro com esse nome. Procure o RH.");
      else if (message.includes("PRE_REGISTRATION_ALREADY_LINKED"))
        toast.error("Esse cadastro já está vinculado a outra conta.");
      else if (message.includes("EMAIL_NOT_VERIFIED"))
        toast.error("Verifique seu e-mail antes de concluir.");
      else if (message.includes("PRE_REGISTERED_EMAIL_REQUIRED"))
        toast.error("Use exatamente o e-mail autorizado no seu pré-cadastro.");
      else if (message.includes("INVALID_DEPARTMENT"))
        toast.error("Selecione um departamento válido.");
      else if (message.includes("INVALID_PHONE"))
        toast.error("Informe um telefone válido.");
      else if (message.includes("ROLE_NOT_AUTHORIZED"))
        toast.error("Esse cargo não está autorizado no seu cadastro pré-existente. Procure o RH para corrigir o cargo.");
      else if (message.includes("INVALID_ROLE") || message.includes("ROLE_NOT_CONFIGURED"))
        toast.error("Selecione um cargo válido.");
      else if (message.includes("TERMS_REQUIRED"))
        toast.error("É necessário aceitar o uso dos dados.");
      else toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <div className="eyebrow">PRIMEIRO ACESSO</div>
      <h1>Confirme seus dados</h1>
      <div className="steps">
        <span className="done">1. E-mail verificado</span>
        <span className="active">2. Identificação</span>
        <span>3. Acesso</span>
      </div>

      <form className="form-stack" onSubmit={finish}>
        <Field label="Nome completo">
          <input
            name="full_name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
            minLength={4}
          />
        </Field>

        {nameMatch.checking ? (
          <span className="muted">Localizando seu cadastro...</span>
        ) : nameMatch.result?.matched ? (
          <div className="notice">
            Cadastro reconhecido: <strong>{nameMatch.result.canonical_name}</strong>
          </div>
        ) : nameMatch.result?.suggestions?.length ? (
          <div className="notice">
            <strong>Selecione seu cadastro:</strong>
            <select
              value=""
              aria-label="Cadastros encontrados no primeiro acesso"
              onChange={(event) => {
                if (!event.target.value) return;
                setName(event.target.value);
              }}
            >
              <option value="">Escolher nome</option>
              {nameMatch.result.suggestions.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="muted">
            Digite parte do seu nome para localizar e selecionar seu cadastro.
          </span>
        )}

        <Field label="E-mail">
          <input value={user.profile.email} readOnly aria-readonly="true" />
        </Field>

        <Field label="Telefone">
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            minLength={8}
          />
        </Field>

        <Field label="Turma">
          <input
            value={options?.class?.name || user.profile.requested_class || "Turma padrão"}
            readOnly
            aria-readonly="true"
          />
        </Field>

        <Field label="Departamento">
          <select
            name="department_id"
            required
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">Selecionar departamento</option>
            {options?.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </Field>

        <span className="muted">
          Seu cargo será definido automaticamente pelo cadastro-base do RH.
        </span>

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

        <button
          className="primary"
          disabled={
            busy ||
            !options ||
            !nameMatch.result?.matched ||
            phone.trim().length < 8 ||
            !departmentId
          }
        >
          {busy ? "Ativando..." : "Ativar meu acesso"}
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
          const password = String(data.get("password"));
          if (!strongPassword(password)) {
            toast.error(PASSWORD_POLICY_MESSAGE);
            return;
          }
          if (password !== data.get("confirmation")) {
            toast.error("As senhas precisam ser iguais.");
            return;
          }
          await runAction(async () => {
            const { error } = await client().auth.updateUser({
              password,
            });
            if (error) throw error;
            await client().auth.signOut({ scope: "global" });
            history.replaceState(null, "", location.pathname);
            onDone();
          }, "Senha atualizada. Entre novamente.");
        }}
      >
        <Field label="Nova senha">
          <PasswordInput autoComplete="new-password" />
        </Field>
        <Field label="Confirmar senha">
          <PasswordInput name="confirmation" autoComplete="new-password" />
        </Field>
        <span className="muted">{PASSWORD_POLICY_MESSAGE}</span>
        <button className="primary">Salvar senha</button>
      </form>
    </AuthFrame>
  );
}
