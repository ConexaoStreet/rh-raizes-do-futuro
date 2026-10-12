import { describe, expect, it } from "vitest";
import { classifyEmailDeliveryFailure as classify } from "../supabase/functions/_shared/email-delivery";

describe("transactional email failure classification", () => {
  it("identifies an unverified sender domain as configuration", () => {
    expect(
      classify(403, {
        name: "validation_error",
        message:
          "The example.test domain is not verified. Please, add and verify your domain.",
      }).code,
    ).toBe("EMAIL_CONFIGURATION_REQUIRED");
  });

  it("identifies a restricted inactive sending key as configuration", () => {
    expect(
      classify(403, {
        name: "restricted_api_key",
        message: "API key is not active",
      }).code,
    ).toBe("EMAIL_CONFIGURATION_REQUIRED");
  });

  it("identifies the testing sender restriction reproduced in production", async () => {
    expect(
      classify(403, {
        name: "validation_error",
        message:
          "You can only send testing emails to your own email address. Please verify a domain.",
      }),
    ).toEqual({
      code: "EMAIL_CONFIGURATION_REQUIRED",
      status: 503,
      outcome: "configuration_required",
    });
  });

  it("identifies an invalid server sending key as configuration", async () => {
    expect(classify(401, { name: "validation_error" }).code).toBe(
      "EMAIL_CONFIGURATION_REQUIRED",
    );
  });

  it("keeps provider throttling separate from missing configuration", async () => {
    expect(classify(429, {})).toEqual({
      code: "EMAIL_RATE_LIMITED",
      status: 429,
      outcome: "rate_limited",
    });
  });

  it("handles unavailable and malformed provider responses without forwarding their contents", async () => {
    for (const payload of [
      null,
      "unavailable",
      { message: "internal provider details" },
    ]) {
      expect(classify(503, payload)).toEqual({
        code: "EMAIL_DELIVERY_FAILED",
        status: 502,
        outcome: "delivery_failed",
      });
    }
    expect(
      classify(403, { name: "other", message: "unrelated restriction" }).code,
    ).toBe("EMAIL_DELIVERY_FAILED");
  });
});
