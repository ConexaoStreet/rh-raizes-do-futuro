export function classifyEmailDeliveryFailure(status: number, detail: unknown) {
  const value =
    detail && typeof detail === "object"
      ? (detail as { name?: unknown; message?: unknown })
      : null;
  const domainRequired =
    status === 403 &&
    value?.name === "validation_error" &&
    typeof value.message === "string" &&
    /only send testing emails|verify (?:a|your) domain|domain is not verified/i.test(
      value.message,
    );
  const inactiveKey = status === 403 && value?.name === "restricted_api_key";
  if (domainRequired || inactiveKey || status === 401)
    return {
      code: "EMAIL_CONFIGURATION_REQUIRED",
      status: 503,
      outcome: "configuration_required",
    } as const;
  if (status === 429)
    return {
      code: "EMAIL_RATE_LIMITED",
      status: 429,
      outcome: "rate_limited",
    } as const;
  return {
    code: "EMAIL_DELIVERY_FAILED",
    status: 502,
    outcome: "delivery_failed",
  } as const;
}
