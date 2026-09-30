import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const performance = readFileSync(new URL("./Performance.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("./Shell.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260928152231_rh_personalized_notifications.sql", import.meta.url),
  "utf8",
);
const notifier = readFileSync(
  new URL("../supabase/functions/rh-notify/index.ts", import.meta.url),
  "utf8",
);

describe("RH gradebook and personalized notifications", () => {
  it("shows weight contribution and mobile data labels in the gradebook", () => {
    expect(performance).toContain("% da média");
    expect(performance).toContain('data-label={visibleCycles[index].title}');
    expect(styles).toContain("td[data-label]:before");
    expect(styles).toContain("content: attr(data-label)");
  });

  it("replaces the generic RH workspace tile with the official mark", () => {
    expect(shell).toContain('/brand/raizes-logo-mark.png');
    expect(shell).not.toContain('<span className="workspace-icon">RH</span>');
  });

  it("routes only RH-scoped notifications to personalized delivery", () => {
    expect(migration).toContain("new.scope is distinct from 'rh'");
    expect(migration).toContain("'ti'");
    expect(migration).toContain("rh_notify_attendance_change");
    expect(migration).toContain("rh_notify_performance_change");
    expect(notifier).toContain("rh-notification-");
    expect(notifier).toContain("Oi,");
  });
});
