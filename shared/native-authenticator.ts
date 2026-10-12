type NativeFactor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string;
};

export type NativeMfaPort = {
  listFactors: () => Promise<{
    data: { all: NativeFactor[] } | null;
    error: unknown;
  }>;
  enroll: (params: { factorType: "totp"; issuer: string }) => Promise<{
    data: { id: string; totp: { qr_code: string; secret: string } } | null;
    error: unknown;
  }>;
  challengeAndVerify: (params: {
    factorId: string;
    code: string;
  }) => Promise<{ data: { access_token: string } | null; error: unknown }>;
  unenroll: (params: { factorId: string }) => Promise<{ error: unknown }>;
};

export type AuthenticatorFactor = { id: string; name: string };
export type AuthenticatorSetup = { id: string; qr: string; secret: string };
export class NativeAuthenticatorError extends Error {}
export type NativeAuthenticatorApi = {
  list: () => Promise<AuthenticatorFactor[]>;
  enroll: () => Promise<AuthenticatorSetup>;
  verify: (factorId: string, code: string) => Promise<void>;
  discardPending: (factorId: string) => Promise<void>;
};

function qrImage(source: string) {
  const prefix = "data:image/svg+xml;utf-8,";
  let svg = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  if (svg.startsWith("%3C")) svg = decodeURIComponent(svg);
  if (!/^\s*<svg\b/.test(svg) || svg.length > 256_000)
    throw new NativeAuthenticatorError(
      "Não foi possível configurar o aplicativo. Tente novamente.",
    );
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export function createNativeAuthenticatorApi(
  mfa: NativeMfaPort,
  confirmProof: () => Promise<unknown>,
): NativeAuthenticatorApi {
  const verification = new Map<string, Promise<void>>();
  const accepted = new Set<string>();
  async function factors() {
    const result = await mfa.listFactors();
    if (result.error || !Array.isArray(result.data?.all))
      throw new NativeAuthenticatorError(
        "Não foi possível consultar seus aplicativos. Tente novamente.",
      );
    return result.data.all;
  }
  async function discardPending(factorId: string) {
    await verification.get(factorId)?.catch(() => undefined);
    if (accepted.has(factorId)) return;
    const pending = (await factors()).find(
      (f) =>
        f.id === factorId &&
        f.factor_type === "totp" &&
        f.status === "unverified",
    );
    if (!pending) return;
    const result = await mfa.unenroll({ factorId });
    if (result.error)
      throw new NativeAuthenticatorError(
        "Não foi possível cancelar a configuração. Tente novamente.",
      );
  }
  return {
    async list() {
      return (await factors())
        .filter((f) => f.factor_type === "totp" && f.status === "verified")
        .map((f) => ({
          id: f.id,
          name: f.friendly_name?.trim() || "Meu aplicativo",
        }));
    },
    async enroll() {
      const result = await mfa.enroll({
        factorType: "totp",
        issuer: "Raízes do Futuro",
      });
      if (result.error || !result.data?.id)
        throw new NativeAuthenticatorError(
          "Não foi possível configurar o aplicativo. Tente novamente.",
        );
      try {
        const { id, totp } = result.data;
        if (!totp?.secret?.trim()) throw new Error("INCOMPLETE_SETUP");
        return { id, qr: qrImage(totp.qr_code), secret: totp.secret };
      } catch {
        await discardPending(result.data.id).catch(() => undefined);
        throw new NativeAuthenticatorError(
          "Não foi possível configurar o aplicativo. Tente novamente.",
        );
      }
    },
    async verify(factorId, code) {
      const running = verification.get(factorId);
      if (running) return running;
      const operation = (async () => {
        if (!/^\d{6}$/.test(code))
          throw new NativeAuthenticatorError(
            "Digite os 6 dígitos do seu aplicativo.",
          );
        const result = await mfa.challengeAndVerify({ factorId, code });
        if (result.error || !result.data?.access_token)
          throw new NativeAuthenticatorError(
            "Código inválido ou expirado. Digite o código atual do aplicativo.",
          );
        accepted.add(factorId);
        let proof: unknown;
        try {
          proof = await confirmProof();
        } catch {
          throw new NativeAuthenticatorError(
            "Não foi possível confirmar o acesso. Tente novamente.",
          );
        }
        if (
          !proof ||
          typeof proof !== "object" ||
          !("ok" in proof) ||
          proof.ok !== true
        )
          throw new NativeAuthenticatorError(
            "Não foi possível confirmar o acesso. Tente novamente.",
          );
      })();
      verification.set(factorId, operation);
      try {
        await operation;
      } finally {
        if (verification.get(factorId) === operation)
          verification.delete(factorId);
      }
    },
    discardPending,
  };
}
