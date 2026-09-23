import { describe, expect, it } from "vitest";
import { errorCode, shouldRefreshExpiredJwt } from "./auth-errors";

describe("auth error handling", () => {
  it("refreshes only PGRST303 JWT failures", () => {
    expect(shouldRefreshExpiredJwt({ code: "PGRST303" })).toBe(true);
    expect(shouldRefreshExpiredJwt({ code: "PGRST301" })).toBe(false);
    expect(shouldRefreshExpiredJwt(new TypeError("network"))).toBe(false);
    expect(shouldRefreshExpiredJwt(null)).toBe(false);
  });

  it("normalizes error codes safely", () => {
    expect(errorCode({ code: 401 })).toBe("401");
    expect(errorCode({ code: "" })).toBe("");
    expect(errorCode({ message: "missing" })).toBe("");
  });
});
