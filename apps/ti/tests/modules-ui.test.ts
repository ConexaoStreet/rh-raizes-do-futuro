import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("apps/ti/src/App.tsx", "utf8");
const readOptional = (path: string) =>
  existsSync(path) ? readFileSync(path, "utf8") : "";

const technicalTable = readOptional(
  "apps/ti/src/components/TechnicalTable.tsx",
);
const technicalField = readOptional(
  "apps/ti/src/components/TechnicalField.tsx",
);
const codeSurface = readOptional("apps/ti/src/components/CodeSurface.tsx");
const integrationCard = readOptional(
  "apps/ti/src/components/IntegrationCard.tsx",
);

describe("TI technical module redesign", () => {
  it("preserves administrative settings and internal Datasul", () => {
    for (const contract of [
      '"ti_control"',
      '"ti_datasul"',
      '"ti_github"',
      '"ti_vercel"',
      '"ti_email"',
      '"ti_site"',
      '"maintenance"',
      'invokeFunction("ti-admin-bridge"',
      'action: "inventory"',
      'action: "status"',
      'action: "storage_list"',
      'action: "storage_delete"',
      'action: "database"',
    ]) {
      expect(app).toContain(contract);
    }
    expect(app).not.toMatch(/invokeFunction\(\s*"datasul-bridge"/s);
    expect(app).toContain("O Datasul do Raízes, organizado por área.");
    expect(app).toContain("Área do Datasul");
    expect(app).toContain('can("employee.manage")');
    expect(app).toMatch(/invokeFunction\(\s*"platform-bridge"/s);
  });

  it("preserves destructive confirmations and technical state", () => {
    for (const contract of [
      "Ativar manutenção global do RH?",
      "Desativar manutenção e liberar o RH?",
      "Revogar esta sessão?",
      "Digite EXCLUIR para remover este arquivo:",
      "setBusy(key)",
      'setError("")',
      'setNotice("")',
      'setBusy("")',
      "moduleErrors",
    ]) {
      expect(app).toContain(contract);
    }
  });

  it("provides reusable technical primitives", () => {
    expect(technicalTable).toContain("export function TechnicalTable");
    expect(technicalField).toContain("export function TechnicalField");
    expect(codeSurface).toContain("export function CodeSurface");
    expect(integrationCard).toContain("export function IntegrationCard");
  });

  it("uses technical primitives across module domains", () => {
    for (const contract of [
      "<TechnicalTable",
      "<TechnicalField",
      "<CodeSurface",
      "<IntegrationCard",
    ]) {
      expect(app).toContain(contract);
    }
  });
});
