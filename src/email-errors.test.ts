import { describe, expect, it } from "vitest";
import { errorMessage } from "./domain";

describe("email failures in ordinary language", () => {
  it("explains the real email quota even when the provider uses a generic message", () => {
    expect(
      errorMessage({
        code: "over_email_send_rate_limit",
        message: "email rate limit exceeded",
      }),
    ).toBe(
      "O envio de e-mails atingiu o limite temporário. Aguarde para tentar novamente.",
    );
  });

  it("explains missing delivery configuration without exposing provider details", () => {
    expect(
      errorMessage({
        code: "EMAIL_CONFIGURATION_REQUIRED",
        message: "validation_error",
      }),
    ).toBe(
      "O envio de e-mails precisa ser configurado pelo responsável pelo site.",
    );
  });

  it("keeps the code cooldown separate from the chat cooldown", () => {
    expect(errorMessage(new Error("RATE_LIMITED"))).toBe(
      "Aguarde antes de tentar novamente.",
    );
    expect(errorMessage(new Error("RATE_LIMIT"))).toBe(
      "Aguarde alguns segundos antes de enviar outra mensagem.",
    );
  });

  it("does not display unknown backend messages", () => {
    expect(
      errorMessage({ code: "unknown", message: "internal provider payload" }),
    ).toBe("Não foi possível concluir. Tente novamente.");
  });
});
