import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("apps/ti/src/App.tsx", "utf8");
const mascot = readFileSync("apps/ti/src/LoginMascot.tsx", "utf8");
const styles = readFileSync("apps/ti/src/styles.css", "utf8");
const main = readFileSync("apps/ti/src/main.tsx", "utf8");
const worker = readFileSync("apps/ti/public/sw.js", "utf8");

describe("TI regressions", () => {
  it("keeps the interactive mascot inside Datasul", () => {
    expect(app).toContain('placement="datasul"');
    expect(app).toContain('scopeSelector=".datasul-view-root"');
    expect(styles).toMatch(
      /\.datasul-mascot-perch\s*\{[\s\S]*?display:\s*grid/,
    );
    expect(mascot).toContain("caretPoint(field)");
    expect(mascot).toContain('document.addEventListener("pointermove"');
  });

  it("forces service worker updates after deployments", () => {
    expect(main).toContain('updateViaCache: "none"');
    expect(main).toContain("registration.update()");
    expect(main).toContain('"controllerchange"');
    expect(worker).toContain('fetch(request, { cache: "no-store" })');
  });
});
