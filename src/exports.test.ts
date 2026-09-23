import { describe, expect, it } from "vitest";
import type { ReportSnapshot } from "./Dashboard";
import { buildPdf, buildPptx, buildXlsx, type ReportConfig } from "./exports";

const metrics = {
  employees: 2,
  active_employees: 2,
  records: 2,
  pending: 0,
  present: 2,
  absent: 0,
  justified: 0,
  unjustified: 0,
  late: 0,
  delay_total: 0,
  delay_average: 0,
  attendance_rate: 100,
  punctuality_rate: 100,
  performance_average: 9,
  feedback_count: 1,
};

const snapshot: ReportSnapshot = {
  period_start: "2026-09-01",
  period_end: "2026-09-30",
  generated_at: "2026-09-23T12:00:00Z",
  metrics,
  previous: { ...metrics, present: 1, attendance_rate: 50 },
  series: [
    {
      month: "2026-09",
      present: 2,
      absent: 0,
      justified: 0,
      late: 0,
    },
  ],
  records: [],
  grades: [],
  feedbacks: [],
};

const config: ReportConfig = {
  title: "Relatório de teste",
  kind: "attendance",
  employee_id: null,
  class_id: null,
  positive: "",
  attention: "",
  actions: "",
  conclusion: "",
  managerResults: [],
};

describe("report file builders", () => {
  it(
    "generates non-empty PDF, PPTX and XLSX blobs",
    async () => {
      const [pdf, pptx, xlsx] = await Promise.all([
        buildPdf(snapshot, config),
        buildPptx(snapshot, config),
        buildXlsx(snapshot, config),
      ]);

      expect(pdf.size).toBeGreaterThan(500);
      expect(pptx.size).toBeGreaterThan(500);
      expect(xlsx.size).toBeGreaterThan(500);
    },
    30000,
  );
});
