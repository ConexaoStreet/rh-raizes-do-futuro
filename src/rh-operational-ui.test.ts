import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const entities = readFileSync("src/entities.tsx", "utf8");
const people = readFileSync("src/People.tsx", "utf8");
const attendance = readFileSync("src/Attendance.tsx", "utf8");
const performance = readFileSync("src/Performance.tsx", "utf8");
const reviews = readFileSync("src/ManagerReviews.tsx", "utf8");
const reports = readFileSync("src/Reports.tsx", "utf8");
const administration = readFileSync("src/Administration.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

describe("RH operational surface redesign", () => {
  it("preserves generic entity CRUD and permission gates", () => {
    expect(entities).toContain("can(spec.permission)");
    expect(entities).toContain('rpc("save_entity"');
    expect(entities).toContain('.select("*", { count: "exact" })');
    expect(entities).toContain(".range(page * 25, page * 25 + 24)");
    expect(entities).toContain('className="panel entity-panel"');
  });

  it("preserves People and attendance workflows", () => {
    expect(people).toContain('can("employee.manage")');
    expect(people).toContain('.from("employees")');
    expect(attendance).toContain('rpc("course_status"');
    expect(attendance).toContain('rpc("open_attendance"');
    expect(attendance).toContain("attendance.manage");
  });

  it("preserves performance, management, report and admin contracts", () => {
    expect(performance).toContain('can("performance.grade")');
    expect(performance).toContain('.from("performance_reviews")');
    expect(reviews).toContain('rpc("my_review_tasks"');
    expect(reviews).toContain('can("review.manage")');
    expect(reports).toContain('rpc("report_snapshot"');
    expect(administration).toContain('can("user.manage")');
  });

  it("applies a shared operational visual language", () => {
    for (const source of [
      entities,
      people,
      attendance,
      performance,
      reviews,
      reports,
      administration,
    ]) {
      expect(source).toContain("operational-heading");
    }
    expect(styles).toContain(".operational-heading");
    expect(styles).toContain(".entity-panel");
    expect(styles).toContain(".tabs button.active");
    expect(styles).toContain(".attendance-row");
    expect(styles).toContain(".review-task-grid");
    expect(styles).toContain(".role-cards");
  });

  it("keeps mobile table adaptation and touch targets", () => {
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("td[data-label]:before");
    expect(styles).toContain("min-height: 44px");
  });
});
