import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync("apps/ti/src/main.tsx", "utf8");
const redesign = readFileSync("apps/ti/src/redesign.css", "utf8");

describe("TI redesign foundation", () => {
  it("loads the TI redesign layer after the legacy stylesheet", () => {
    const legacy = main.indexOf('import "./styles.css"');
    const next = main.indexOf('import "./redesign.css"');
    expect(legacy).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(legacy);
  });

  it("defines the technical console token contract", () => {
    for (const token of [
      "--ti-canvas",
      "--ti-surface",
      "--ti-surface-elevated",
      "--ti-border",
      "--ti-text",
      "--ti-muted",
      "--ti-healthy",
      "--ti-warn",
      "--ti-error",
      "--ti-accent",
      "--ti-mono",
      "--ti-motion-base",
    ]) {
      expect(redesign).toContain(token);
    }
  });

  it("keeps the TI visual language independent from RH tokens", () => {
    expect(redesign).not.toContain("--rh-");
  });

  it("keeps focus, status text hooks and reduced motion available", () => {
    expect(redesign).toContain(":focus-visible");
    expect(redesign).toContain(".ti-status");
    expect(redesign).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
