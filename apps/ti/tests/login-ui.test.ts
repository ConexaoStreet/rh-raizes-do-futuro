import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync("apps/ti/src/auth.tsx", "utf8");
const redesign = readFileSync("apps/ti/src/redesign.css", "utf8");
const styles = readFileSync("apps/ti/src/styles.css", "utf8") + "\n" + redesign;

describe("TI login redesign", () => {
  it("preserves password and weekly-code authentication contracts", () => {
    for (const contract of [
      'useState<"password" | "code">("password")',
      'name="email"',
      'name="password"',
      'name="access_code"',
      "signInWithPassword",
      '"ti-code-login"',
      'action: "login"',
      'action: "confirm"',
      "verifyOtp",
      "resetPasswordForEmail",
      "requestPasswordReset",
      "E-mail e senha",
      "Código semanal",
      "Esqueci minha senha",
    ]) {
      expect(auth).toContain(contract);
    }
  });

  it("keeps weekly code independent from password submission", () => {
    expect(auth).toMatch(/if \(loginMode === "code"\)[\s\S]*?return;[\s\S]*?signInWithPassword/s);
    expect(auth).toContain('autoComplete="one-time-code"');
    expect(auth).toContain('autoComplete="current-password"');
  });

  it("adds semantic access tabs and an anchored mascot dock", () => {
    expect(auth).toContain('className="login-mode-icon"');
    expect(auth).toContain('aria-controls="ti-login-password-panel"');
    expect(auth).toContain('aria-controls="ti-login-code-panel"');
    expect(auth).toContain('className="login-mascot-dock"');
    expect(auth).toContain('id="ti-login-password-panel"');
    expect(auth).toContain('id="ti-login-code-panel"');
  });

  it("provides clear tab, theme and mascot interaction contracts", () => {
    expect(styles).toMatch(/\.login-mode-switch button\s*\{[^}]*min-height:\s*44px;[^}]*transition:[^}]*180ms/s);
    expect(styles).toContain(".login-mode-switch button:not(.active)");
    expect(styles).toMatch(/\.login-theme-control \.theme-toggle\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
    expect(styles).toMatch(/\.login-mascot-dock\s*\{[\s\S]*?position:\s*relative;/s);
    expect(styles).toMatch(/\.login-mascot-dock \.root-mascot-login\s*\{[^}]*position:\s*relative;/s);
  });
});
