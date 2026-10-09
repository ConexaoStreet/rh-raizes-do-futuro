import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync("src/Dashboard.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const administration = readFileSync("src/Administration.tsx", "utf8");

describe("RH dashboard redesign", () => {
  it("preserves the dashboard data contracts", () => {
    expect(dashboard).toContain('rpc("dashboard_snapshot"');
    expect(dashboard).toContain('.from("absence_justifications")');
    expect(dashboard).toContain('.from("feedbacks")');
    expect(dashboard).toContain('.from("events")');
    expect(dashboard).toContain('.eq("status", "pending")');
    expect(dashboard).toContain('.eq("status", "following")');
  });

  it("preserves the four executive KPI labels", () => {
    for (const label of [
      "Colaboradores ativos",
      "Presença",
      "Pontualidade",
      "Média de notas",
    ]) {
      expect(dashboard).toContain(`title="${label}"`);
    }
    expect(dashboard).toContain('variant="primary"');
    expect(dashboard).toContain('stats.late > 0 ? "attention" : "default"');
  });

  it("keeps the intended visual hierarchy", () => {
    const stats = dashboard.indexOf('className="stats-grid executive-metrics"');
    const notice = dashboard.indexOf('className="notice maintenance-notice"');
    const attendance = dashboard.indexOf(
      'className="attendance-banner dashboard-priority-band"',
    );
    const mainGrid = dashboard.indexOf('className="dashboard-grid"');
    const bottom = dashboard.indexOf(
      'className="dashboard-bottom editorial-support-grid"',
    );

    expect(stats).toBeGreaterThan(-1);
    expect(notice).toBeGreaterThan(stats);
    expect(attendance).toBeGreaterThan(notice);
    expect(mainGrid).toBeGreaterThan(attendance);
    expect(bottom).toBeGreaterThan(mainGrid);
  });

  it("removes obsolete dashboard ornamentation instead of stacking CSS", () => {
    expect(dashboard).not.toContain("department-pills");
    expect(styles).not.toContain(".department-pills");
    expect(styles).not.toContain(".raizes-hero:after");
    expect(styles).toContain(".raizes-hero {");
    expect(styles).toContain(".dashboard-grid {");
  });
  it("makes the RH dashboard refresh visibly distinct", () => {
    expect(dashboard).toContain('className="stats-grid executive-metrics"');
    expect(dashboard).toContain(
      'className="attendance-banner dashboard-priority-band"',
    );
    expect(dashboard).toContain(
      'className="panel chart-panel dashboard-insight-panel"',
    );
    expect(dashboard).toContain(
      'className="panel pending-panel dashboard-action-panel"',
    );
    expect(dashboard).toContain(
      'className="dashboard-bottom editorial-support-grid"',
    );
    expect(dashboard).toContain("SUA JORNADA NO RAÍZES");
    expect(dashboard).toContain("Um olhar sobre a turma e os próximos passos.");
    expect(styles).toContain(".executive-metrics");
    expect(styles).toContain(".dashboard-priority-band");
    expect(styles).toContain(".setting-link-v2");
    expect(administration).toContain("Deixe o RH do seu jeito");
    expect(administration).toContain("settings-grid-v2");
    expect(styles).toContain(".dashboard-action-panel");
  });
});
