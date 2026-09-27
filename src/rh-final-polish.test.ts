import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const components = readFileSync("src/components.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const redesign = readFileSync("src/styles/rh-redesign.css", "utf8");

describe("RH final polish contracts", () => {
  it("keeps keyboard focus visible", () => {
    expect(redesign).toContain(":focus-visible");
    expect(redesign).toContain("outline: 2px solid var(--rh-primary)");
    expect(redesign).toContain("--rh-focus-ring");
  });

  it("respects reduced motion", () => {
    expect(redesign).toContain("@media (prefers-reduced-motion: reduce)");
    expect(redesign).toContain("animation-duration: 0.01ms");
  });

  it("keeps mobile touch targets at least 44px", () => {
    expect(styles).toContain("min-height: 44px");
    expect(styles).toContain("@media (max-width: 760px)");
  });

  it("keeps status labels textual instead of color-only", () => {
    expect(components).toContain("badge-${String(value)}");
    expect(components).toContain("{label(value)}");
  });

  it("preserves dialog accessibility in shared UI", () => {
    expect(components).toContain("<Dialog.Title>");
    expect(components).toContain('aria-label="Fechar"');
  });
});
