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
  it("uses the official Sao Paulo presentation window", () => {
    expect(gate).toContain("2026-09-29T08:00:00-03:00");
    expect(gate).toContain("2026-09-29T14:00:00-03:00");
    expect(gate).toContain("now >= START_AT && now < END_AT");
  });

  it("offers a preview that cannot revive the ceremony after launch day", () => {
    expect(gate).toContain('"ensaio-final"');
    expect(gate).toContain("previewRequested && now < START_AT");
    expect(gate).toContain("if (now >= END_AT) return");
  });

  it("mounts before authentication and stays lazy", () => {
    expect(gate).toContain('lazy(() => import("./LaunchCeremony"))');
    expect(app).toContain("<PresentationGate>");
    expect(app.indexOf("<PresentationGate>")).toBeLessThan(
      app.indexOf("<AuthBoundary>"),
    );
  });

  it("assigns a stable theme and uses responsive launch sprites", () => {
    expect(ceremony).toContain("raizes-inauguracao-theme-v2");
    expect(ceremony).toContain('params.get("tema")');
    expect(ceremony).toContain("window.localStorage.setItem");
    expect(visualStyles).toContain('/launch/desktop-sprite.webp');
    expect(visualStyles).toContain('/launch/mobile-sprite.webp');
    expect(visualStyles).toContain("background-size: 500% 100%");
  });
});
