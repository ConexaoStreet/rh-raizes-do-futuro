import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync("src/auth.tsx", "utf8");
const e2e = readFileSync("e2e/theme.e2e.ts", "utf8");
const registrationBootstrap = readFileSync(
  "supabase/functions/registration-bootstrap/index.ts",
  "utf8",
);

describe("RH first-access redesign", () => {
  it("presents signup in three focused steps", () => {
    expect(auth).toContain("const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1)");
    expect(auth).toContain("1. Identidade");
    expect(auth).toContain("2. Credenciais");
    expect(auth).toContain("3. Vínculo");
    expect(auth).toContain("continueSignupIdentity");
    expect(auth).toContain("continueSignupCredentials");
  });

  it("preserves Gmail, pre-registration and password validations", () => {
    expect(auth).toContain('/^[^\\s@]+@gmail\\.com$/i');
    expect(auth).toContain("nameMatch.result?.matched");
    expect(auth).toContain("strongPassword(signupDraft.password)");
    expect(auth).toContain("signupDraft.password !== signupDraft.confirmation");
    expect(auth).toContain("signupDraft.phone.trim().length < 8");
  });

  it("suggests partial pre-registered names but still requires an exact selection", () => {
    expect(auth).toContain("suggestions?: string[]");
    expect(auth).toContain("Encontramos estes pré-cadastros:");
    expect(auth).toContain("setSignupName(candidate)");
    expect(auth).toContain("nameMatch.result?.matched");
    expect(registrationBootstrap).toContain("employee.normalized_name.startsWith(submitted)");
    expect(registrationBootstrap).toContain("employee.normalized_name.includes(\` \${submitted}\`)");
    expect(registrationBootstrap).toContain("suggestions.length ? \"SUGGESTIONS\" : \"NOT_FOUND\"");
    expect(registrationBootstrap).toContain(").slice(0, 5)");
  });

  it("preserves signup metadata and redirect behavior", () => {
    expect(auth).toContain("client().auth.signUp");
    expect(auth).toContain("full_name: nameMatch.result.canonical_name || signupName.trim()");
    expect(auth).toContain("phone,");
    expect(auth).toContain("requested_department_id: departmentId");
    expect(auth).toContain("requested_role_code: roleCode");
    expect(auth).toContain("emailRedirectTo: redirect");
  });

  it("keeps first access covered by browser tests", () => {
    expect(e2e).toContain('page.getByText("1. Identidade")');
    expect(e2e).toContain('page.getByText("2. Credenciais")');
    expect(e2e).toContain('page.getByText("3. Vínculo")');
    expect(e2e).toContain('name: "Continuar para credenciais"');
    expect(e2e).toContain("test.user.e2e@gmail.com");
  });
});
