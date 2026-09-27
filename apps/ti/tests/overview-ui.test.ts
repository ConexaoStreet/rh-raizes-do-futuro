import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("apps/ti/src/App.tsx", "utf8");
const redesign = readFileSync("apps/ti/src/redesign.css", "utf8");

describe("TI operational overview redesign", () => {
  it("preserves overview data sources", () => {
    for (const contract of [
      "snapshot.profiles_total",
      "snapshot.profiles_active",
      "snapshot.employees_total",
      "snapshot.employees_active",
      "snapshot.auth_sessions",
      "snapshot.push_devices",
      "snapshot.storage_objects",
      "snapshot.audit_24h",
      "snapshot.datasul_operations_24h",
      "snapshot.datasul_failures_24h",
      "snapshot.photo_status?.basic_passed",
      "snapshot.photo_status?.approved",
      "moduleErrors",
      "datasul.status",
      "github.status",
      "vercel.status",
      "email.status",
      "maintenance.enabled",
      "healthScore",
    ]) {
      expect(app).toContain(contract);
    }
  });

  it("uses the reusable overview primitives", () => {
    expect(app).toContain("<StatusTile");
    expect(app).toContain("<HealthRow");
    expect(app).toContain("<IncidentNotice");
  });

  it("keeps overview action touch targets at least 44px", () => {
    expect(redesign).toMatch(
      /\.ti-health-row-action button\s*\{[^}]*min-height:\s*44px;/s,
    );
  });

  it("keeps activity audit visible", () => {
    expect(app).toContain("Atividade recente");
    expect(app).toContain("audit.slice(0, 8)");
  });
});
