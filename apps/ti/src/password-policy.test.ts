import { describe, expect, it } from "vitest";
import { strongPassword } from "./password-policy";

describe("TI password policy", () => {
  it("requires 12 characters and all character classes", () => {
    expect(strongPassword("Raizes#2026Seguro")).toBe(true);
    expect(strongPassword("raizes#2026seguro")).toBe(false);
    expect(strongPassword("RAIZES#2026SEGURO")).toBe(false);
    expect(strongPassword("RaizesSeguro#")).toBe(false);
    expect(strongPassword("Raizes2026Seguro")).toBe(false);
    expect(strongPassword("R#2a")).toBe(false);
  });
});
