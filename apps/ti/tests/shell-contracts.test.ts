import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("apps/ti/src/App.tsx", "utf8");
const nav = readFileSync("apps/ti/src/navigation.ts", "utf8");
const shell = readFileSync("apps/ti/src/Shell.tsx", "utf8");
const styles = readFileSync("apps/ti/src/styles.css", "utf8");

describe("TI shell redesign", () => {
  it("preserves every technical view identifier", () => {
    for (const view of [
      "overview",
      "datasul",
      "users",
      "rh",
      "storage",
      "notifications",
      "database",
      "integrations",
      "site",
      "security",
      "support",
      "logs",
    ]) {
      expect(nav).toContain(`"${view}"`);
    }
  });

  it("preserves navigation permission gates", () => {
    for (const permission of [
      "ti.datasul.read",
      "ti.users.manage",
      "employee.manage",
      "ti.storage.manage",
      "ti.notifications.manage",
      "ti.database.view",
      "ti.manage",
      "ti.security.view",
    ]) {
      expect(nav).toContain(permission);
    }
  });

  it("keeps data and mutations owned by App", () => {
    expect(app).toContain('useState<TiView>("overview")');
    expect(app).toContain("invokeFunction");
    expect(app).toContain("loadDatabase");
    expect(app).toContain("updateSetting");
    expect(app).toContain("<TiShell");
    expect(app).toContain('nextView === "database" && !database');
  });

  it("adds grouped technical navigation and accessible shell semantics", () => {
    expect(nav).toContain('label: "OPERAÇÃO"');
    expect(nav).toContain('label: "INFRAESTRUTURA"');
    expect(nav).toContain('label: "GOVERNANÇA"');
    expect(shell).toContain('aria-label="Navegação principal da Central T.I."');
    expect(shell).toContain('aria-current={view === item.view ? "page" : undefined}');
    expect(shell).toContain('aria-label="Ambiente de produção"');
  });

  it("keeps mobile navigation controlled and touch targets usable", () => {
    expect(styles).toContain(".ti-nav-group-label");
    expect(styles).toContain("min-height: 44px");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("overflow-x: auto");
  });
});
