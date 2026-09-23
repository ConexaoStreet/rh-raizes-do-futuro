export function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code || "");
}

export function shouldRefreshExpiredJwt(error: unknown) {
  return errorCode(error) === "PGRST303";
}
