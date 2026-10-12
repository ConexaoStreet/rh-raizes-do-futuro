import { describe, expect, it } from "vitest";
import { sessionIdentity } from "../shared/verification-session";
const sid = "75000000-0000-4000-8000-000000000001";
const session = (
  session_id: unknown = sid,
  id = "fixture-user",
  extra = {},
) => ({
  user: { id },
  access_token:
    "header." +
    Buffer.from(JSON.stringify({ session_id, ...extra })).toString(
      "base64url",
    ) +
    ".signature",
});
describe("identidade da sessão ao retomar uma ação", () => {
  it("mantém a identidade quando o código muda só a prova de autenticação", () => {
    expect(sessionIdentity(session(sid, "fixture-user", { aal: "aal1" }))).toBe(
      sessionIdentity(session(sid, "fixture-user", { aal: "aal2" })),
    );
  });
  it("distingue outra sessão da mesma conta", () => {
    expect(sessionIdentity(session())).not.toBe(
      sessionIdentity(session("75000000-0000-4000-8000-000000000002")),
    );
  });
  it("distingue outra pessoa", () => {
    expect(sessionIdentity(session())).not.toBe(
      sessionIdentity(session(sid, "other-user")),
    );
  });
  it.each([
    null,
    { user: { id: "fixture-user" }, access_token: "invalid" },
    session(null),
    session("invalid"),
  ])("recusa identidade ausente ou incompleta %j", (value) => {
    expect(sessionIdentity(value)).toBeNull();
  });
});
