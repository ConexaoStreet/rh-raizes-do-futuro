import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync(new URL("./PresentationGate.tsx", import.meta.url), "utf8");
const ceremony = readFileSync(
  new URL("./LaunchCeremony.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const visualStyles = readFileSync(
  new URL("./launch-ceremony.css", import.meta.url),
  "utf8",
);

describe("presentation launch ceremony", () => {
  it("uses the presentation window with the Sao Paulo UTC offset", () => {
    expect(gate).toContain("2026-09-29T08:00:00-03:00");
    expect(gate).toContain("2026-09-29T14:00:00-03:00");
    expect(gate).toContain("now >= START_AT && now < END_AT");
  });

  it("expires itself and mounts before authentication", () => {
    expect(gate).toContain("if (now >= END_AT) return");
    expect(gate).toContain('lazy(() => import("./LaunchCeremony"))');
    expect(app).toContain("<PresentationGate>");
    expect(app.indexOf("<PresentationGate>")).toBeLessThan(
      app.indexOf("<AuthBoundary>"),
    );
  });

  it("keeps the editorial ceremony lazy and branded", () => {
    expect(ceremony).toContain('import "./launch-ceremony.css"');
    expect(ceremony).toContain('/brand/raizes-logo-mark.png');
    expect(ceremony).toContain('className="lc__horizon"');
    expect(ceremony).toContain('className="lc__mobile"');
    expect(ceremony).toContain('className="lcm__title"');
    expect(ceremony).toContain("Hoje, o projeto");
    expect(visualStyles).toContain(".lc__horizon");
    expect(visualStyles).toContain(".lc__mask--num");
    expect(visualStyles).toContain(".lcm__schedule");
  });
});
