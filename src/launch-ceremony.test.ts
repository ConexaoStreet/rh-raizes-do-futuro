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

  it("assigns one stable paired artwork theme per browser", () => {
    expect(ceremony).toContain("raizes-inauguracao-theme-2026");
    expect(ceremony).toContain("THEME_COUNT = 5");
    expect(ceremony).toContain("/brand/inauguracao/mobile-");
    expect(ceremony).toContain("/brand/inauguracao/desktop-");
    expect(ceremony).toContain("<picture");
    expect(ceremony).toContain('className="lc__cta-hit"');
    expect(visualStyles).toContain(".lc__art");
    expect(visualStyles).toContain('.lc[data-theme="5"] .lc__cta-hit');
  });

  it("keeps a functional accessible layer above the artwork", () => {
    expect(ceremony).toContain('aria-label="Entrar no Raízes do Futuro"');
    expect(ceremony).toContain("Tempo restante:");
    expect(ceremony).toContain('aria-labelledby="lc-title"');
    expect(visualStyles).toContain(".lc__semantic");
    expect(visualStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
