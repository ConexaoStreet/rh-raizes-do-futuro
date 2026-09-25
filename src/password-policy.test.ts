import { describe, expect, it } from "vitest";
import { strongPassword } from "./password-policy";

describe("password policy", () => {
  it("requires length and all character classes", () => {
    expect(strongPassword("Raizes#2026Seguro")).toBe(true);
    expect(strongPassword("raizes#2026seguro")).toBe(false);
    expect(strongPassword("RAIZES#2026SEGURO")).toBe(false);
    expect(strongPassword("RaizesSeguro#")).toBe(false);
    expect(strongPassword("Raizes2026Seguro")).toBe(false);
    expect(strongPassword("Aa1!curta")).toBe(false);
  });
});
