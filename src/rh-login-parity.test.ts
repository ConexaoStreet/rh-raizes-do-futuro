import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync("src/auth.tsx", "utf8");
const mascot = readFileSync("src/LoginMascot.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

describe("RH login parity with Central T.I.", () => {
  it("uses the same responsive editorial shell without removing RH flows", () => {
    expect(auth).toContain('className="login-page"');
    expect(auth).toContain('className="login-brand"');
    expect(auth).toContain('className="login-panel"');
    expect(auth).toContain('className="login-stage"');
    expect(auth).toContain('className="login-card');
    expect(auth).toContain("Ativar cadastro");
    expect(auth).toContain("Esqueci minha senha");
    expect(auth).toContain("Entrar com segurança");
  });

  it("ports the interactive mascot behavior", () => {
    expect(auth).toContain("<LoginMascot");
    expect(auth).toContain('scopeSelector=".login-stage"');
    expect(mascot).toContain("caretPoint");
    expect(mascot).toContain("pointermove");
    expect(mascot).toContain('"password"');
    expect(mascot).toContain('"success"');
  });

  it("keeps mobile, iOS/Android-safe and reduced-motion rules", () => {
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("font-size: 16px");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(mascot).toContain(".root-mascot-login");
  });
});
