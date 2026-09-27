import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync("src/main.tsx", "utf8");
const components = readFileSync("src/components.tsx", "utf8");
const styles = readFileSync("src/styles/rh-redesign.css", "utf8");
const shell = readFileSync("src/App.tsx", "utf8");
const navigation = readFileSync("src/layout/RhNavigation.ts", "utf8");
const legacyStyles = readFileSync("src/styles.css", "utf8");

describe("RH redesign foundation", () => {
  it("loads the redesign layer after the legacy stylesheet", () => {
    expect(main.indexOf('import "./styles.css";')).toBeGreaterThan(-1);
    expect(main.indexOf('import "./styles/rh-redesign.css";')).toBeGreaterThan(
      main.indexOf('import "./styles.css";'),
    );
  });

  it("defines the visual tokens required by the redesign", () => {
    for (const token of [
      "--rh-surface-canvas",
      "--rh-surface-panel",
      "--rh-text-strong",
      "--rh-text-subtle",
      "--rh-border",
      "--rh-primary",
      "--rh-accent",
      "--rh-success",
      "--rh-warning",
      "--rh-danger",
      "--rh-radius-lg",
      "--rh-motion-base",
    ]) {
      expect(styles).toContain(token);
    }
  });

  it("keeps shared components backwards compatible while exposing UI hooks", () => {
    expect(components).toContain('className = ""');
    expect(components).toContain('variant?: "default" | "primary" | "attention"');
    expect(components).toContain("stat-" + "$" + "{variant}");
    expect(components).toContain("export function Heading");
    expect(components).toContain("export function Empty");
    expect(components).toContain("export function Loading");
    expect(components).toContain("export function ErrorState");
    expect(components).toContain("export function Stat");
  });

  it("keeps the RH navigation contract intact", () => {
    for (const path of [
      "/",
      "/hoje",
      "/colaboradores",
      "/chamada",
      "/presenca",
      "/faltas",
      "/atrasos",
      "/justificativas",
      "/feedbacks",
      "/notas",
      "/gestao",
      "/calendario",
      "/suporte-ti",
      "/relatorios",
      "/apresentacoes",
      "/usuarios",
      "/cargos",
      "/auditoria",
      "/configuracoes",
      "/admin",
    ]) {
      expect(navigation).toContain(`path: "${path}"`);
    }
    expect(navigation).toContain('permission: "dashboard.view"');
    expect(navigation).toContain('permission: "system.manage"');
    expect(shell).toContain('!can("dashboard.view")');
    expect(shell).toContain("Meu perfil");
  });

  it("uses the redesigned RH shell semantics", () => {
    expect(shell).toContain('aria-label="Navegação principal do RH"');
    expect(shell).toContain('className="topbar-context desktop-only"');
    expect(shell).toContain('className="workspace-copy"');
    expect(legacyStyles).toContain("var(--rh-surface-canvas)");
    expect(legacyStyles).toContain("var(--rh-motion-fast)");
  });
});
