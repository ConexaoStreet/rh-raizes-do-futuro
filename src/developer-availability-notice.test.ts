import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const notice = readFileSync("src/DeveloperAvailabilityNotice.tsx", "utf8");
const auth = readFileSync("src/auth.tsx", "utf8");
const shell = readFileSync("src/Shell.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

describe("developer availability notice", () => {
  it("shows the robbery notice in login and authenticated areas", () => {
    expect(notice).toContain("O desenvolvedor do projeto foi assaltado");
    expect(notice).toContain("GESTÃO TEMPORARIAMENTE INDISPONÍVEL");
    expect(notice).toContain('role="alert"');
    expect(notice).toContain('aria-live="assertive"');
    expect(auth).toContain("<DeveloperAvailabilityNotice />");
    expect(shell).toContain("<DeveloperAvailabilityNotice />");
  });

  it("keeps the notice visually prominent and responsive", () => {
    expect(styles).toContain(".developer-availability-notice");
    expect(styles).toContain(".main-column > .developer-availability-notice");
    expect(styles).toContain(".login-card .developer-availability-notice");
    expect(styles).toContain("@media (max-width: 760px)");
  });
});
