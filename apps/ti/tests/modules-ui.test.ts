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
const codeSurface = readOptional(
  "apps/ti/src/components/CodeSurface.tsx",
);
const integrationCard = readOptional(
  "apps/ti/src/components/IntegrationCard.tsx",
);

describe("TI technical module redesign", () => {
  it("preserves settings keys and bridge actions", () => {
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
      'action: "request"',
      'action: "status"',
      'action: "storage_list"',
      'action: "storage_delete"',
      'action: "database"',
      'action: "health"',
      'action: "preview"',
    ]) {
      expect(app).toContain(contract);
    }
    expect(app).toMatch(/invokeFunction\(\s*"datasul-bridge"/s);
    expect(app).toMatch(/invokeFunction\(\s*"platform-bridge"/s);
  });

  it("preserves destructive confirmations and technical state", () => {
    for (const contract of [
      "Confirmar exclusão no Datasul? Esta ação pode ser irreversível.",
      "Ativar manutenção global do RH?",
      "Desativar manutenção e liberar o RH?",
      "Revogar esta sessão?",
      "Digite EXCLUIR para remover este arquivo:",
      'const [requestMethod, setRequestMethod] = useState("GET")',
      'const [requestPath, setRequestPath] = useState("")',
      'const [requestBody, setRequestBody] = useState("{\\n\\n}")',
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
