import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ceremony = readFileSync(
  new URL("./LaunchCeremony.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("presentation launch ceremony", () => {
  it("uses the presentation window with the Sao Paulo UTC offset", () => {
    expect(ceremony).toContain("2026-09-29T08:00:00-03:00");
    expect(ceremony).toContain("2026-09-29T14:00:00-03:00");
    expect(ceremony).toContain("now >= START_AT && now < END_AT");
  });

  it("expires itself and mounts before authentication", () => {
    expect(ceremony).toContain("if (now >= END_AT) return");
    expect(app).toContain("<LaunchCeremony>");
    expect(app.indexOf("<LaunchCeremony>")).toBeLessThan(
      app.indexOf("<AuthBoundary>"),
    );
  });

  it("keeps the official brand and responsive launch layout", () => {
    expect(ceremony).toContain('/brand/raizes-logo-mark.png');
    expect(styles).toContain(".launch-ceremony");
    expect(styles).toContain("@media(max-width:640px)");
  });
});
