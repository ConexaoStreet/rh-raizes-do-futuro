import { describe, expect, it } from "vitest";
import { validEmailAddress } from "../shared/email-address";

describe("email addresses from any provider", () => {
  it.each([
    "pessoa@gmail.com",
    "pessoa@outlook.com",
    "pessoa@yahoo.com.br",
    "pessoa+rh@equipe.empresa.com.br",
    "auditoria@maxxspace.com",
    "PESSOA@PROVEDOR.NOVO",
  ])("accepts %s without a provider allowlist", (address) => {
    expect(validEmailAddress(address)).toBe(true);
  });

  it.each(["", "pessoa", "@empresa.com", "pessoa@", "pessoa@@empresa.com", "pessoa @empresa.com", "pessoa@empresa com", "pessoa@empresa.com\n"])(
    "rejects malformed address %j",
    (address) => expect(validEmailAddress(address)).toBe(false),
  );
});
