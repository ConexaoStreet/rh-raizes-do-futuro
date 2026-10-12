import { useEffect, useId, useRef, useState } from "react";
import {
  NativeAuthenticatorError,
  type AuthenticatorFactor,
  type AuthenticatorSetup,
  type NativeAuthenticatorApi,
} from "./native-authenticator";

export default function NativeAuthenticator({
  api,
  onDone,
  onBack,
  onBusyChange,
  primaryClass = "primary",
}: {
  api: NativeAuthenticatorApi;
  onDone: (isCurrent: () => boolean) => Promise<void>;
  onBack: () => void;
  onBusyChange?: (busy: boolean) => void;
  primaryClass?: string;
}) {
  const [factors, setFactors] = useState<AuthenticatorFactor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [setup, setSetup] = useState<AuthenticatorSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lifecycle = useRef(0);
  const mounted = useRef(false);
  const pending = useRef<string | null>(null);
  const inFlight = useRef(false);
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  const inputId = useId();

  const active = (turn: number) =>
    mounted.current && lifecycle.current === turn;
  function explain(caught: unknown) {
    return caught instanceof NativeAuthenticatorError
      ? caught.message
      : "Não foi possível concluir a confirmação. Tente novamente.";
  }
  useEffect(() => {
    mounted.current = true;
    const turn = ++lifecycle.current;
    busyCallback.current?.(true);
    void api
      .list()
      .then((list) => {
        if (!active(turn)) return;
        setFactors(list);
        setLoaded(true);
        setFactorId(list[0]?.id || "");
      })
      .catch((caught) => {
        if (active(turn)) setError(explain(caught));
      })
      .finally(() => {
        if (active(turn)) {
          setLoading(false);
          busyCallback.current?.(false);
        }
      });
    return () => {
      mounted.current = false;
      lifecycle.current = turn + 1;
      if (pending.current)
        void api.discardPending(pending.current).catch(() => undefined);
    };
  }, [api]);

  async function run(action: (turn: number) => Promise<void>) {
    if (inFlight.current || loading) return;
    inFlight.current = true;
    const turn = lifecycle.current;
    setBusy(true);
    setError("");
    busyCallback.current?.(true);
    try {
      await action(turn);
    } catch (caught) {
      if (active(turn)) setError(explain(caught));
    } finally {
      inFlight.current = false;
      if (active(turn)) {
        setBusy(false);
        busyCallback.current?.(false);
      }
    }
  }
  return (
    <div
      className="form-stack"
      style={{ display: "grid", gap: 12, minWidth: 0 }}
    >
      <h2 style={{ margin: 0 }}>Aplicativo de códigos</h2>
      {loading ? <p role="status">Conferindo seus aplicativos...</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {!loading && loaded && !factorId ? (
        <>
          <p>
            Use um aplicativo autenticador no seu celular para gerar os códigos
            de confirmação. Você configura uma vez e usa o código atual quando
            precisar.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async (turn) => {
                const created = await api.enroll();
                if (!active(turn)) {
                  await api.discardPending(created.id).catch(() => undefined);
                  return;
                }
                pending.current = created.id;
                setSetup(created);
                setFactorId(created.id);
              })
            }
          >
            Configurar aplicativo
          </button>
        </>
      ) : null}
      {setup ? (
        <>
          <p>
            Abra seu aplicativo autenticador e leia este QR. Depois digite o
            código de 6 dígitos que aparecer no celular.
          </p>
          <img
            src={setup.qr}
            alt="Código QR para configurar seu aplicativo"
            width={232}
            height={232}
            style={{
              maxWidth: "100%",
              height: "auto",
              justifySelf: "center",
              background: "#fff",
              borderRadius: 12,
            }}
          />
          <details>
            <summary>Não consigo ler o QR</summary>
            <p>Cadastre esta chave manualmente no aplicativo:</p>
            <code style={{ overflowWrap: "anywhere", userSelect: "all" }}>
              {setup.secret}
            </code>
          </details>
        </>
      ) : factorId ? (
        <p>
          Abra seu aplicativo e digite o código atual. Não precisa aguardar um
          e-mail.
        </p>
      ) : null}
      {!loading && factorId ? (
        <form
          style={{ display: "grid", gap: 12, minWidth: 0 }}
          onSubmit={(event) => {
            event.preventDefault();
            const code = String(
              new FormData(event.currentTarget).get("authenticator_code") || "",
            );
            void run(async (turn) => {
              await api.verify(factorId, code);
              if (active(turn)) await onDone(() => active(turn));
            });
          }}
        >
          {factors.length > 1 ? (
            <label>
              Aplicativo
              <select
                aria-label="Aplicativo"
                value={factorId}
                disabled={busy}
                onChange={(event) => setFactorId(event.target.value)}
              >
                {factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label htmlFor={inputId}>Código do aplicativo</label>
          <input
            id={inputId}
            className="otp-input otp"
            name="authenticator_code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            disabled={busy}
            style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
          />
          <button className={primaryClass} disabled={busy}>
            {busy ? "Conferindo..." : "Confirmar acesso"}
          </button>
        </form>
      ) : null}
      <button
        type="button"
        className="text-button"
        disabled={loading || busy}
        onClick={() =>
          void run(async (turn) => {
            if (pending.current) {
              await api.discardPending(pending.current);
              pending.current = null;
            }
            if (active(turn)) onBack();
          })
        }
      >
        Usar e-mail
      </button>
    </div>
  );
}
