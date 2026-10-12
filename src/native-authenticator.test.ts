import { describe, expect, it, vi } from "vitest";
import {
  createNativeAuthenticatorApi,
  type NativeMfaPort,
} from "../shared/native-authenticator";

function fixture() {
  const factors = [
    {
      id: "fixture-factor",
      factor_type: "totp",
      status: "verified",
      friendly_name: "Meu aplicativo",
    },
  ];
  const mfa = {
    listFactors: vi.fn(async () => ({
      data: { all: factors, totp: factors },
      error: null,
    })),
    enroll: vi.fn(async () => ({
      data: {
        id: "pending-factor",
        totp: {
          qr_code:
            'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" /></svg>',
          secret: "FIXTUREKEY",
        },
      },
      error: null,
    })),
    challengeAndVerify: vi.fn(async () => ({
      data: { access_token: "fixture-token" },
      error: null,
    })),
    unenroll: vi.fn(async () => ({ error: null })),
  };
  const confirm = vi.fn(async (): Promise<unknown> => ({ ok: true }));
  const api = createNativeAuthenticatorApi(mfa as NativeMfaPort, confirm);
  return { api, mfa, confirm, factors };
}

describe("confirmação por aplicativo na fronteira do serviço", () => {
  it("aguarda a verificação em voo e preserva o fator aceito mesmo se a prova do aplicativo falhar", async () => {
    const f = fixture();
    f.factors[0].status = "unverified";
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.mfa.challengeAndVerify.mockImplementationOnce(async () => {
      await gate;
      f.factors[0].status = "verified";
      return { data: { access_token: "fixture-token" }, error: null };
    });
    f.confirm.mockResolvedValueOnce({ ok: false });
    const verify = f.api.verify("fixture-factor", "123456");
    const discarded = f.api.discardPending("fixture-factor");
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await expect(verify).rejects.toThrow("Não foi possível confirmar o acesso");
    await discarded;
    expect(f.mfa.unenroll).not.toHaveBeenCalled();
  });
  it("lista somente aplicativos já confirmados e não cria outro fator", async () => {
    const f = fixture();
    f.factors.push({
      id: "pending",
      factor_type: "totp",
      status: "unverified",
      friendly_name: "Pendente",
    });
    expect(await f.api.list()).toEqual([
      { id: "fixture-factor", name: "Meu aplicativo" },
    ]);
    expect(f.mfa.enroll).not.toHaveBeenCalled();
  });
  it("transforma o SVG nativo em imagem local codificada", async () => {
    const f = fixture();
    const setup = await f.api.enroll();
    expect(setup.id).toBe("pending-factor");
    expect(setup.secret).toBe("FIXTUREKEY");
    expect(setup.qr).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
    expect(setup.qr).not.toContain("<svg");
  });
  it("recusa imagens externas e descarta apenas o fator pendente criado", async () => {
    const f = fixture();
    f.mfa.enroll.mockResolvedValueOnce({
      data: {
        id: "pending-factor",
        totp: { qr_code: "https://fixture.invalid/qr", secret: "FIXTUREKEY" },
      },
      error: null,
    });
    f.factors.push({
      id: "pending-factor",
      factor_type: "totp",
      status: "unverified",
      friendly_name: "Pendente",
    });
    await expect(f.api.enroll()).rejects.toThrow("Não foi possível configurar");
    expect(f.mfa.unenroll).toHaveBeenCalledExactlyOnceWith({
      factorId: "pending-factor",
    });
  });
  it("não remove um fator que já tenha sido confirmado", async () => {
    const f = fixture();
    await f.api.discardPending("fixture-factor");
    expect(f.mfa.unenroll).not.toHaveBeenCalled();
  });
  it("remove somente o fator pendente informado", async () => {
    const f = fixture();
    f.factors.push({
      id: "pending-factor",
      factor_type: "totp",
      status: "unverified",
      friendly_name: "Pendente",
    });
    await f.api.discardPending("pending-factor");
    expect(f.mfa.unenroll).toHaveBeenCalledExactlyOnceWith({
      factorId: "pending-factor",
    });
  });
  it("recusa código incompleto antes de contatar o serviço", async () => {
    const f = fixture();
    await expect(f.api.verify("fixture-factor", "123")).rejects.toThrow(
      "6 dígitos",
    );
    expect(f.mfa.challengeAndVerify).not.toHaveBeenCalled();
    expect(f.confirm).not.toHaveBeenCalled();
  });
  it("só confirma a prova depois de o serviço aceitar o código", async () => {
    const f = fixture();
    f.mfa.challengeAndVerify.mockResolvedValueOnce({
      data: null,
      error: { code: "mfa_verification_failed" },
    } as never);
    await expect(f.api.verify("fixture-factor", "123456")).rejects.toThrow(
      "Código inválido",
    );
    expect(f.confirm).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ok: false }, { ok: "true" }])(
    "recusa confirmação incompleta %j",
    async (response) => {
      const f = fixture();
      f.confirm.mockResolvedValueOnce(response);
      await expect(f.api.verify("fixture-factor", "123456")).rejects.toThrow(
        "Não foi possível confirmar o acesso",
      );
    },
  );
  it("não envia parâmetros de identidade na confirmação e mantém a ordem", async () => {
    const f = fixture();
    await f.api.verify("fixture-factor", "123456");
    expect(f.mfa.challengeAndVerify).toHaveBeenCalledExactlyOnceWith({
      factorId: "fixture-factor",
      code: "123456",
    });
    expect(f.confirm).toHaveBeenCalledExactlyOnceWith();
    expect(f.mfa.challengeAndVerify.mock.invocationCallOrder[0]).toBeLessThan(
      f.confirm.mock.invocationCallOrder[0],
    );
  });
});
